import { isOverdue } from '../lib/utils'

interface Props {
  dueDate: string | null
}

export default function DueDateBadge({ dueDate }: Props) {
  if (!dueDate) return null

  const overdue = isOverdue(dueDate)
  const date = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dateObj = new Date(dueDate)
  dateObj.setHours(0, 0, 0, 0)

  let label: string
  if (dateObj.getTime() === today.getTime()) {
    label = 'I dag'
  } else if (dateObj.getTime() === tomorrow.getTime()) {
    label = 'I morgen'
  } else {
    label = date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  }

  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/25">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-dot" />
        Overskredet - {label}
      </span>
    )
  }

  const isToday = dateObj.getTime() === today.getTime()

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        isToday
          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25'
          : 'bg-white/5 text-[var(--text-muted)] border border-white/5'
      }`}
    >
      {label}
    </span>
  )
}
