import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './print.css'
import App from './App.tsx'

// 버튼을 누른 자리에서 물결이 퍼지는 효과 (움직임 줄이기 설정이면 건너뜀)
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.addEventListener('pointerdown', (e) => {
    const btn = (e.target as Element | null)?.closest<HTMLElement>('[data-slot="button"]')
    if (!btn || btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true') return
    const r = btn.getBoundingClientRect()
    const size = Math.max(r.width, r.height) * 2
    const dot = document.createElement('span')
    dot.className = 'btn-ripple'
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
    btn.appendChild(dot)
    dot.addEventListener('animationend', () => dot.remove())
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
