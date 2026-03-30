import type { ReactNode } from 'react'

interface Props {
  title: string
  count: number
  color?: string
  children: ReactNode
}

export default function TodoGroup({ title, count, color, children }: Props) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-1">
        {color && (
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: color }}
          />
        )}
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </h2>
        <span className="text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}
