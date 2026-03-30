import { useEffect, useRef, useCallback } from 'react'

export function useAutoScroll(enabled = true, speed = 0.5) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const pausedRef = useRef(false)
  const directionRef = useRef<'down' | 'up'>('down')
  const pauseTimeoutRef = useRef<number>(0)
  const idleTimeoutRef = useRef<number>(0)
  const lastTimeRef = useRef(0)

  const pause = useCallback((duration: number) => {
    pausedRef.current = true
    clearTimeout(pauseTimeoutRef.current)
    pauseTimeoutRef.current = window.setTimeout(() => {
      pausedRef.current = false
    }, duration)
  }, [])

  useEffect(() => {
    if (!enabled) return

    const container = containerRef.current
    if (!container) return

    const onInteract = () => {
      pausedRef.current = true
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = window.setTimeout(() => {
        pausedRef.current = false
      }, 30000)
    }

    container.addEventListener('mousemove', onInteract)
    container.addEventListener('touchstart', onInteract)

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time
      const delta = time - lastTimeRef.current
      lastTimeRef.current = time

      if (!pausedRef.current && container) {
        const maxScroll = container.scrollHeight - container.clientHeight

        if (maxScroll <= 0) {
          // Indhold passer i viewport, intet scroll nødvendigt
        } else if (directionRef.current === 'down') {
          container.scrollTop += speed * (delta / 16)
          if (container.scrollTop >= maxScroll - 1) {
            directionRef.current = 'up'
            pause(5000)
          }
        } else {
          container.scrollTop -= speed * 2 * (delta / 16)
          if (container.scrollTop <= 0) {
            directionRef.current = 'down'
            pause(5000)
          }
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    // Start efter 10 sekunders initial delay
    const startTimeout = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate)
    }, 10000)

    return () => {
      clearTimeout(startTimeout)
      clearTimeout(pauseTimeoutRef.current)
      clearTimeout(idleTimeoutRef.current)
      cancelAnimationFrame(rafRef.current)
      container.removeEventListener('mousemove', onInteract)
      container.removeEventListener('touchstart', onInteract)
    }
  }, [enabled, speed, pause])

  return containerRef
}
