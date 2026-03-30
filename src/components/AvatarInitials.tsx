import { getInitials, hashColor } from '../lib/utils'

interface Props {
  name: string
  id: string
  size?: number
}

export default function AvatarInitials({ name, id, size = 32 }: Props) {
  const initials = getInitials(name)
  const bg = hashColor(id)

  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: bg,
      }}
      title={name}
    >
      {initials}
    </div>
  )
}
