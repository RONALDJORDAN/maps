import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
// UTF-8 + sem acento: "pao/pão/açucar/acucar/açúcar" acham "Pão de Açúcar"
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

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

  const map = L.map('map', { zoomControl: false, worldCopyJump: true }).setView([-9.62, -36.82], 8)
  L.control.zoom({ position: 'bottomright' }).addTo(map)

  // Modos de visão à escolha do usuário: satélite / escuro / ruas (grátis, sem chave)
  const MODES = {
    sat: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ref: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      attr: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
    },
    esri: {
      base: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
      ref: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      attr: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
    },
    osm: {
      base: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      ref: null,
      attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  }
  let currentMode = localStorage.getItem('mapa-escolar-modo') || 'sat'
  if (currentMode === 'dark') currentMode = 'esri' // modo escuro virou Esri ruas
  if (!MODES[currentMode]) currentMode = 'sat'
  let baseLayer = null, overLayer = null
  function syncModeUI() {
    document.querySelectorAll('.filter-chip.mode').forEach((b) => b.classList.toggle('active', b.dataset.mode === currentMode))
  }
  function setMode(key) {
    if (!MODES[key]) return
    currentMode = key
    localStorage.setItem('mapa-escolar-modo', key)
    if (baseLayer) map.removeLayer(baseLayer)
    if (overLayer) { map.removeLayer(overLayer); overLayer = null }
    const m = MODES[key]
    baseLayer = L.tileLayer(m.base, { attribution: m.attr, maxZoom: 19 })
    baseLayer.addTo(map)
    if (m.ref) { overLayer = L.tileLayer(m.ref, { maxZoom: 19 }); overLayer.addTo(map) }
    syncModeUI()
  }
  setMode(currentMode)

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

  // Contorno do estado de Alagoas (fronteira oficial IBGE, sem máscara/limite)
  try {
    const al = await loadJSON('/data/alagoas.geo.json', null)
    if (al?.features?.length) {
      L.geoJSON(al, { style: { color: '#c4b5fd', weight: 3, opacity: 0.95, fillColor: '#8b5cf6', fillOpacity: 0.05 } }).addTo(map)
    }
  } catch {}

  const municipios = await loadJSON('/data/municipios.json', [])
  const escolas = await loadJSON('/data/escolas.json', [])
  const munByIbge = Object.fromEntries(municipios.map((m) => [m.ibge, m]))

  let lines = []
  let currentFilter = 'all'
  let selectedIbge = ''
  let query = ''

  // Filtro por município (combo com busca): ao escolher, mostra as escolas dele
  const munBtn = $('#mun-btn'), munDrop = $('#mun-drop'), munFind = $('#mun-find'), munList = $('#mun-list')
  function flyToMun(ibge) {
    if (!ibge) return
    const m = munByIbge[ibge]
    if (!m) return
    const pts = [[m.lat, m.lng], ...escolas.filter((e) => e.ibge === ibge).map((e) => [e.lat, e.lng])]
    try { map.flyToBounds(L.latLngBounds(pts).pad(0.4), { duration: 0.8 }) } catch {}
  }
  function renderMunOptions(f = '') {
    if (!munList) return
    const nq = norm(f.trim())
    const items = [{ ibge: '', nome: 'Município: todos' },
      ...municipios.filter((m) => !nq || norm(m.nome).includes(nq))]
    munList.innerHTML = items.map((m) =>
      `<button class="mun-opt${m.ibge === selectedIbge ? ' active' : ''}" data-ibge="${m.ibge}">${esc(m.nome)}</button>`).join('') ||
      `<span class="mun-empty">Nada encontrado</span>`
    munList.querySelectorAll('.mun-opt').forEach((b) => b.addEventListener('click', (ev) => {
      ev.stopPropagation()
      selectMun(b.dataset.ibge)
    }))
  }
  function selectMun(ibge) {
    selectedIbge = ibge || ''
    if (munBtn) munBtn.querySelector('span').textContent = ibge && munByIbge[ibge] ? munByIbge[ibge].nome : 'Município: todos'
    munDrop?.classList.add('hidden')
    draw(query)
    flyToMun(selectedIbge)
  }
  if (munBtn && munDrop) {
    renderMunOptions()
    munBtn.addEventListener('click', (ev) => {
      ev.stopPropagation()
      const willOpen = munDrop.classList.contains('hidden')
      munDrop.classList.toggle('hidden')
      if (willOpen) { renderMunOptions(munFind ? munFind.value : ''); if (munFind) { munFind.value = ''; setTimeout(() => munFind.focus(), 50) } }
    })
    munFind?.addEventListener('input', () => renderMunOptions(munFind.value))
    munFind?.addEventListener('click', (ev) => ev.stopPropagation())
    document.addEventListener('click', (ev) => {
      if (!munDrop.classList.contains('hidden') && !munDrop.contains(ev.target)) munDrop.classList.add('hidden')
    })
  }

  function clearLines() { lines.forEach((l) => map.removeLayer(l)); lines = [] }

  function draw(queryNorm) {
    cluster.clearLayers()
    clearLines()
    const bounds = []
    const q = queryNorm.trim().toLowerCase()
    const nq = norm(queryNorm.trim())
    // Mapa limpo por padrão: marcações só aparecem com busca ou município
    const showMarks = q !== '' || currentFilter !== 'all' || selectedIbge !== ''

    const munOk = (m) => (currentFilter === 'all' || currentFilter === 'municipio') &&
      (!selectedIbge || m.ibge === selectedIbge) &&
      (!nq || norm(m.nome).includes(nq) || m.ibge.includes(q))
    const escOk = (e) => (currentFilter === 'all' || currentFilter === 'escola') &&
      (!selectedIbge || e.ibge === selectedIbge) &&
      (!nq || norm(e.nome).includes(nq) || e.inep.includes(q))

    const list = $('#react-map-list')
    if (list) list.innerHTML = ''

    municipios.filter(munOk).forEach((m) => {
      bounds.push([m.lat, m.lng])
      if (!showMarks) return
      const mk = L.marker([m.lat, m.lng], { icon: pinIcon('municipio', m.contrato) })
      mk.bindPopup(`<b>${esc(m.nome)}/${esc(m.uf)}</b><br>IBGE ${esc(m.ibge)}<br>Contrato: ${esc(m.contrato)}<br>Volumetria: ${esc(m.volumetria)}`)
      cluster.addLayer(mk)
      if (list) list.insertAdjacentHTML('beforeend',
        `<div class="card row" data-lat="${m.lat}" data-lng="${m.lng}" data-z="12"><i class="dot mun"></i><div class="row-tx"><h4>${esc(m.nome)}</h4><p>Município · IBGE ${esc(m.ibge)} · ${esc(m.volumetria)} alunos</p></div></div>`)
    })

    escolas.filter(escOk).forEach((e) => {
      bounds.push([e.lat, e.lng])
      if (!showMarks) return
      const mk = L.marker([e.lat, e.lng], { icon: pinIcon('escola') })
      const mun = munByIbge[e.ibge]
      mk.bindPopup(`<b>${esc(e.nome)}</b><br>INEP ${esc(e.inep)}<br>Turno ${esc(e.turno)} · ${esc(e.alunos)} alunos`)
      cluster.addLayer(mk)
      if (mun && currentFilter === 'all') {
        const line = L.polyline([[mun.lat, mun.lng], [e.lat, e.lng]], { weight: 2, opacity: 0.55, dashArray: '6 6' })
        line.addTo(map); lines.push(line)
      }
      if (list) list.insertAdjacentHTML('beforeend',
        `<div class="card row" data-lat="${e.lat}" data-lng="${e.lng}" data-z="15"><i class="dot esc"></i><div class="row-tx"><h4>${esc(e.nome)}</h4><p>Escola · INEP ${esc(e.inep)} · ${esc(e.turno)}</p></div></div>`)
    })

    if (list) {
      if (!list.children.length) list.innerHTML = `<div class="card in"><h4>Nada encontrado</h4><p>Tente "Pão de Açúcar", nome ou INEP 8 dígitos.</p></div>`
      staggerIn(list)
      list.querySelectorAll('.card[data-lat]').forEach((c) => c.addEventListener('click', () => {
        const lat = parseFloat(c.dataset.lat), lng = parseFloat(c.dataset.lng)
        // rAF delta-cap fly (Skill 5.9): usa flyTo nativo (transform-only)
        map.flyTo([lat, lng], parseInt(c.dataset.z || '13', 10), { duration: 0.7 })
      }))
      const n = list.querySelectorAll('.card[data-lat]').length
      const rc = $('#res-count')
      if (rc) rc.textContent = q ? `${n} resultado(s) para “${query.trim()}”` : `${municipios.length} municípios · ${escolas.length} escolas`
    }

    // KPIs — sidebar resumida: quantitativo geral de municípios (Alagoas)
    const k = $('#react-kpis')
    if (k) k.innerHTML = `<div class="kpis single">
      <div class="kpi hero apple-stagger-item"><b>${municipios.length}</b><span>municípios · Alagoas</span><small>${escolas.length} escolas · ${escolas.reduce((a, e) => a + (e.alunos || 0), 0)} alunos</small></div></div>`

    if (bounds.length && !q) { try { map.fitBounds(bounds, { padding: [60, 60] }) } catch {} }
    try { lastBounds = bounds.length ? L.latLngBounds(bounds) : null } catch { lastBounds = null }
    // selo de contagem sob o mapa quando há marcações visíveis
    const pc = $('#pill-count')
    if (pc) {
      let n = 0
      try { n = cluster.getLayers().length } catch {}
      if (showMarks && n > 0) { pc.textContent = `${n} no mapa`; pc.classList.remove('hidden') }
      else pc.classList.add('hidden')
    }
  }

  // Sem game-loop ocioso: Leaflet/animês usam rAF próprio; nada aqui p/ não gastar bateria
  const search = $('#pill-search')
  let deb
  let geoMarkers = []
  let lastBounds = null
  function clearGeo() { geoMarkers.forEach((m) => map.removeLayer(m)); geoMarkers = [] }
  search?.addEventListener('input', () => {
    clearTimeout(deb)
    deb = setTimeout(async () => {
      query = search.value; draw(query); clearGeo()
      const q = query.trim()
      if (!q) return
      // Se nada local e tem 4+ letras, tenta geocodificação grátis (Nominatim)
      const nLocal = (() => { try { return cluster.getLayers().length } catch { return 1 } })()
      if (q.length >= 4 && nLocal === 0) {
        const geos = await geocodeFree(q)
        geos.forEach((g) => {
          const mk = L.marker([g.lat, g.lng], { icon: pinIcon('municipio', 'ativo') })
          mk.bindPopup(`<b>${esc(g.label)}</b><br><small>Endereço OSM grátis (Nominatim)</small>`)
          mk.addTo(map); geoMarkers.push(mk)
        })
        if (geos.length) map.flyTo([geos[0].lat, geos[0].lng], 14, { duration: 0.8 })
      }
    }, 400)
  })
  $('#search-clear')?.addEventListener('click', () => {
    if (search) search.value = ''; query = ''; draw(query); clearGeo()
    document.querySelector('.pill-menu')?.classList.remove('expanded')
    $('#btn-search')?.classList.remove('active')
  })
  search?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (lastBounds) map.flyToBounds(lastBounds, { duration: 0.7 })
    }
    if (e.key === 'Escape' && search) { search.value = ''; query = ''; draw(query); clearGeo(); document.querySelector('.pill-menu')?.classList.remove('expanded') }
  })
  document.querySelectorAll('.filter-chip[data-f]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip[data-f]').forEach((x) => x.classList.remove('active'))
    b.classList.add('active'); currentFilter = b.dataset.f; draw(query)
  }))
  // Pílula superior-direita: localização / pesquisa / filtros / modos (só ícones)
  // clique elástico 60Hz nos botões (só transform via anime.js)
  if (!document.documentElement.classList.contains('reduced') && window.anime) {
    document.querySelectorAll('.pill-btn').forEach((b) => b.addEventListener('click', () => {
      window.anime.remove(b)
      window.anime({ targets: b, scale: [1, 0.82, 1], duration: 380, easing: 'spring(1, 80, 12, 0)', complete: () => { b.style.transform = '' } })
    }))
  }
  // pesquisa, filtros e modos são mutuamente exclusivos: um fecha os outros
  function closeSearch() {
    document.querySelector('.pill-menu')?.classList.remove('expanded')
    $('#btn-search')?.classList.remove('active')
    if (search) search.value = ''
    query = ''; draw(query); clearGeo()
  }
  function closeFilters() {
    const menu = document.querySelector('.pill-menu')
    clearTimeout(menu._ft)
    menu?.classList.remove('expanded-filters', 'filters-open')
    $('#btn-filter')?.classList.remove('active')
  }
  function closeLayers() {
    document.querySelector('.pill-menu')?.classList.remove('expanded-layers')
    $('#btn-layers')?.classList.remove('active')
  }
  function closeApps() {
    document.querySelector('.pill-menu')?.classList.remove('show-all')
    $('#btn-apps')?.classList.remove('active')
    $('#btn-apps')?.setAttribute('aria-expanded', 'false')
  }
  $('#btn-search')?.addEventListener('click', () => {
    const menu = document.querySelector('.pill-menu')
    const willExpand = !menu?.classList.contains('expanded')
    if (willExpand) { closeFilters(); closeLayers() }
    menu?.classList.toggle('expanded', willExpand)
    $('#btn-search')?.classList.toggle('active', willExpand)
    if (willExpand) setTimeout(() => search?.focus(), 150)
    else if (search) { search.value = ''; query = ''; draw(query); clearGeo() }
  })
  $('#btn-filter')?.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const menu = document.querySelector('.pill-menu')
    const willExpand = !menu?.classList.contains('expanded-filters')
    if (willExpand) { closeSearch(); closeLayers() }
    menu?.classList.toggle('expanded-filters', willExpand)
    $('#btn-filter')?.classList.toggle('active', willExpand)
    clearTimeout(menu._ft)
    if (willExpand) menu._ft = setTimeout(() => menu?.classList.add('filters-open'), 460)
    else menu?.classList.remove('filters-open')
  })
  $('#btn-layers')?.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const menu = document.querySelector('.pill-menu')
    const willExpand = !menu?.classList.contains('expanded-layers')
    if (willExpand) { closeSearch(); closeFilters() }
    menu?.classList.toggle('expanded-layers', willExpand)
    $('#btn-layers')?.classList.toggle('active', willExpand)
  })
  document.querySelectorAll('.filter-chip.mode').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation()
    setMode(b.dataset.mode)
  }))
  $('#btn-search')?.addEventListener('click', (ev) => ev.stopPropagation())
  // Ícone padrão fixo: btn-apps revela todas as outras opções da pílula
  $('#btn-apps')?.addEventListener('click', (ev) => {
    ev.stopPropagation()
    const menu = document.querySelector('.pill-menu')
    const willOpen = !menu?.classList.contains('show-all')
    if (!willOpen) { closeSearch(); closeFilters(); closeLayers() }
    menu?.classList.toggle('show-all', willOpen)
    $('#btn-apps')?.classList.toggle('active', willOpen)
    $('#btn-apps')?.setAttribute('aria-expanded', String(willOpen))
  })
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeApps() })
  let myLocMarker = null
  $('#btn-home')?.addEventListener('click', () => {
    if (search) search.value = ''; query = ''; clearGeo()
    closeFilters()
    closeLayers()
    document.querySelector('.pill-menu')?.classList.remove('expanded')
    $('#btn-search')?.classList.remove('active')
    selectedIbge = ''
    if (munBtn) munBtn.querySelector('span').textContent = 'Município: todos'
    munDrop?.classList.add('hidden')
    currentFilter = 'all'
    document.querySelectorAll('.filter-chip[data-f]').forEach((x) => x.classList.toggle('active', x.dataset.f === 'all'))
    draw('')
    // leva o usuário para a própria localização no mapa
    if (!navigator.geolocation) {
      try { if (lastBounds) map.flyToBounds(lastBounds, { duration: 0.8 }) } catch {}
      return
    }
    navigator.geolocation.getCurrentPosition((pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude]
      if (myLocMarker) map.removeLayer(myLocMarker)
      myLocMarker = L.marker(ll, { icon: pinIcon('municipio', 'ativo') }).addTo(map)
      myLocMarker.bindPopup('<b>Você está aqui</b>').openPopup()
      map.flyTo(ll, 14, { duration: 0.9 })
    }, () => {
      try { if (lastBounds) map.flyToBounds(lastBounds, { duration: 0.8 }) } catch {}
    }, { timeout: 8000 })
  })
  $('#btn-zin')?.addEventListener('click', () => map.zoomIn())
  $('#btn-zout')?.addEventListener('click', () => map.zoomOut())
  $('#btn-fit')?.addEventListener('click', () => { query = ''; if (search) search.value = ''; currentFilter = 'all'; draw(''); toast('Mostrando tudo') })
  $('#btn-myloc')?.addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Geolocalização indisponível')
    navigator.geolocation.getCurrentPosition((p) => map.flyTo([p.coords.latitude, p.coords.longitude], 13, { duration: 0.8 }),
      () => toast('Não foi possível obter localização'), { timeout: 8000 })
  })

  draw('')

  // Link direto do módulo Registro (?ibge= / ?inep=)
  try {
    const pm = new URLSearchParams(location.search)
    const qIbge = pm.get('ibge'), qInep = pm.get('inep')
    if (qIbge && munByIbge[qIbge]) {
      selectedIbge = qIbge
      if (munBtn) munBtn.querySelector('span').textContent = munByIbge[qIbge].nome
      draw(''); flyToMun(qIbge)
    } else if (qInep) {
      const target = escolas.find((x) => x.inep === qInep)
      if (target) {
        selectedIbge = target.ibge
        if (munBtn && munByIbge[target.ibge]) munBtn.querySelector('span').textContent = munByIbge[target.ibge].nome
        draw('')
        map.flyTo([target.lat, target.lng], 15, { duration: 0.9 })
        setTimeout(() => {
          L.marker([target.lat, target.lng], { icon: pinIcon('escola') }).addTo(map)
            .bindPopup(`<b>${esc(target.nome)}</b><br>INEP ${esc(target.inep)}`).openPopup()
        }, 950)
      }
    }
  } catch {}
}

init()
