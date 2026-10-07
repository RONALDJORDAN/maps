import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const STORE_KEY = 'escolas-store-v2'
const TURNOS = ['manhã', 'tarde', 'noite']

async function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  const r = await fetch('/data/escolas.json')
  const seed = await r.json()
  try { localStorage.setItem(STORE_KEY, JSON.stringify(seed)) } catch {}
  return seed
}

const emptyForm = { id: '', nome: '', inep: '', turno: 'manhã', alunos: '', lat: '', lng: '' }

function App() {
  const [muns, setMuns] = useState([])
  const [rows, setRows] = useState([])
  const [munQ, setMunQ] = useState('')
  const [ibge, setIbge] = useState('')
  const [q, setQ] = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    // fundo: mesmo mapa satélite da página inicial (só visual)
    try {
      const bg = L.map('esc-bgmap', { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, zoomControl: false, tap: false }).setView([-9.62, -36.82], 8)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(bg)
    } catch {}
    fetch('/data/municipios.json').then((r) => r.json()).then((j) => {
      const s = [...j].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      setMuns(s)
      if (!ibge && s.length) setIbge(s.find((m) => m.ibge === '2706406')?.ibge || s[0].ibge)
    }).catch(() => setMuns([]))
    loadStore().then((s) => { setRows(s); setLoaded(true) }).catch(() => { setRows([]); setLoaded(true) })
  }, [])
  useEffect(() => {
    const onDoc = (ev) => { if (!ev.target.closest?.('.mun-combo')) setDropOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const munList = useMemo(() => {
    const nq = norm(munQ.trim())
    return muns.filter((m) => !nq || norm(m.nome).includes(nq))
  }, [muns, munQ])

  const schools = useMemo(() => {
    const nq = norm(q.trim())
    return rows
      .filter((e) => !ibge || e.ibge === ibge)
      .filter((e) => !nq || norm(e.nome).includes(nq) || e.inep.includes(q.trim()))
  }, [rows, ibge, q])

  useEffect(() => {
    if (document.documentElement.classList.contains('reduced') || !window.anime) return
    window.anime({ targets: '.tmap .pill-menu', translateY: [-18, 0], opacity: [0, 1], duration: 600, easing: 'cubicBezier(.22,1,.36,1)' })
  }, [])
  useEffect(() => {
    if (document.documentElement.classList.contains('reduced') || !window.anime) return
    window.anime({ targets: '#esc-app .tcard', translateY: [16, 0], opacity: [0, 1], delay: window.anime.stagger(35), duration: 500, easing: 'cubicBezier(.22,1,.36,1)' })
  }, [ibge, schools.length])

  const munName = muns.find((m) => m.ibge === ibge)?.nome || ''

  function persist(next) {
    setRows(next)
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)) } catch {}
  }
  function setMsgOk(t) { setMsg(t); setTimeout(() => setMsg(''), 2600) }

  function onSave(ev) {
    ev.preventDefault()
    const nome = form.nome.trim()
    const inep = form.inep.replace(/\D/g, '')
    if (nome.length < 3) return setMsgOk('Nome muito curto.')
    if (!/^\d{8}$/.test(inep)) return setMsgOk('INEP deve ter 8 dígitos.')
    if (rows.some((e) => e.inep === inep && e.inep !== form.id)) return setMsgOk('INEP já cadastrado.')
    const lat = parseFloat(String(form.lat).replace(',', '.')), lng = parseFloat(String(form.lng).replace(',', '.'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setMsgOk('Lat/lng inválidos.')
    const rec = { inep, nome, ibge, turno: form.turno, alunos: parseInt(form.alunos, 10) || 0, lat, lng }
    if (form.id) {
      persist(rows.map((e) => (e.inep === form.id ? { ...e, ...rec } : e)))
      setMsgOk(`“${nome}” atualizada.`)
    } else persist([...rows, rec]), setMsgOk(`“${nome}” cadastrada em ${munName}.`)
    setForm(emptyForm)
  }
  function onEdit(e) {
    setForm({ id: e.inep, nome: e.nome, inep: e.inep, turno: e.turno, alunos: String(e.alunos ?? ''), lat: String(e.lat), lng: String(e.lng) })
    setShowForm(true)
    setTimeout(() => document.getElementById('reg-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
  }
  function onDel(inep) {
    if (!window.confirm('Excluir esta escola do registro?')) return
    persist(rows.filter((e) => e.inep !== inep))
    setMsgOk('Escola excluída.')
  }

  return (
    <div className="tmap">
      <nav className="pill-menu glass" aria-label="Registro de escolas">
        <a href="/index.html" className="pill-btn" title="Voltar ao mapa" aria-label="Voltar ao mapa" data-tip="Mapa" style={{ textDecoration: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></svg>
        </a>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b9aecb" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} className="pill-input static" type="search" placeholder="Buscar escola…" aria-label="Buscar escola" />
        <span className="mun-combo" onClick={(e) => e.stopPropagation()}>
          <button className="mun-btn" onClick={() => setDropOpen((o) => !o)} aria-haspopup="listbox" title="Filtrar por município">
            <span>{munName ? `Município: ${munName}` : 'Município…'}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <span className={'mun-drop glass' + (dropOpen ? '' : ' hidden')}>
            <input value={munQ} onChange={(e) => setMunQ(e.target.value)} type="search" placeholder="Buscar município…" aria-label="Buscar município" />
            <span className="mun-list" role="listbox">
              {[{ ibge: '', nome: 'Todos os municípios' }, ...munList].map((m) => (
                <button key={m.ibge || 'all'} className={'mun-opt' + (m.ibge === ibge ? ' active' : '')} onClick={() => { setIbge(m.ibge); setDropOpen(false) }}>
                  {m.nome} {m.ibge !== '' && <small style={{ opacity: .6 }}>· {rows.filter((e) => e.ibge === m.ibge).length}</small>}
                </button>
              ))}
              {!munList.length && <span className="mun-empty">Nada encontrado</span>}
            </span>
          </span>
        </span>
      </nav>

      <div className="tcontent">
        <h1>{munName ? `Escolas · ${munName}` : 'Escolas'}</h1>
        <p className="tsub">{schools.length} escola(s) {muns.length ? `· ${muns.length} municípios` : ''} · {rows.length} no registro</p>
        <div className="school-grid">
          {!loaded && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="card tcard skel"><div className="skel-line" /><div className="skel-line short" /></div>)}
          {loaded && schools.map((e) => (
            <div key={e.inep} className="card in tcard school-card">
              <h4>{e.nome}</h4>
              <p>INEP {e.inep} · {e.turno} · {e.alunos} alunos<br />{e.zona ? `${e.zona}${e.povoado ? ` · ${e.povoado}` : ''} · ` : ''}{e.lat}, {e.lng}{e.geoOk === false ? ' (local aprox.)' : ''}</p>
              <div className="row-actions">
                <a className="mini-btn go" href={`/index.html?inep=${e.inep}`}>Ver no mapa</a>
                <button className="mini-btn" onClick={() => onEdit(e)}>Editar</button>
                <button className="mini-btn danger" onClick={() => onDel(e.inep)}>Excluir</button>
              </div>
            </div>
          ))}
          {loaded && !schools.length && <div className="card in tcard"><h4>Nenhuma escola</h4><p>Escolha um município ou cadastre abaixo.</p></div>}
        </div>

        <button className="btn new-school" type="button" onClick={() => { setForm(emptyForm); setMsg(''); setShowForm((s) => !s) }}>
          {showForm ? '− Fechar cadastro' : '+ Nova escola'}
        </button>
        {showForm && (
        <form id="reg-form" className="form reg-form tcard" onSubmit={onSave}>
          <h3>{form.id ? 'Editar escola' : 'Nova escola'} {munName && `· ${munName}`}</h3>
          <div className="grid2">
            <label>Nome<input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="UME ..." /></label>
            <label>INEP (8 dígitos)<input value={form.inep} onChange={(e) => setForm({ ...form, inep: e.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" placeholder="27064061" /></label>
            <label>Turno<select value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })}>{TURNOS.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Alunos<input value={form.alunos} onChange={(e) => setForm({ ...form, alunos: e.target.value.replace(/\D/g, '') })} inputMode="numeric" placeholder="0" /></label>
            <label>Latitude<input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} inputMode="decimal" placeholder="-9.7467" /></label>
            <label>Longitude<input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} inputMode="decimal" placeholder="-37.431" /></label>
          </div>
          <div className="row-actions" style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit">{form.id ? 'Salvar edição' : 'Cadastrar'}</button>
            <button className="mini-btn" type="button" onClick={() => { setForm(emptyForm); setMsg('') }}>Limpar</button>
          </div>
          <div className="reg-msg">{msg}</div>
        </form>
        )}
      </div>
    </div>
  )
}
createRoot(document.getElementById('esc-app')).render(<App />)
