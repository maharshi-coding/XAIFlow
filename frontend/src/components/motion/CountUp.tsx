import { useLayoutEffect, useRef } from 'react';
import { ensureScrollTrigger, gsap, prefersReducedMotion } from './motion';

function formatValue(value: number, decimals: number, prefix: string, suffix: string): string {
  return `${prefix}${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

/**
 * Animated numeric counter. The value tweens up from zero the first time it
 * scrolls into view; with reduced motion it renders the final value instantly.
 * Text content is written imperatively so the count stays crisp per frame.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1.4,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const target = Number.isFinite(value) ? value : 0;
    if (prefersReducedMotion()) {
      element.textContent = formatValue(target, decimals, prefix, suffix);
      return;
    }
    ensureScrollTrigger();
    element.textContent = formatValue(0, decimals, prefix, suffix);
    const counter = { current: 0 };
    const context = gsap.context(() => {
      gsap.to(counter, {
        current: target,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          if (ref.current) {
            ref.current.textContent = formatValue(counter.current, decimals, prefix, suffix);
          }
        },
        scrollTrigger: { trigger: element, start: 'top 92%', once: true },
      });
    }, element);
    return () => context.revert();
  }, [value, decimals, prefix, suffix, duration]);
  return <span ref={ref} className="count-up" />;
}
