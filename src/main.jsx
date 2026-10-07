import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function toast(msg) {
  const t = $('#toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(t._h)
  t._h = setTimeout(() => t.classList.remove('show'), 2600)
}

function pinIcon(kind, label) {
  const cls = kind === 'municipio' ? (label === 'manutencao' ? 'pin manut' : 'pin ativo') : 'pin escola'
  return L.divIcon({ className: '', html: `<div class="${cls}"><span>${kind === 'municipio' ? 'M' : 'E'}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 28], popupAnchor: [0, -28] })
}

async function loadJSON(path, fallback) {
  try {
    const r = await fetch(path)
    if (!r.ok) throw new Error('http ' + r.status)
    return await r.json()
  } catch { return fallback }
}

function staggerIn(scope) {
  const items = scope.querySelectorAll('.card:not(.in)')
  if (document.documentElement.classList.contains('reduced')) {
    items.forEach((el) => el.classList.add('in'))
    return
  }
  if (window.anime) {
    window.anime({ targets: items, translateY: [20, 0], opacity: [0, 1], delay: window.anime.stagger(60), duration: 600, easing: 'cubicBezier(.22,1,.36,1)' })
    items.forEach((el) => el.classList.add('in'))
  } else {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.02 })
    items.forEach((el) => io.observe(el))
  }
}

async function init() {
  const mapEl = $('#map')
  if (!mapEl) return

  const map = L.map('map', { zoomControl: false, worldCopyJump: true }).setView([-23.55, -46.63], 8)

  // API MAPAS 100% GRATUITA sem chave (Leaflet + OSM + Esri)
  // CARTO foi removido: agora exige API KEY (carto.com/basemaps/apikey).
  const FREE_PROVIDERS = {
    osm: {
      label: 'OSM padrão (grátis)',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    },
    esri: {
      label: 'Esri ruas (grátis)',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      maxZoom: 19
    },
    hot: {
      label: 'Humanitário (grátis)',
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      attribution: '&copy; OSM contributors, Tiles style by <a href="https://www.hotosm.org/">HOT</a>',
      maxZoom: 19
    }
  }
  const order = ['osm', 'esri', 'hot']
  let currentProv = localStorage.getItem('mapa-escolar-tiles') || 'osm'
  if (!FREE_PROVIDERS[currentProv]) currentProv = 'osm' // migra 'voyager' antigo (CARTO com key)
  let tileLayer = null
  let tileErrors = 0

  function setProvider(key) {
    if (!FREE_PROVIDERS[key]) return
    currentProv = key
    localStorage.setItem('mapa-escolar-tiles', key)
    if (tileLayer) map.removeLayer(tileLayer)
    tileErrors = 0
    const p = FREE_PROVIDERS[key]
    tileLayer = L.tileLayer(p.url, { attribution: p.attribution, maxZoom: p.maxZoom })
    tileLayer.on('tileerror', () => {
      tileErrors++
      if (tileErrors >= 6) {
        const idx = order.indexOf(currentProv)
        const next = order[(idx + 1) % order.length]
        toast(`Falha no tiles ${currentProv}, trocando para ${next} (grátis)`)
        setProvider(next)
        syncProvUI()
      }
    })
    tileLayer.addTo(map)
  }
  function syncProvUI() {
    document.querySelectorAll('[data-prov]').forEach((b) => b.classList.toggle('active', b.dataset.prov === currentProv))
  }
  setProvider(currentProv)

  // Geocodificação 100% grátis sem chave (Nominatim OSM, 1 req/s, cache local)
  const geoCache = new Map()
  let lastGeo = 0
  async function geocodeFree(q) {
    const key = q.trim().toLowerCase()
    if (key.length < 4) return []
    if (geoCache.has(key)) return geoCache.get(key)
    const now = Date.now()
    const wait = 1100 - (now - lastGeo)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastGeo = Date.now()
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&viewbox=-53.1,-26.5,-44.1,-19.5&bounded=0&q=${encodeURIComponent(q)}`
      const r = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!r.ok) throw new Error('geo ' + r.status)
      const j = await r.json()
      const out = (j || []).map((g) => ({ lat: parseFloat(g.lat), lng: parseFloat(g.lon), label: g.display_name.split(',').slice(0, 3).join(',') }))
      geoCache.set(key, out)
      return out
    } catch { return [] }
  }

  const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 })
  map.addLayer(cluster)

  const municipios = await loadJSON('/data/municipios.json', [])
  const escolas = await loadJSON('/data/escolas.json', [])
  const munByIbge = Object.fromEntries(municipios.map((m) => [m.ibge, m]))

  let lines = []
  let currentFilter = 'all'
  let query = ''

  function clearLines() { lines.forEach((l) => map.removeLayer(l)); lines = [] }

  function draw(queryNorm) {
    cluster.clearLayers()
    clearLines()
    const bounds = []
    const q = queryNorm.trim().toLowerCase()

    const munOk = (m) => (currentFilter === 'all' || currentFilter === 'municipio') &&
      (!q || m.nome.toLowerCase().includes(q) || m.ibge.includes(q))
    const escOk = (e) => (currentFilter === 'all' || currentFilter === 'escola') &&
      (!q || e.nome.toLowerCase().includes(q) || e.inep.includes(q))

    const list = $('#react-map-list')
    if (list) list.innerHTML = ''

    municipios.filter(munOk).forEach((m) => {
      const mk = L.marker([m.lat, m.lng], { icon: pinIcon('municipio', m.contrato) })
      mk.bindPopup(`<b>${esc(m.nome)}/${esc(m.uf)}</b><br>IBGE ${esc(m.ibge)}<br>Contrato: ${esc(m.contrato)}<br>Volumetria: ${esc(m.volumetria)}`)
      cluster.addLayer(mk)
      bounds.push([m.lat, m.lng])
      if (list) list.insertAdjacentHTML('beforeend',
        `<div class="card" data-lat="${m.lat}" data-lng="${m.lng}" data-z="12"><h4>${esc(m.nome)} <span class="badge mun">município</span></h4><p>IBGE ${esc(m.ibge)} · ${esc(m.volumetria)} alunos · ${esc(m.contrato)}</p></div>`)
    })

    escolas.filter(escOk).forEach((e) => {
      const mk = L.marker([e.lat, e.lng], { icon: pinIcon('escola') })
      const mun = munByIbge[e.ibge]
      mk.bindPopup(`<b>${esc(e.nome)}</b><br>INEP ${esc(e.inep)}<br>Turno ${esc(e.turno)} · ${esc(e.alunos)} alunos`)
      cluster.addLayer(mk)
      bounds.push([e.lat, e.lng])
      if (mun && currentFilter === 'all') {
        const line = L.polyline([[mun.lat, mun.lng], [e.lat, e.lng]], { weight: 2, opacity: 0.55, dashArray: '6 6' })
        line.addTo(map); lines.push(line)
      }
      if (list) list.insertAdjacentHTML('beforeend',
        `<div class="card" data-lat="${e.lat}" data-lng="${e.lng}" data-z="15"><h4>${esc(e.nome)} <span class="badge esc">escola</span></h4><p>INEP ${esc(e.inep)} · ${esc(e.turno)} · ${esc(e.alunos)} alunos</p></div>`)
    })

    if (list) {
      if (!list.children.length) list.innerHTML = `<div class="card in"><h4>Nada encontrado</h4><p>Tente "Pão de Açúcar", nome ou INEP 8 dígitos.</p></div>`
      staggerIn(list)
      list.querySelectorAll('.card[data-lat]').forEach((c) => c.addEventListener('click', () => {
        const lat = parseFloat(c.dataset.lat), lng = parseFloat(c.dataset.lng)
        // rAF delta-cap fly (Skill 5.9): usa flyTo nativo (transform-only)
        map.flyTo([lat, lng], parseInt(c.dataset.z || '13', 10), { duration: 0.7 })
      }))
    }

    // KPIs
    const k = $('#react-kpis')
    if (k) k.innerHTML = `<div class="kpis">
      <div class="kpi apple-stagger-item"><b>${municipios.length}</b><span>Municípios</span></div>
      <div class="kpi apple-stagger-item"><b>${escolas.length}</b><span>Escolas</span></div>
      <div class="kpi apple-stagger-item"><b>${escolas.reduce((a, e) => a + (e.alunos || 0), 0)}</b><span>Alunos</span></div></div>`

    if (bounds.length && !q) { try { map.fitBounds(bounds, { padding: [60, 60] }) } catch {} }
  }

  // Game-loop 60fps delta cap (Skill 5.9) — só para contadores / sem layout thrash
  let last = performance.now()
  function loop(t) {
    const dt = Math.min((t - last) / 1000, 0.05); last = t
    void dt
    requestAnimationFrame(loop)
  }
  if (!document.documentElement.classList.contains('reduced')) requestAnimationFrame(loop)

  const search = $('#gmaps-search')
  let deb
  let geoMarkers = []
  function clearGeo() { geoMarkers.forEach((m) => map.removeLayer(m)); geoMarkers = [] }
  search?.addEventListener('input', () => {
    clearTimeout(deb)
    deb = setTimeout(async () => {
      query = search.value; draw(query); clearGeo()
      const q = query.trim()
      // Se nada local e tem 4+ letras, tenta geocodificação grátis (Nominatim)
      const list = $('#react-map-list')
      if (q.length >= 4 && list && list.querySelectorAll('.card[data-lat]').length === 0) {
        toast('Buscando endereço grátis (OSM)…')
        const geos = await geocodeFree(q)
        geos.forEach((g) => {
          const mk = L.marker([g.lat, g.lng], { icon: pinIcon('municipio', 'ativo') })
          mk.bindPopup(`<b>${esc(g.label)}</b><br><small>Endereço OSM grátis (Nominatim)</small>`)
          mk.addTo(map); geoMarkers.push(mk)
          list.insertAdjacentHTML('beforeend',
            `<div class="card" data-glat="${g.lat}" data-glng="${g.lng}"><h4>${esc(g.label)} <span class="badge mun">endereço grátis</span></h4><p>Clique para voar até o local</p></div>`)
        })
        staggerIn(list)
        list.querySelectorAll('[data-glat]').forEach((c) => c.addEventListener('click', () => {
          map.flyTo([parseFloat(c.dataset.glat), parseFloat(c.dataset.glng)], 14, { duration: 0.8 })
        }))
        if (!geos.length) toast('Nada no OSM grátis — tente município/INEP')
      }
    }, 400)
  })
  $('#search-clear')?.addEventListener('click', () => { if (search) search.value = ''; query = ''; draw(query); toast('Busca limpa') })
  document.querySelectorAll('.filter-chip').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach((x) => x.classList.remove('active'))
    b.classList.add('active'); currentFilter = b.dataset.f; draw(query)
  }))
  $('#sidebar-toggle')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('hidden'))
  document.querySelectorAll('[data-prov]').forEach((b) => b.addEventListener('click', () => {
    setProvider(b.dataset.prov); syncProvUI(); toast(`Mapa grátis: ${FREE_PROVIDERS[currentProv].label}`)
  }))
  syncProvUI()
  $('#btn-zin')?.addEventListener('click', () => map.zoomIn())
  $('#btn-zout')?.addEventListener('click', () => map.zoomOut())
  $('#btn-fit')?.addEventListener('click', () => { query = ''; if (search) search.value = ''; currentFilter = 'all'; draw(''); toast('Mostrando tudo') })
  $('#btn-myloc')?.addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Geolocalização indisponível')
    navigator.geolocation.getCurrentPosition((p) => map.flyTo([p.coords.latitude, p.coords.longitude], 13, { duration: 0.8 }),
      () => toast('Não foi possível obter localização'), { timeout: 8000 })
  })

  draw('')
  toast(`${municipios.length} municípios · ${escolas.length} escolas carregados`)
}

init()
