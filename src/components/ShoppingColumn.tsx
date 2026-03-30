import { useState } from 'react'
import type { ShoppingItem } from '../lib/types'
import { ShoppingCart, Plus, Trash2, ExternalLink, Check } from 'lucide-react'

interface Props {
  items: ShoppingItem[]
  loading: boolean
  onAdd: (title: string, note?: string, url?: string) => Promise<any>
  onToggle: (id: string, purchased: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function ShoppingColumn({ items, loading, onAdd, onToggle, onDelete }: Props) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const pending = items.filter(i => !i.purchased)
  const purchased = items.filter(i => i.purchased)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    await onAdd(title.trim(), note.trim() || undefined, url.trim() || undefined)
    setTitle('')
    setNote('')
    setUrl('')
    setShowForm(false)
    setSubmitting(false)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-5 pb-2 border-b border-[var(--border)]">
        <ShoppingCart className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">
          Indkøb
        </span>
        <span className="text-xs text-[var(--text-muted)]">({pending.length})</span>
        <button
          onClick={() => setShowForm(f => !f)}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Tilføj
        </button>
      </div>

      {/* Tilføj formular */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
          <input
            type="text"
            placeholder="Hvad skal købes?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-emerald-500/50 mb-2"
          />
          <input
            type="text"
            placeholder="Note (valgfrit)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-emerald-500/50 mb-2"
          />
          <input
            type="url"
            placeholder="Link (valgfrit)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-emerald-500/50 mb-3"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition-colors cursor-pointer"
            >
              {submitting ? 'Tilføjer...' : 'Tilføj'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer"
            >
              Annuller
            </button>
          </div>
        </form>
      )}

      {/* Aktive indkøb */}
      {pending.length === 0 && !loading ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Ingen indkøb på listen</p>
        </div>
      ) : (
        <div className="space-y-2 mb-5">
          {pending.map(item => (
            <ShoppingItemCard
              key={item.id}
              item={item}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Købte items */}
      {purchased.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Købt ({purchased.length})
            </span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
          <div className="space-y-1.5 opacity-50">
            {purchased.map(item => (
              <ShoppingItemCard
                key={item.id}
                item={item}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ShoppingItemCard({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem
  onToggle: (id: string, purchased: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <div
      className={`
        flex items-start gap-3 p-3 rounded-xl border transition-all duration-200
        ${item.purchased
          ? 'bg-[var(--bg-card)]/50 border-[var(--border)]'
          : 'bg-[var(--bg-card)] border-emerald-500/20 hover:border-emerald-500/40'
        }
      `}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item.id, !item.purchased)}
        className={`
          mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all cursor-pointer
          ${item.purchased
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-emerald-500/40 hover:border-emerald-500'
          }
        `}
      >
        {item.purchased && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${item.purchased ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>
          {item.title}
          {item.quantity > 1 && (
            <span className="ml-1.5 text-xs text-emerald-400 font-bold">x{item.quantity}</span>
          )}
        </div>
        {item.note && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">{item.note}</p>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400/70 hover:text-emerald-400 mt-0.5"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />
            Link
          </a>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(item.id)}
        className="shrink-0 p-1 rounded-md text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
        style={{ opacity: 0.4 }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
