// Oruinwan AI's face for its button: two eyes that look toward where you touch (or point), and
// blink now and then, plus a mood (aiMood.js): happy, surprised, sad, tongue out, sleepy. Scrolling
// makes it glance up or down. Still when the system asks for reduced motion.
import { useEffect, useRef } from 'react';
import { useAiMood } from './aiMood.js';

// The mouth for each mood (24-unit drawing; the eyes sit around y 13).
const MOUTH = {
  idle: 'M10.4 20.2 Q12 21.1 13.6 20.2',
  happy: 'M9.4 19.4 Q12 22.6 14.6 19.4',
  surprised: null, // a little "o", drawn as a circle
  sad: 'M9.8 21.4 Q12 19.4 14.2 21.4',
  tongue: 'M9.4 19.4 Q12 22.6 14.6 19.4',
  sleepy: 'M10.8 20.6 L13.2 20.6',
};

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

export function AiEyes({ size = 24, mood: fixedMood = null }) {
  const live = useAiMood((st) => st.mood);
  const glance = useAiMood((st) => st.glance);
  const mood = fixedMood || live;
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

  const happy = mood === 'happy' || mood === 'tongue';
  const wide = mood === 'surprised';
  // Eyes move up a little to make room for the mouth; a glance shifts the pupils with a scroll.
  const ey = 11.6;
  const ry = wide ? 4.6 : mood === 'sleepy' ? 1.6 : 3.8;
  const pupil = wide ? 1.3 : 1.7;
  const gy = glance * 1.4;
  return (
    <svg ref={face} width={size} height={size} viewBox="0 0 24 24" aria-hidden data-testid="ai-eyes" data-mood={mood}>
      {/* A little sparkle above, so it still reads as "AI". */}
      <path d="M19.2 2.2l.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55z" fill="currentColor" opacity="0.85" />
      {mood === 'sad' && (
        <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <path d="M5.2 6.6 L9.6 5.6" />
          <path d="M14.4 5.6 L18.8 6.6" />
        </g>
      )}
      <g ref={lids} style={{ transformOrigin: `12px ${ey}px`, transformBox: 'view-box' }}>
        {happy ? (
          // ^ ^ eyes
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d={`M5 ${ey + 1} Q8 ${ey - 3} 11 ${ey + 1}`} />
            <path d={`M13 ${ey + 1} Q16 ${ey - 3} 19 ${ey + 1}`} />
          </g>
        ) : (
          <>
            <ellipse cx="8" cy={ey} rx="3.6" ry={ry} fill="var(--surface, #fff)" stroke="currentColor" strokeWidth="1.4" />
            <ellipse cx="16" cy={ey} rx="3.6" ry={ry} fill="var(--surface, #fff)" stroke="currentColor" strokeWidth="1.4" />
          </>
        )}
        <g style={{ transform: `translateY(${gy}px)`, transition: 'transform 200ms ease-out', opacity: happy || mood === 'sleepy' ? 0 : 1 }}>
          <circle ref={left} cx="8" cy={ey + 0.4} r={pupil} fill="currentColor" style={{ transition: 'none' }} />
          <circle ref={right} cx="16" cy={ey + 0.4} r={pupil} fill="currentColor" style={{ transition: 'none' }} />
        </g>
      </g>
      {mood === 'surprised' ? (
        <ellipse cx="12" cy="20.4" rx="1.3" ry="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      ) : (
        <path d={MOUTH[mood] || MOUTH.idle} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      )}
      {mood === 'tongue' && <path d="M11 20.9 Q12 23.6 13 20.9 Z" fill="#e8798b" stroke="currentColor" strokeWidth="0.6" />}
      {mood === 'sleepy' && (
        <text x="18.6" y="9" fontSize="4.6" fontWeight="700" fill="currentColor" opacity="0.8">z</text>
      )}
    </svg>
  );
}
