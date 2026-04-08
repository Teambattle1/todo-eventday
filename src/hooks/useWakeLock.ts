import { useEffect, useRef } from 'react'

export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    const request = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      } catch {
        // Wake lock request failed (e.g. low battery)
      }
    }

    request()

    // Re-acquire on visibility change (wake lock releases when tab hidden)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') request()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      wakeLockRef.current?.release()
    }
  }, [])
}
