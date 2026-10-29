import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ensureScrollTrigger, gsap, prefersReducedMotion } from './motion';

const TONE_FILL: Record<string, string> = {
  teal: '#0c9a8b',
  amber: '#c98a24',
  red: '#bf493c',
};

/**
 * Animated circular progress gauge rendered as SVG. The arc sweeps from empty
 * to its target the first time it scrolls into view; under reduced motion (and
 * in tests) it paints the final value instantly. Purely presentational — every
 * value passed in comes from real backend metrics.
 */
export function RadialGauge({
  value,
  size = 118,
  stroke = 10,
  tone = 'teal',
  display,
  caption,
  duration = 1.3,
}: {
  /** Fraction of the ring to fill, 0–1. */
  value: number;
  size?: number;
  stroke?: number;
  tone?: 'teal' | 'amber' | 'red';
  /** Large centre content, e.g. a formatted percentage. */
  display?: ReactNode;
  /** Small label under the centre value. */
  caption?: string;
  duration?: number;
}) {
  const ref = useRef<SVGCircleElement>(null);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.strokeDashoffset = String(offset);
      return;
    }
    ensureScrollTrigger();
    const context = gsap.context(() => {
      gsap.fromTo(
        el,
        { strokeDashoffset: circumference },
        {
          strokeDashoffset: offset,
          duration,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        },
      );
    }, el);
    return () => context.revert();
  }, [circumference, offset, duration]);

  return (
    <div className="radial-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--chart-grid)"
          strokeWidth={stroke}
        />
        <circle
          ref={ref}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TONE_FILL[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="radial-gauge-label">
        <strong>{display}</strong>
        {caption && <span>{caption}</span>}
      </div>
    </div>
  );
}
