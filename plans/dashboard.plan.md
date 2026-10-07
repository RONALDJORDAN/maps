# Plano — dashboard.html (KPIs Executivo)

- Rota/arquivo: `dashboard.html` (MPA input `dashboard`)
- data-page: `"dashboard"`
- Componentes (React islands): `KpiCards` (#react-kpis), `ChartsPanel` (#react-charts), `ReportBuilder` (#react-report)
- Seções e ordem: `header → hero KPIs (Disponíveis/Em Uso/Manutenção + cobertura escolar) → charts Chart.js → report builder → footer`
- Tokens 60-30-10 + glass/Apple dessa página:
  - KPI cards glass com número animado (count-up transform); charts temáticos 60-30-10
  - Skills 1.x: `1.6`, `1.13-gsap-scroll-animations (só complemento)`, `1.16`
- Animações 60Hz dessa página:
  - anime.js count-up + stagger KPI; Chart.js `animation.duration:700 easing:'easeOutQuart'`; rAF game-loop 5.9 para atualização realtime sem jank; Vivus em ícones KPI; reduced-motion desliga count-up
- Dashboard (Skill 2.7 + 2.10 + 2.19):
  - Agregação em memória de `municipios + escolas` (fórmulas Disponíveis/Em Uso/Manutenção adaptadas p/ Contratos/Escolas Ativas/Volumetria); `onValue` realtime; Chart.js 4.4.1 barras/pizza/linha
  - Report Builder XLSX/CSV/PDF (2.19) + jsPDF A4 (1.23) com fallback print
- Assets: chart.js CDN; sem Leaflet pesado; lazy tudo fora hero
- SEO/OG/JSON-LD: title "Dashboard — KPIs Rede Escolar", JSON-LD `Dashboard` + `DataCatalog`
- Critério de pronto: KPIs batem com mock, charts 60fps, export XLSX/CSV/PDF OK, FPS ≥55, feliz + borda OK
- Skills citadas: `1.6, 1.13, 1.16, 1.21, 1.23` + `2.7, 2.10, 2.19, 2.9`
