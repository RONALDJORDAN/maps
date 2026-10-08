import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const STORE_KEY = 'logistica-store-v1'
const STATUS = [
  { id: 'agendado', label: 'Agendado' },
  { id: 'em_rota', label: 'Em rota' },
  { id: 'concluido', label: 'Concluído' },
  { id: 'remarcar', label: 'Remarcar' },
]
const PERIODOS = ['manhã', 'tarde', 'integral']
const statusLabel = (s) => STATUS.find((x) => x.id === s)?.label || s

async function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  const r = await fetch('/data/logistica.json')
  const seed = await r.json()
  try { localStorage.setItem(STORE_KEY, JSON.stringify(seed)) } catch {}
  return seed
}

const emptyForm = { id: '', inep: '', data: '', periodo: 'manhã', tecnico: '', status: 'agendado', observacao: '' }
const todayISO = () => new Date().toISOString().slice(0, 10)

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function weekday(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (isNaN(dt)) return ''
  return dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

function initials(nome) {
  return String(nome || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

function App() {
  const [muns, setMuns] = useState([])
  const [escolas, setEscolas] = useState([])
  const [rows, setRows] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [munQ, setMunQ] = useState('')
  const [ibge, setIbge] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('todos')
  const [dropOpen, setDropOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formIbge, setFormIbge] = useState('')
  const [msg, setMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    try {
      const bg = L.map('log-bgmap', { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false }).setView([-9.62, -36.82], 8)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(bg)
    } catch {}
    fetch('/data/municipios.json').then((r) => r.json()).then((j) => {
      setMuns([...j].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    }).catch(() => setMuns([]))
    fetch('/data/escolas.json').then((r) => r.json()).then(setEscolas).catch(() => setEscolas([]))
    loadStore().then((s) => { setRows(Array.isArray(s) ? s : []); setLoaded(true) }).catch(() => { setRows([]); setLoaded(true) })
  }, [])

  useEffect(() => {
    const onDoc = (ev) => {
      if (!ev.target.closest?.('.mun-combo')) setDropOpen(false)
    }
    const onKey = (ev) => { if (ev.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])

  useEffect(() => {
    if (document.documentElement.classList.contains('reduced') || !window.anime) return
    window.anime({ targets: '.tmap .pill-menu', translateY: [-18, 0], opacity: [0, 1], duration: 600, easing: 'cubicBezier(.22,1,.36,1)' })
  }, [])

  const munList = useMemo(() => {
    const nq = norm(munQ.trim())
    return muns.filter((m) => !nq || norm(m.nome).includes(nq))
  }, [muns, munQ])

  const escByInep = useMemo(() => Object.fromEntries(escolas.map((e) => [e.inep, e])), [escolas])
  const munByIbge = useMemo(() => Object.fromEntries(muns.map((m) => [m.ibge, m])), [muns])
  const tecnicos = useMemo(() => [...new Set(rows.map((r) => (r.tecnico || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [rows])

  const filtered = useMemo(() => {
    const nq = norm(q.trim())
    return rows
      .filter((r) => !ibge || r.ibge === ibge)
      .filter((r) => status === 'todos' || r.status === status)
      .filter((r) => {
        if (!nq) return true
        const esc = escByInep[r.inep]
        return norm(esc?.nome).includes(nq) || norm(r.tecnico).includes(nq) || String(r.inep || '').includes(q.trim()) || norm(r.observacao).includes(nq)
      })
      .sort((a, b) => String(a.data).localeCompare(String(b.data)))
  }, [rows, ibge, q, status, escByInep])

  useEffect(() => {
    if (document.documentElement.classList.contains('reduced') || !window.anime) return
    window.anime({ targets: '#log-app .tcard', translateY: [16, 0], opacity: [0, 1], delay: window.anime.stagger(35), duration: 500, easing: 'cubicBezier(.22,1,.36,1)' })
  }, [ibge, status, filtered.length])

  const kpis = useMemo(() => {
    const t = todayISO()
    const in7 = new Date()
    in7.setDate(in7.getDate() + 7)
    const lim = in7.toISOString().slice(0, 10)
    return {
      hoje: rows.filter((r) => r.data === t && r.status !== 'concluido').length,
      semana: rows.filter((r) => r.data >= t && r.data <= lim && r.status !== 'concluido').length,
      agendados: rows.filter((r) => r.status === 'agendado' || r.status === 'em_rota').length,
      concluidos: rows.filter((r) => r.status === 'concluido').length,
    }
  }, [rows])

  const munName = munByIbge[ibge]?.nome || ''
  const formEscolas = useMemo(() => {
    const list = formIbge ? escolas.filter((e) => e.ibge === formIbge) : escolas
    return [...list].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [escolas, formIbge])

  function persist(next) {
    setRows(next)
    try { localStorage.setItem(STORE_KEY, JSON.stringify(next)) } catch {}
  }
  function setMsgOk(t) { setMsg(t); setTimeout(() => setMsg(''), 2600) }

  function onSave(ev) {
    ev.preventDefault()
    if (!form.inep) return setMsgOk('Escolha a escola.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.data)) return setMsgOk('Escolha o dia da avaliação.')
    if (form.tecnico.trim().length < 3) return setMsgOk('Informe o técnico responsável.')
    const esc = escByInep[form.inep]
    const rec = {
      id: form.id || `LOG-${Date.now().toString().slice(-6)}`,
      inep: form.inep,
      ibge: esc?.ibge || formIbge || '',
      data: form.data,
      periodo: form.periodo,
      tecnico: form.tecnico.trim(),
      status: form.status,
      observacao: (form.observacao || '').trim(),
    }
    if (form.id) {
      persist(rows.map((r) => (r.id === form.id ? { ...r, ...rec } : r)))
      setMsgOk('Avaliação atualizada.')
    } else {
      persist([...rows, rec])
      setMsgOk(`Avaliação agendada em ${esc?.nome || 'escola'}.`)
    }
    setForm(emptyForm)
    setFormIbge('')
  }

  function onEdit(r) {
    const esc = escByInep[r.inep]
    setFormIbge(esc?.ibge || r.ibge || '')
    setForm({ id: r.id, inep: r.inep, data: r.data, periodo: r.periodo || 'manhã', tecnico: r.tecnico, status: r.status, observacao: r.observacao || '' })
    setShowForm(true)
    setTimeout(() => document.getElementById('log-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
  }

  function onDel(id) {
    if (!window.confirm('Excluir este agendamento da logística?')) return
    persist(rows.filter((r) => r.id !== id))
    setMsgOk('Agendamento excluído.')
  }

  function onQuickStatus(id, st) {
    persist(rows.map((r) => (r.id === id ? { ...r, status: st } : r)))
    setMsgOk(`Marcado como “${statusLabel(st)}”.`)
  }

  return (
    <div className="tmap">
      <nav className={'pill-menu glass' + (menuOpen ? ' show-all' : '')} aria-label="Painel logístico">
        <a href="/index.html" className="pill-btn" aria-label="Voltar ao mapa" data-tip="Mapa" style={{ textDecoration: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h5v-6h4v6h5V9.5" /></svg>
        </a>
        <a href="/escolas.html" className="pill-btn" aria-label="Registro de escolas" data-tip="Escolas" style={{ textDecoration: 'none' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V8l7-5 7 5v13" /><path d="M9 21v-4h6v4" /></svg>
        </a>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b9aecb" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} className="pill-input static" type="search" placeholder="Buscar escola ou técnico…" aria-label="Buscar avaliação" />
        <span className="mun-combo" onClick={(e) => e.stopPropagation()}>
          <button className="mun-btn" onClick={() => setDropOpen((o) => !o)} aria-haspopup="listbox" title="Filtrar por município">
            <span>{munName ? `Município: ${munName}` : 'Município: todos'}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <span className={'mun-drop glass' + (dropOpen ? '' : ' hidden')}>
            <input value={munQ} onChange={(e) => setMunQ(e.target.value)} type="search" placeholder="Buscar município…" aria-label="Buscar município" />
            <span className="mun-list" role="listbox">
              {[{ ibge: '', nome: 'Todos os municípios' }, ...munList].map((m) => (
                <button key={m.ibge || 'all'} className={'mun-opt' + (m.ibge === ibge ? ' active' : '')} onClick={() => { setIbge(m.ibge); setDropOpen(false) }}>
                  {m.nome} {m.ibge !== '' && <small style={{ opacity: .6 }}>· {rows.filter((r) => r.ibge === m.ibge).length}</small>}
                </button>
              ))}
              {!munList.length && <span className="mun-empty">Nada encontrado</span>}
            </span>
          </span>
        </span>
        <span className="apps-combo" onClick={(e) => e.stopPropagation()}>
          <button className={'pill-btn' + (menuOpen ? ' active' : '')} onClick={() => setMenuOpen((o) => !o)} aria-haspopup="true" aria-expanded={menuOpen} aria-label="Mostrar opções" data-tip="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="5" r="1.8" /><circle cx="12" cy="5" r="1.8" /><circle cx="19" cy="5" r="1.8" /><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /><circle cx="5" cy="19" r="1.8" /><circle cx="12" cy="19" r="1.8" /><circle cx="19" cy="19" r="1.8" /></svg>
          </button>
        </span>
      </nav>

      <div className="tcontent">
        <h1>Painel logístico</h1>
        <p className="tsub">{filtered.length} avaliação(ões) {munName ? `· ${munName}` : '· todos os municípios'} · {rows.length} no total</p>

        <div className="log-kpis">
          <div className="card tcard in log-kpi"><b>{kpis.hoje}</b><span>hoje</span></div>
          <div className="card tcard in log-kpi"><b>{kpis.semana}</b><span>próx. 7 dias</span></div>
          <div className="card tcard in log-kpi"><b>{kpis.agendados}</b><span>agendados / em rota</span></div>
          <div className="card tcard in log-kpi ok"><b>{kpis.concluidos}</b><span>concluídos</span></div>
        </div>

        <div className="log-filters">
          {[{ id: 'todos', label: 'Todas' }, ...STATUS].map((s) => (
            <button key={s.id} className={'filter-chip' + (status === s.id ? ' active' : '')} onClick={() => setStatus(s.id)}>{s.label}</button>
          ))}
          {tecnicos.length > 0 && <span className="log-hint">{tecnicos.length} técnico(s) em campo</span>}
        </div>

        <div className="school-grid log-grid">
          {!loaded && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="card tcard skel"><div className="skel-line" /><div className="skel-line short" /></div>)}
          {loaded && filtered.map((r) => {
            const esc = escByInep[r.inep]
            const isToday = r.data === todayISO()
            return (
              <div key={r.id} className={'card in tcard log-card st-' + r.status}>
                <div className="log-top">
                  <div className={'log-date' + (isToday ? ' today' : '')}>
                    <b>{fmtDate(r.data)}</b>
                    <span>{weekday(r.data)}{isToday ? ' · hoje' : ''} · {r.periodo}</span>
                  </div>
                  <span className={'log-status ' + r.status}>{statusLabel(r.status)}</span>
                </div>
                <h4>{esc?.nome || `INEP ${r.inep}`}</h4>
                <p>{munByIbge[r.ibge]?.nome || munByIbge[esc?.ibge]?.nome || '—'} · INEP {r.inep}{esc?.alunos != null ? ` · ${esc.alunos} alunos` : ''}</p>
                <div className="log-tech">
                  <i className="tech-avatar">{initials(r.tecnico)}</i>
                  <div><b>{r.tecnico}</b><span>técnico responsável</span></div>
                </div>
                {r.observacao && <p className="log-obs">{r.observacao}</p>}
                <div className="row-actions">
                  <a className="mini-btn go" href={`/index.html?inep=${r.inep}`}>Ver no mapa</a>
                  {r.status !== 'concluido' && <button className="mini-btn ok" onClick={() => onQuickStatus(r.id, 'concluido')}>Concluir</button>}
                  <button className="mini-btn" onClick={() => onEdit(r)}>Editar</button>
                  <button className="mini-btn danger" onClick={() => onDel(r.id)}>Excluir</button>
                </div>
              </div>
            )
          })}
          {loaded && !filtered.length && <div className="card in tcard"><h4>Nenhuma avaliação</h4><p>Ajuste os filtros ou agende abaixo.</p></div>}
        </div>

        <button className="btn new-school" type="button" onClick={() => { setForm(emptyForm); setFormIbge(ibge || ''); setMsg(''); setShowForm((s) => !s) }}>
          {showForm ? '− Fechar agendamento' : '+ Nova avaliação'}
        </button>
        {showForm && (
          <form id="log-form" className="form reg-form tcard" onSubmit={onSave}>
            <h3>{form.id ? 'Editar avaliação' : 'Nova avaliação'}</h3>
            <div className="grid2">
              <label>Município
                <select value={formIbge} onChange={(e) => { setFormIbge(e.target.value); setForm({ ...form, inep: '' }) }}>
                  <option value="">Todos / escolher escola direto</option>
                  {muns.map((m) => <option key={m.ibge} value={m.ibge}>{m.nome}</option>)}
                </select>
              </label>
              <label>Escola
                <select value={form.inep} onChange={(e) => setForm({ ...form, inep: e.target.value })}>
                  <option value="">Selecione…</option>
                  {formEscolas.map((e) => <option key={e.inep} value={e.inep}>{e.nome} · {e.inep}</option>)}
                </select>
              </label>
              <label>Dia da avaliação<input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></label>
              <label>Período<select value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.target.value })}>{PERIODOS.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label>Técnico responsável<input value={form.tecnico} onChange={(e) => setForm({ ...form, tecnico: e.target.value })} placeholder="Ex.: Carlos Silva" list="log-tecs" /></label>
              <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            </div>
            <datalist id="log-tecs">{tecnicos.map((t) => <option key={t} value={t} />)}</datalist>
            <label>Observação<textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Roteiro, material, contato da escola…" rows={2} style={{ padding: 10, border: '1px solid var(--line)', background: '#000', color: '#fff', borderRadius: 8, fontSize: 14 }} /></label>
            <div className="row-actions" style={{ display: 'flex', gap: 8 }}>
              <button className="btn" type="submit">{form.id ? 'Salvar edição' : 'Agendar'}</button>
              <button className="mini-btn" type="button" onClick={() => { setForm(emptyForm); setMsg('') }}>Limpar</button>
            </div>
            <div className="reg-msg">{msg}</div>
          </form>
        )}
      </div>
    </div>
  )
}
createRoot(document.getElementById('log-app')).render(<App />)
