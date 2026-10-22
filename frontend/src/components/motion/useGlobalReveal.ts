import { useLayoutEffect } from 'react';
import { ensureScrollTrigger, gsap, prefersReducedMotion } from './motion';

/**
 * Applies a batched scroll-reveal to the major blocks of whichever page is
 * mounted, re-running whenever the route changes. This gives every screen a
 * consistent entrance without each page wiring its own animation. Disabled
 * under reduced motion / in tests, where it is a no-op.
 */
const SELECTOR = [
  '.main-content .metric',
  '.main-content .card',
  '.main-content .overview-hero',
  '.main-content .deployment-card',
  '.main-content .project-card',
  '.main-content .evaluation-metrics',
  '.main-content .run-panel',
  '.main-content .backup-banner',
  '.main-content .resource-summary',
  '.main-content .workspace-banner',
].join(', ');

export function useGlobalReveal(routeKey: string) {
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const scrollTrigger = ensureScrollTrigger();
    let context: ReturnType<typeof gsap.context> | undefined;
    // Wait one frame so a freshly routed (lazy) page has painted its content.
    const raf = requestAnimationFrame(() => {
      context = gsap.context(() => {
        const targets = gsap.utils.toArray<HTMLElement>(SELECTOR);
        if (!targets.length) return;
        gsap.set(targets, { opacity: 0, y: 22 });
        scrollTrigger.batch(targets, {
          start: 'top 90%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.55,
              ease: 'power2.out',
              stagger: 0.08,
              overwrite: true,
              clearProps: 'transform',
            }),
        });
        scrollTrigger.refresh();
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      context?.revert();
    };
  }, [routeKey]);
}
