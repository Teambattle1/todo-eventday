import { useMemo, useState } from 'react'
import type { Employee, Todo } from '../lib/types'
import { decodeHtmlEntities, parseDescription } from '../lib/utils'
import AvatarInitials from './AvatarInitials'
import { Lightbulb, ExternalLink } from 'lucide-react'

interface Props {
  todo: Todo
  employee?: Employee
}

export default function IdeaCard({ todo, employee }: Props) {
  const parsed = useMemo(() => parseDescription(todo.description), [todo.description])
  const title = decodeHtmlEntities(todo.title)
  const [imgError, setImgError] = useState(false)

  return (
    <div className="relative rounded-xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--border-light)] hover:bg-[var(--bg-card-hover)] transition-all duration-200 animate-slide-in overflow-hidden">
      <div className="flex">
        {/* Thumbnail */}
        {parsed.image && !imgError ? (
          <div className="w-24 h-24 shrink-0 bg-[var(--bg-elevated)]">
            <img
              src={parsed.image}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          </div>
        ) : (
          <div className="w-24 h-24 shrink-0 bg-[var(--bg-elevated)] flex items-center justify-center">
            <Lightbulb className="w-8 h-8 text-[var(--text-muted)] opacity-40" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 flex-1">
              {title}
            </h3>
            {employee && (
              <AvatarInitials name={employee.navn} id={employee.id} size={24} />
            )}
          </div>

          {parsed.text && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2 leading-relaxed">
              {parsed.text}
            </p>
          )}

          <div className="flex items-center gap-2">
            {parsed.tags && parsed.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {parsed.tags.slice(0, 3).map((tag, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {parsed.url && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--text-muted)]">
                <ExternalLink className="w-3 h-3" />
                Link
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
