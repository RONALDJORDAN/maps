# Plano — logistica.html (Painel Logístico)

- Rota/arquivo: `logistica.html` (MPA input `logistica`)
- data-page: `"logistica"`
- Componentes (React island): `LogisticaApp` (#log-app) em `src/logistica.jsx`
- Seções e ordem: `pill-menu (mapa / escolas / busca escola-técnico / combo município) → hero KPIs (hoje / próx. 7 dias / agendados-em-rota / concluídos) → filtros status → grid cards → form agendamento → fundo satélite`
- Card logístico:
  - Topo: `dia da avaliação (dd/mm + weekday + período)` + badge `status (agendado/em_rota/concluido/remarcar)`
  - Meio: `nome da escola`, `município · INEP · alunos`
  - Técnico: `avatar iniciais + nome do responsável`
  - Ações: `Ver no mapa (?inep=) / Concluir / Editar / Excluir`
- Dados: `public/data/logistica.json` seed (id, inep FK, ibge, data ISO, periodo, tecnico, status, observacao) + `localStorage logistica-store-v1`; escolas/municípios via fetch para nome + filtro
- Form: município → escola filtrada, data (date), período, técnico (datalist), status, observação; validações escola/data/técnico
- Tokens/animação: mesmo glass/Apple de escolas (`tmap`, `tcard`, anime stagger 35ms, reduced-motion OK)
- Critério de pronto: build vite OK, `dist/logistica.html` gerado, busca sem acento OK, CRUD persiste, link mapa funciona
