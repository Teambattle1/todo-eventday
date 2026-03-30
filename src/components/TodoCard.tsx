import { useMemo } from 'react'
import type { Employee, Todo } from '../lib/types'
import { decodeHtmlEntities, getPriorityColor, isOverdue, parseDescription } from '../lib/utils'
import PriorityBadge from './PriorityBadge'
import AvatarInitials from './AvatarInitials'
import DueDateBadge from './DueDateBadge'
import { MapPin, AlertTriangle } from 'lucide-react'

interface Props {
  todo: Todo
  employee?: Employee
}

export default function TodoCard({ todo, employee }: Props) {
  const overdue = isOverdue(todo.due_date)
  const isHaster = todo.priority === 'HASTER'
  const color = getPriorityColor(todo.priority)
  const parsed = useMemo(() => parseDescription(todo.description), [todo.description])
  const title = decodeHtmlEntities(todo.title)

  return (
    <div
      className={`
        relative rounded-xl border transition-all duration-200
        ${overdue ? 'bg-red-500/5 border-red-500/20' : 'bg-[var(--bg-card)] border-[var(--border)]'}
        ${isHaster ? 'animate-pulse-glow' : ''}
        hover:border-[var(--border-light)] hover:bg-[var(--bg-card-hover)]
        animate-slide-in
      `}
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="p-4">
        {/* Header: title + avatar */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 flex-1">
            {todo.is_error && (
              <AlertTriangle className="inline w-3.5 h-3.5 mr-1.5 text-red-400 -mt-0.5" />
            )}
            {title}
          </h3>
          {employee && (
            <AvatarInitials name={employee.navn} id={employee.id} size={28} />
          )}
        </div>

        {/* Beskrivelse */}
        {parsed.text && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 leading-relaxed">
            {parsed.text}
          </p>
        )}

        {/* Footer: badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={todo.priority} />
          <DueDateBadge dueDate={todo.due_date} />
          {(todo.geo_address || todo.location) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <MapPin className="w-3 h-3" />
              {todo.geo_address || todo.location}
            </span>
          )}
        </div>

        {/* Assigned person name */}
        {employee && (
          <div className="mt-2 text-[10px] text-[var(--text-muted)] font-medium">
            {employee.navn}
            {employee.location && (
              <span className="ml-1 opacity-60">({employee.location})</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
