// Shared 60Hz entrance for 404/402 (anime.js + Vivus + rAF parallax transform-only)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
document.querySelectorAll('svg.draw').forEach((svg) => {
  try { new Vivus(svg, { type: 'delayed', duration: 120, start: 'autostart' }) } catch {}
})
if (!reduced && window.anime) {
  window.anime({ targets: '.apple-stagger-item', translateY: [20, 0], opacity: [0, 1], duration: 700, easing: 'cubicBezier(.22,1,.36,1)' })
  // parallax sutil do card com o mouse (só transform)
  const card = document.querySelector('.err-card')
  let tx = 0, ty = 0, cx = 0, cy = 0
  window.addEventListener('mousemove', (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 10
    ty = (e.clientY / window.innerHeight - 0.5) * 10
  }, { passive: true })
  ;(function loop() {
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08
    if (card) card.style.transform = `translate(${cx.toFixed(2)}px,${cy.toFixed(2)}px)`
    requestAnimationFrame(loop)
  })()
}
// 404: mostra URL ruim + busca redireciona p/ mapa com ?q=
const bad = document.getElementById('bad-url')
if (bad) bad.textContent = location.pathname + location.search
const go = document.getElementById('err-go')
go?.addEventListener('click', () => {
  const q = document.getElementById('err-q')?.value.trim() || ''
  sessionStorage.setItem('mapa-escolar-q', q)
  location.href = '/index.html'
})
