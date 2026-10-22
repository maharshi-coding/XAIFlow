import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { ensureScrollTrigger, gsap, prefersReducedMotion } from './motion';

/**
 * Scroll-reveal wrapper. Children fade and slide into place the first time the
 * element enters the viewport. Reusable across any page section.
 */
export function Reveal({
  children,
  className,
  y = 24,
  delay = 0,
  duration = 0.6,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return;
    ensureScrollTrigger();
    const context = gsap.context(() => {
      gsap.from(element, {
        opacity: 0,
        y,
        duration,
        delay,
        ease: 'power2.out',
        scrollTrigger: { trigger: element, start: 'top 85%', once: true },
      });
    }, element);
    return () => context.revert();
  }, [y, delay, duration]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
