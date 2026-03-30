import { useEffect, useState } from 'react'

export default function ClockDisplay() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const time = now.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const date = now.toLocaleDateString('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="text-right">
      <div className="text-2xl font-light tracking-wide text-[var(--text-primary)]">
        {time}
      </div>
      <div className="text-xs text-[var(--text-muted)] capitalize">
        {date}
      </div>
    </div>
  )
}
