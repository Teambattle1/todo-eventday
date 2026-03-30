import { useState, useMemo, useEffect, useRef } from 'react'
import { useTodos } from './hooks/useTodos'
import { useEmployees } from './hooks/useEmployees'
import { useShopping } from './hooks/useShopping'
import type { Todo, Employee, ShoppingItem } from './lib/types'
import {
  getPriorityColor, getPriorityOrder, getPriorityLabel,
  isIdeaCategory, getCategoryLabel, parseDescription,
  decodeHtmlEntities, isOverdue, getInitials, hashColor,
} from './lib/utils'
import {
  Plus, Check, Trash2, ChevronDown, ChevronRight, AlertTriangle,
  ShoppingCart, ExternalLink, Clock, MapPin, Calendar, Loader2, X,
  Lightbulb, Flag,
} from 'lucide-react'

// ─── Priority & category configs ───
const PRIORITIES = [
  { value: 'HASTER', label: 'HASTER', color: '#ef4444' },
  { value: 'Vigtigt', label: 'Vigtigt', color: '#f59e0b' },
  { value: 'Normal', label: 'Normal', color: '#3b82f6' },
  { value: 'let', label: 'Let', color: '#22c55e' },
]

const CATEGORY_COLORS: Record<string, string> = {
  'idea-inspiration': '#a78bfa',
  'idea-activity': '#ec4899',
  'idea-company': '#06b6d4',
  'IDEER': '#f59e0b',
}

const DUE_PRESETS = [
  { value: 'today', label: 'I dag' },
  { value: 'tomorrow', label: 'I morgen' },
  { value: 'next_week', label: 'Næste uge' },
]

function computeDueDate(preset: string): string | null {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  if (preset === 'today') return d.toISOString().slice(0, 10)
  if (preset === 'tomorrow') { d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) }
  if (preset === 'next_week') { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10) }
  return null
}

// ─── App ───
export default function App() {
  const { todos, loading, connected, addTodo, updateTodo, deleteTodo } = useTodos()
  const employees = useEmployees()
  const shopping = useShopping()

  const [showAddTodo, setShowAddTodo] = useState(false)
  const [showAddShopping, setShowAddShopping] = useState(false)
  const [overdueAck, setOverdueAck] = useState(false)

  // Overdue items
  const overdueItems = useMemo(() =>
    todos.filter(t => !t.resolved && isOverdue(t.due_date)),
  [todos])

  // Split active todos
  const { taskItems, ideaItems } = useMemo(() => {
    const active = todos.filter(t => !t.resolved)
    const taskItems: Todo[] = []
    const ideaItems: Todo[] = []
    for (const t of active) {
      if (isIdeaCategory(t.category)) ideaItems.push(t)
      else taskItems.push(t)
    }
    taskItems.sort((a, b) => {
      const po = getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
      if (po !== 0) return po
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return { taskItems, ideaItems }
  }, [todos])

  // Group ideas by category
  const ideaGroups = useMemo(() => {
    const g = new Map<string, Todo[]>()
    for (const t of ideaItems) {
      const k = t.category || 'other'
      if (!g.has(k)) g.set(k, [])
      g.get(k)!.push(t)
    }
    return Array.from(g.entries())
  }, [ideaItems])

  const pendingShopping = shopping.items.filter(i => !i.purchased)
  const purchasedShopping = shopping.items.filter(i => i.purchased)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── Overdue Banner ── */}
      {overdueItems.length > 0 && !overdueAck && (
        <div className="shrink-0 bg-red-500/10 border-b-2 border-red-500/40 px-6 py-3 flex items-center gap-3 anim-shake">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm font-semibold text-red-300">
            {overdueItems.length} overskredet{overdueItems.length > 1 ? 'e' : ''} opgave{overdueItems.length > 1 ? 'r' : ''}!
          </span>
          <div className="flex gap-2 ml-2 flex-wrap">
            {overdueItems.slice(0, 3).map(t => (
              <span key={t.id} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-md border border-red-500/30">
                {decodeHtmlEntities(t.title).slice(0, 40)}
              </span>
            ))}
            {overdueItems.length > 3 && (
              <span className="text-xs text-red-400">+{overdueItems.length - 3} mere</span>
            )}
          </div>
          <button onClick={() => setOverdueAck(true)} className="ml-auto text-red-400 hover:text-red-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Header ── */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-panel)]">
        <div className="max-w-[1360px] mx-auto px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">TeamBattle ToDo</h1>
            <div className="flex items-center gap-4 mt-1">
              <Stat label="Aktive" value={taskItems.length} />
              <Stat label="Idéer" value={ideaItems.length} color="var(--purple)" />
              <Stat label="Indkøb" value={pendingShopping.length} color="var(--green)" />
              {overdueItems.length > 0 && <Stat label="Overdue" value={overdueItems.length} color="var(--red)" />}
              <span className={`ml-2 w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
            </div>
          </div>
          <ClockWidget />
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1360px] mx-auto px-8 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ═══ KOLONNE 1: OPGAVER ═══ */}
          <Panel title="Opgaver" count={taskItems.length} accent="var(--blue)" onAdd={() => setShowAddTodo(true)}>
            {showAddTodo && (
              <AddTodoForm
                employees={employees}
                onSubmit={async (data) => { await addTodo(data); setShowAddTodo(false) }}
                onCancel={() => setShowAddTodo(false)}
              />
            )}
            {taskItems.length === 0 && !showAddTodo && (
              <EmptyState icon={<Check className="w-6 h-6" />} text="Ingen aktive opgaver" />
            )}
            {taskItems.map(t => (
              <TaskCard
                key={t.id}
                todo={t}
                employee={t.assigned_to ? employees.get(t.assigned_to) : undefined}
                onResolve={() => updateTodo(t.id, { resolved: true })}
                onDelete={() => deleteTodo(t.id)}
              />
            ))}
          </Panel>

          {/* ═══ KOLONNE 2: INDKØB ═══ */}
          <Panel title="Indkøb" count={pendingShopping.length} accent="var(--green)" icon={<ShoppingCart className="w-4 h-4" />} onAdd={() => setShowAddShopping(true)}>
            {showAddShopping && (
              <AddShoppingForm
                onSubmit={async (title, note, url) => { await shopping.addItem(title, note, url); setShowAddShopping(false) }}
                onCancel={() => setShowAddShopping(false)}
              />
            )}
            {pendingShopping.length === 0 && !showAddShopping && (
              <EmptyState icon={<ShoppingCart className="w-6 h-6" />} text="Ingen indkøb på listen" />
            )}
            {pendingShopping.map(item => (
              <ShoppingCard
                key={item.id}
                item={item}
                onToggle={() => shopping.togglePurchased(item.id, true)}
                onDelete={() => shopping.deleteItem(item.id)}
              />
            ))}
            {purchasedShopping.length > 0 && (
              <CollapsibleSection title={`Købt (${purchasedShopping.length})`} defaultOpen={false} muted>
                {purchasedShopping.map(item => (
                  <ShoppingCard
                    key={item.id}
                    item={item}
                    purchased
                    onToggle={() => shopping.togglePurchased(item.id, false)}
                    onDelete={() => shopping.deleteItem(item.id)}
                  />
                ))}
              </CollapsibleSection>
            )}
          </Panel>

          {/* ═══ KOLONNE 3: IDÉER ═══ */}
          <Panel title="Idéer & Inspiration" count={ideaItems.length} accent="var(--purple)" icon={<Lightbulb className="w-4 h-4" />}>
            {ideaGroups.map(([cat, items]) => (
              <CollapsibleSection
                key={cat}
                title={getCategoryLabel(cat)}
                count={items.length}
                color={CATEGORY_COLORS[cat] || '#60a5fa'}
                defaultOpen={false}
              >
                {items.map(t => (
                  <IdeaCard key={t.id} todo={t} employee={t.assigned_to ? employees.get(t.assigned_to) : undefined} />
                ))}
              </CollapsibleSection>
            ))}
            {ideaGroups.length === 0 && (
              <EmptyState icon={<Lightbulb className="w-6 h-6" />} text="Ingen idéer endnu" />
            )}
          </Panel>

        </div>
      </div>
    </div>
  )
}

// ─── Stat pill ───
function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-lg font-bold" style={{ color: color || 'var(--text)' }}>{value}</span>
      <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
    </div>
  )
}

// ─── Clock widget ───
function ClockWidget() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i) }, [])
  return (
    <div className="text-right">
      <div className="text-2xl font-light tracking-wide">{now.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="text-[11px] text-[var(--text-muted)] capitalize">{now.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </div>
  )
}

// ─── Panel container ───
function Panel({ title, count, accent, icon, onAdd, children }: {
  title: string; count: number; accent: string; icon?: React.ReactNode; onAdd?: () => void; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border-2 bg-[var(--bg-panel)] overflow-hidden flex flex-col" style={{ borderColor: `${accent}40` }}>
      <div className="px-5 py-3.5 flex items-center gap-2.5 border-b" style={{ borderColor: `${accent}25`, background: `${accent}08` }}>
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: accent }}>{title}</h2>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${accent}20`, color: accent }}>{count}</span>
        {onAdd && (
          <button onClick={onAdd} className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors" style={{ background: `${accent}15`, color: accent, border: `1px solid ${accent}30` }}>
            <Plus className="w-3.5 h-3.5" /> Tilføj
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Collapsible section ───
function CollapsibleSection({ title, count, color, defaultOpen = true, muted, children }: {
  title: string; count?: number; color?: string; defaultOpen?: boolean; muted?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`rounded-xl border overflow-hidden ${muted ? 'opacity-60' : ''}`} style={{ borderColor: color ? `${color}35` : 'var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 cursor-pointer text-left transition-colors hover:bg-[var(--bg-card)]"
        style={{ background: color ? `${color}08` : 'transparent' }}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" style={{ color: color || 'var(--text-muted)' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: color || 'var(--text-muted)' }} />}
        {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />}
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: color || 'var(--text-dim)' }}>{title}</span>
        {count !== undefined && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto" style={{ background: color ? `${color}20` : 'var(--bg-card)', color: color || 'var(--text-muted)' }}>{count}</span>}
      </button>
      {open && <div className="p-3 pt-1 space-y-2">{children}</div>}
    </div>
  )
}

// ─── Empty state ───
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] opacity-50">
      {icon}
      <p className="text-xs mt-2">{text}</p>
    </div>
  )
}

// ─── Avatar ───
function Avatar({ name, id, size = 28 }: { name: string; id: string; size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: hashColor(id) }}
      title={name}
    >{getInitials(name)}</div>
  )
}

// ─── Due date badge ───
function DueBadge({ date }: { date: string | null }) {
  if (!date) return null
  const overdue = isOverdue(date)
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)

  let label: string
  if (d.getTime() === today.getTime()) label = 'I dag'
  else if (d.getTime() === tomorrow.getTime()) label = 'I morgen'
  else label = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })

  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 anim-pulse-border">
        <Clock className="w-3 h-3" /> Overskredet - {label}
      </span>
    )
  }

  const isToday = d.getTime() === today.getTime()
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${isToday ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border)]'}`}>
      <Calendar className="w-3 h-3" /> {label}
    </span>
  )
}

// ─── Task card ───
function TaskCard({ todo, employee, onResolve, onDelete }: {
  todo: Todo; employee?: Employee; onResolve: () => void; onDelete: () => void
}) {
  const overdue = isOverdue(todo.due_date)
  const color = getPriorityColor(todo.priority)
  const title = decodeHtmlEntities(todo.title)
  const parsed = parseDescription(todo.description)

  return (
    <div className={`rounded-xl border-l-[3px] border bg-[var(--bg-card)] transition-all duration-150 hover:bg-[var(--bg-card-hover)] anim-slide-up ${overdue ? 'border-red-500/30 bg-red-500/[0.03]' : 'border-[var(--border)]'}`} style={{ borderLeftColor: color }}>
      <div className="p-3.5">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <button onClick={onResolve} className="mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center hover:bg-green-500/20 hover:border-green-500 transition-all cursor-pointer" style={{ borderColor: `${color}50` }}>
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold leading-snug line-clamp-2">
              {todo.is_error && <AlertTriangle className="inline w-3.5 h-3.5 mr-1 text-amber-400 -mt-0.5" />}
              {title}
            </h3>
            {parsed.text && <p className="text-xs text-[var(--text-dim)] line-clamp-2 mt-1 leading-relaxed">{parsed.text}</p>}
          </div>
          {employee && <Avatar name={employee.navn} id={employee.id} />}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap mt-2.5 ml-7">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
            <Flag className="w-3 h-3" /> {getPriorityLabel(todo.priority)}
          </span>
          <DueBadge date={todo.due_date} />
          {(todo.geo_address || todo.location) && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
              <MapPin className="w-3 h-3" /> {todo.geo_address || todo.location}
            </span>
          )}
          {employee && (
            <span className="text-[10px] text-[var(--text-muted)] ml-auto">{employee.navn}</span>
          )}
          <button onClick={onDelete} className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer opacity-30 hover:opacity-100">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Idea card ───
function IdeaCard({ todo, employee }: { todo: Todo; employee?: Employee }) {
  const title = decodeHtmlEntities(todo.title)
  const parsed = parseDescription(todo.description)
  const [imgErr, setImgErr] = useState(false)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden hover:bg-[var(--bg-card-hover)] transition-all anim-slide-up flex">
      {parsed.image && !imgErr ? (
        <div className="w-20 h-20 shrink-0 bg-[var(--bg-input)]">
          <img src={parsed.image} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
        </div>
      ) : (
        <div className="w-20 h-20 shrink-0 bg-[var(--bg-input)] flex items-center justify-center">
          <Lightbulb className="w-6 h-6 text-[var(--text-muted)] opacity-30" />
        </div>
      )}
      <div className="flex-1 p-3 min-w-0">
        <div className="flex items-start gap-2">
          <h3 className="text-xs font-semibold leading-snug line-clamp-2 flex-1">{title}</h3>
          {employee && <Avatar name={employee.navn} id={employee.id} size={22} />}
        </div>
        {parsed.text && <p className="text-[10px] text-[var(--text-dim)] line-clamp-1 mt-0.5">{parsed.text}</p>}
        <div className="flex items-center gap-1.5 mt-1.5">
          {parsed.tags?.slice(0, 3).map((tag, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20">{tag}</span>
          ))}
          {parsed.url && <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--text-muted)]"><ExternalLink className="w-2.5 h-2.5" />Link</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Shopping card ───
function ShoppingCard({ item, purchased, onToggle, onDelete }: {
  item: ShoppingItem; purchased?: boolean; onToggle: () => void; onDelete: () => void
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${purchased ? 'border-[var(--border)] opacity-50' : 'border-green-500/20 bg-[var(--bg-card)] hover:border-green-500/40'}`}>
      <button onClick={onToggle} className={`w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all cursor-pointer ${purchased ? 'bg-green-500 border-green-500' : 'border-green-500/40 hover:border-green-500'}`}>
        {purchased && <Check className="w-3 h-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium ${purchased ? 'line-through text-[var(--text-muted)]' : ''}`}>{item.title}</span>
        {item.note && <p className="text-[10px] text-[var(--text-muted)] line-clamp-1">{item.note}</p>}
      </div>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-green-400 transition-colors" onClick={e => e.stopPropagation()}>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      <button onClick={onDelete} className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer opacity-30 hover:opacity-100">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Add Todo form ───
function AddTodoForm({ employees, onSubmit, onCancel }: {
  employees: Map<string, Employee>; onSubmit: (data: Partial<Todo>) => Promise<any>; onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('Normal')
  const [duePreset, setDuePreset] = useState('')
  const [customDate, setCustomDate] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { ref.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || submitting) return
    setSubmitting(true)
    const dueDate = customDate || computeDueDate(duePreset)
    await onSubmit({ title: title.trim(), priority, due_date: dueDate, assigned_to: assignedTo || null })
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-blue-500/30 bg-blue-500/[0.04] p-4 space-y-3 anim-slide-up">
      <input ref={ref} type="text" placeholder="Opgavetitel..." value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50" />

      {/* Prioritet */}
      <div className="flex gap-1.5 flex-wrap">
        {PRIORITIES.map(p => (
          <button key={p.value} type="button" onClick={() => setPriority(p.value)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all border ${priority === p.value ? 'ring-2 ring-offset-1 ring-offset-[var(--bg-panel)]' : 'opacity-50 hover:opacity-80'}`}
            style={{ background: `${p.color}18`, color: p.color, borderColor: `${p.color}40`, ...(priority === p.value ? { ringColor: p.color } : {}) }}
          >{p.label}</button>
        ))}
      </div>

      {/* Due date presets */}
      <div className="flex gap-1.5 flex-wrap">
        {DUE_PRESETS.map(d => (
          <button key={d.value} type="button" onClick={() => { setDuePreset(d.value); setCustomDate('') }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer transition-all border border-[var(--border)] ${duePreset === d.value ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/40' : 'text-[var(--text-dim)] hover:text-[var(--text)]'}`}
          >{d.label}</button>
        ))}
        <input type="date" value={customDate} onChange={e => { setCustomDate(e.target.value); setDuePreset('') }}
          className="px-2 py-1 rounded-lg text-[11px] bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-dim)] focus:outline-none" />
      </div>

      {/* Assigned to */}
      <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text-dim)] focus:outline-none">
        <option value="">Tildel medarbejder...</option>
        {Array.from(employees.values()).sort((a, b) => a.navn.localeCompare(b.navn)).map(e => (
          <option key={e.id} value={e.id}>{e.navn} ({e.location})</option>
        ))}
      </select>

      {/* Actions */}
      <div className="flex gap-2">
        <button type="submit" disabled={!title.trim() || submitting}
          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 transition-colors cursor-pointer">
          {submitting ? 'Opretter...' : 'Opret opgave'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer">Annuller</button>
      </div>
    </form>
  )
}

// ─── Add Shopping form ───
function AddShoppingForm({ onSubmit, onCancel }: {
  onSubmit: (title: string, note?: string, url?: string) => Promise<any>; onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { ref.current?.focus() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || submitting) return
    setSubmitting(true)
    await onSubmit(title.trim(), note.trim() || undefined, url.trim() || undefined)
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-green-500/30 bg-green-500/[0.04] p-4 space-y-2.5 anim-slide-up">
      <input ref={ref} type="text" placeholder="Hvad skal købes?" value={title} onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-green-500/50" />
      <input type="text" placeholder="Note (valgfrit)" value={note} onChange={e => setNote(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none" />
      <input type="url" placeholder="Link (valgfrit)" value={url} onChange={e => setUrl(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none" />
      <div className="flex gap-2">
        <button type="submit" disabled={!title.trim() || submitting}
          className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-500 text-white hover:bg-green-600 disabled:opacity-30 transition-colors cursor-pointer">
          {submitting ? 'Tilføjer...' : 'Tilføj'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer">Annuller</button>
      </div>
    </form>
  )
}
