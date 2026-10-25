// Oruinwan AI's face for its button: two eyes that look toward where you touch (or point), and
// blink now and then. Still when the system asks for reduced motion.
import { useEffect, useRef } from 'react';

const MAX_LOOK = 2.4; // how far the pupils move (in the 24-unit drawing)

/** Where the pupils should sit for a touch at (px, py), given the face's centre (cx, cy). */
export function lookOffset(cx, cy, px, py, max = MAX_LOOK) {
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.hypot(dx, dy);
  if (!dist) return { x: 0, y: 0 };
  const k = Math.min(1, dist / 160) * max;
  return { x: (dx / dist) * k, y: (dy / dist) * k };
}

export function AiEyes({ size = 24 }) {
  const face = useRef(null);
  const left = useRef(null);
  const right = useRef(null);
  const lids = useRef(null);

  useEffect(() => {
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (still) return undefined;
    let frame = 0;
    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let idleTimer = null;
    const move = () => {
      frame = 0;
      current = { x: current.x + (target.x - current.x) * 0.35, y: current.y + (target.y - current.y) * 0.35 };
      const t = `translate(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px)`;
      if (left.current) left.current.style.transform = t;
      if (right.current) right.current.style.transform = t;
      if (Math.abs(target.x - current.x) > 0.05 || Math.abs(target.y - current.y) > 0.05) frame = requestAnimationFrame(move);
    };
    const look = (e) => {
      const el = face.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = e.touches?.[0] || e;
      const scale = 24 / Math.max(r.width, 1);
      const off = lookOffset(r.left + r.width / 2, r.top + r.height / 2, p.clientX, p.clientY);
      target = { x: off.x, y: off.y };
      if (!frame) frame = requestAnimationFrame(move);
      // After a while without touches, look back at the person.
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        target = { x: 0, y: 0 };
        if (!frame) frame = requestAnimationFrame(move);
      }, 2500 * scale + 1500);
    };
    window.addEventListener('pointerdown', look, { passive: true });
    window.addEventListener('pointermove', look, { passive: true });
    // A blink every few seconds.
    const blink = setInterval(() => {
      const el = lids.current;
      if (!el) return;
      el.animate?.([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.1)' }, { transform: 'scaleY(1)' }], { duration: 180, easing: 'ease-in-out' });
    }, 4800);
    return () => {
      window.removeEventListener('pointerdown', look);
      window.removeEventListener('pointermove', look);
      cancelAnimationFrame(frame);
      clearTimeout(idleTimer);
      clearInterval(blink);
    };
  }, []);

  return (
    <svg ref={face} width={size} height={size} viewBox="0 0 24 24" aria-hidden data-testid="ai-eyes">
      {/* A little sparkle above, so it still reads as "AI". */}
      <path d="M19.2 2.2l.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55z" fill="currentColor" opacity="0.85" />
      <g ref={lids} style={{ transformOrigin: '12px 13px', transformBox: 'view-box' }}>
        <ellipse cx="8" cy="13" rx="3.6" ry="4.4" fill="var(--surface, #fff)" stroke="currentColor" strokeWidth="1.4" />
        <ellipse cx="16" cy="13" rx="3.6" ry="4.4" fill="var(--surface, #fff)" stroke="currentColor" strokeWidth="1.4" />
        <circle ref={left} cx="8" cy="13.4" r="1.8" fill="currentColor" style={{ transition: 'none' }} />
        <circle ref={right} cx="16" cy="13.4" r="1.8" fill="currentColor" style={{ transition: 'none' }} />
      </g>
    </svg>
  );
}
