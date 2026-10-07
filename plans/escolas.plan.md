# Plano — escolas.html (Rede Escolar Detalhe)

- Rota/arquivo: `escolas.html` (MPA input `escolas`)
- data-page: `"escolas"`
- Componentes (React islands): `EscolaCards` (#react-escolas), `EscolaForm` (#react-escola-form), `MiniMap` (#react-minimap)
- Seções e ordem: `header → hero-split (município selecionado via ?ibge= allowlist + breadcrumb cidade→escola) → mini Leaflet + cards escolas → form INEP → footer`
- Tokens 60-30-10 + glass/Apple dessa página:
  - Card por escola com `divIcon` estágio espelhado no mini-mapa; glass modal form
  - Skills 1.x: `1.6`, `1.15`, `1.2-bento-grid-3d-flip`, `1.22`
- Animações 60Hz dessa página:
  - anime.js flip bento + stagger cards; Vivus pin SVG; rAF `IntersectionObserver threshold:0.02` entrada `.in`; polyline cidade→escola animada via `dashOffset` (transform/opacity only); reduced-motion OK
- CRM Escolas (Skill 2.6 + 2.14 ext):
  - Campos: INEP 8 dígitos (regex `^[0-9]{8}$`), nome, turnos, volumetria, lat/lng; query `?ibge=` validada contra allowlist (1.21 armadilha #4); sanitizar tudo
  - Relação: `escolas/{inep}` → `municipios/{ibge}`; `fitBounds` mini-mapa; fallback lista se sem coords
- Assets: mini Leaflet reuse `public/`; fotos escolas `loading="lazy"`, `preload="none"` se vídeo
- SEO/OG/JSON-LD: title dinâmico "Escolas — {Município}", JSON-LD `School` + `BreadcrumbList`
- Critério de pronto: INEP inválido bloqueado, "Pão de Açúcar" OK, offline lista cache, FPS ≥55 flip + mapa, LCP <2.5s
- Skills citadas: `1.6, 1.15, 1.2, 1.22, 1.16, 1.21` + `2.6, 2.14, 2.9`
