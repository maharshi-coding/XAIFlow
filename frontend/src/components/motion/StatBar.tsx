import { useLayoutEffect, useRef } from 'react';
import { ensureScrollTrigger, gsap, prefersReducedMotion } from './motion';

/**
 * Horizontal progress bar whose fill grows from zero to its value the first
 * time it scrolls into view. Reduced motion (and jsdom under test) renders the
 * final width immediately, so the bar always reflects the real metric.
 */
export function StatBar({
  value,
  tone = 'teal',
  delay = 0,
}: {
  /** Fraction filled, 0–1. */
  value: number;
  tone?: 'teal' | 'amber' | 'red' | 'muted';
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const pct = `${(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100).toFixed(1)}%`;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.width = pct;
      return;
    }
    ensureScrollTrigger();
    const context = gsap.context(() => {
      gsap.fromTo(
        el,
        { width: '0%' },
        {
          width: pct,
          duration: 1.1,
          delay,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 96%', once: true },
        },
      );
    }, el);
    return () => context.revert();
  }, [pct, delay]);

  return (
    <span className={`stat-bar stat-bar-${tone}`}>
      <span ref={ref} className="stat-bar-fill" style={{ width: 0 }} />
    </span>
  );
}
