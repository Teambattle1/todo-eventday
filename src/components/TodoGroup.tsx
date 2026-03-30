import { type ReactNode, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Props {
  title: string
  count: number
  color?: string
  children: ReactNode
  defaultOpen?: boolean
}

export default function TodoGroup({ title, count, color, children, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className="mb-5 rounded-xl overflow-hidden"
      style={{
        border: `1.5px solid ${color || 'var(--border)'}`,
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none transition-colors hover:bg-[var(--bg-elevated)]"
        style={{
          borderBottom: open ? `1px solid ${color}30` : 'none',
          background: `${color}08`,
        }}
      >
        {open
          ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color }} />
          : <ChevronRight className="w-4 h-4 shrink-0" style={{ color }} />
        }
        {color && (
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: color }}
          />
        )}
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>
          {title}
        </h2>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
          style={{
            background: `${color}18`,
            color: color,
          }}
        >
          {count}
        </span>
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="p-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}
