import { useEffect, useRef } from 'react'

/**
 * Adds `is-in` to every element with [data-reveal] inside the node once it
 * enters the viewport. Content is only ever hidden when JS has mounted AND
 * the browser does not request reduced motion (see landing.css), so nothing
 * can be left blank by a script failure.
 */
export function useReveal() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return

    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    for (const t of targets) observer.observe(t)
    return () => observer.disconnect()
  }, [])

  return rootRef
}
