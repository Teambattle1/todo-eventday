import { getPriorityColor, getPriorityLabel } from '../lib/utils'

interface Props {
  priority: string | null
}

export default function PriorityBadge({ priority }: Props) {
  const color = getPriorityColor(priority)
  const label = getPriorityLabel(priority)

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: `${color}18`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  )
}
