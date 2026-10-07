# Plano — municipios.html (CRM Municípios)

- Rota/arquivo: `municipios.html` (MPA input `municipios`)
- data-page: `"municipios"`
- Componentes (React islands): `MunicipioTable` (#react-municipios), `MunicipioWizard` (#react-municipio-form), `ImportXlsx` (#react-import)
- Seções e ordem: `header → hero-compacto (KPIs: Total Municípios / Contratos Ativos / Volumetria Alocada) → filtro + tabela virtualizada → wizard form → footer`
- Tokens 60-30-10 + glass/Apple dessa página:
  - Mesmos tokens 1.6; tabela glass rows hover `.apple-hover`; status pills por estágio contrato
  - Skills 1.x: `1.6`, `1.14`, `1.22-react-form-wizard-local`, `1.12-grid-modulos-animado`
- Animações 60Hz dessa página:
  - anime.js stagger linhas tabela; Vivus em ícones SVG status; rAF scroll tabela virtualizada (só transform); `prefers-reduced-motion` OK
  - Transições `--transition-premium:0.7s / --transition-slow:0.5s cubic-bezier(.22,1,.36,1)`
- CRM (Skill 2.6 + 2.9 + 2.11):
  - Campos: nome, UF, IBGE, contrato, turnos, volumetria alocada; validação trim + anti-XSS; máscara IBGE; teste "Pão de Açúcar" + vazio + offline
  - CRUD `push/set/update/remove + onValue` em `municipios/` (mock localStorage agora, RTDB depois); toast + `logAuditEvent` em toda mutação
  - ETL XLSX (2.11) import lote com preview + rollback
- Assets: sem mapa; imgs lazy; `public/data/municipios.json` seed 5 registros
- SEO/OG/JSON-LD: title "Municípios — CRM Rede Escolar", JSON-LD `GovernmentOrganization` list
- Critério de pronto: build limpo, CRUD feliz + borda OK, toasts/logs sem console.log, FPS ≥55, sem regressão em 2.14
- Skills citadas: `1.6, 1.14, 1.22, 1.12, 1.16, 1.21` + `2.6, 2.9, 2.11, 2.3-auditoria`
