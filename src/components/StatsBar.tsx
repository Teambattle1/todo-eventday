import type { Todo } from '../lib/types'
import { isOverdue, getPriorityColor, PRIORITY_CONFIG } from '../lib/utils'

interface Props {
  todos: Todo[]
}

export default function StatsBar({ todos }: Props) {
  const active = todos.filter(t => !t.resolved)
  const overdueCount = active.filter(t => isOverdue(t.due_date)).length
  const errorCount = active.filter(t => t.is_error).length

  // Tæl pr. prioritet
  const byPriority = new Map<string, number>()
  for (const t of active) {
    const p = t.priority || 'Ingen'
    byPriority.set(p, (byPriority.get(p) || 0) + 1)
  }

  // Sortér efter priority order
  const priorityEntries = Array.from(byPriority.entries())
    .sort((a, b) => {
      const orderA = PRIORITY_CONFIG[a[0]]?.order ?? 50
      const orderB = PRIORITY_CONFIG[b[0]]?.order ?? 50
      return orderA - orderB
    })

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Total aktive */}
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-[var(--text-primary)]">{active.length}</span>
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">aktive</span>
      </div>

      <div className="w-px h-6 bg-[var(--border)]" />

      {/* Overdue */}
      {overdueCount > 0 && (
        <>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse-dot" />
            <span className="text-sm font-semibold text-red-400">{overdueCount}</span>
            <span className="text-xs text-red-400/70">overskredet</span>
          </div>
          <div className="w-px h-6 bg-[var(--border)]" />
        </>
      )}

      {/* Errors */}
      {errorCount > 0 && (
        <>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-sm font-semibold text-amber-400">{errorCount}</span>
            <span className="text-xs text-amber-400/70">fejl</span>
          </div>
          <div className="w-px h-6 bg-[var(--border)]" />
        </>
      )}

      {/* Pr. prioritet */}
      {priorityEntries.map(([priority, count]) => (
        <div key={priority} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: getPriorityColor(priority === 'Ingen' ? null : priority) }}
          />
          <span className="text-sm font-medium text-[var(--text-secondary)]">{count}</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {PRIORITY_CONFIG[priority]?.label || priority}
          </span>
        </div>
      ))}
    </div>
  )
}
