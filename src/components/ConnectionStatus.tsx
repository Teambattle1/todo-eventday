interface Props {
  connected: boolean
}

export default function ConnectionStatus({ connected }: Props) {
  return (
    <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)]">
      <span
        className={`w-2 h-2 rounded-full ${
          connected
            ? 'bg-emerald-400'
            : 'bg-red-400 animate-pulse-dot'
        }`}
      />
      <span className="text-[10px] text-[var(--text-muted)] font-medium uppercase tracking-wider">
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  )
}
