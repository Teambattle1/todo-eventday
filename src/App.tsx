import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
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
  ExternalLink, MapPin, Calendar, Loader2,
  Lightbulb,
} from 'lucide-react'

/* ━━━ Color Tokens ━━━ */
const C = {
  bg: '#0c0c0f',
  surface: '#141418',
  card: '#1a1a20',
  cardHover: '#1f1f27',
  input: '#16161c',
  border: '#27272f',
  borderLight: '#33333d',
  text: '#e8e8ec',
  textSec: '#9898a8',
  textMuted: '#5a5a6a',
  blue: '#4f8ff7',
  green: '#34d399',
  red: '#f06060',
  amber: '#f5a623',
  purple: '#9580ff',
  pink: '#f472b6',
  cyan: '#22d3ee',
}

const PRIORITIES = [
  { value: 'HASTER', label: 'HASTER', color: C.red },
  { value: 'Vigtigt', label: 'Vigtigt', color: C.amber },
  { value: 'Normal', label: 'Normal', color: C.blue },
  { value: 'let', label: 'Let', color: C.green },
]

const CAT_COLORS: Record<string, string> = {
  'idea-inspiration': C.purple,
  'idea-activity': C.pink,
  'idea-company': C.cyan,
  'IDEER': C.amber,
}

function computeDue(preset: string): string | null {
  const d = new Date(); d.setHours(0,0,0,0)
  if (preset === 'today') return d.toISOString().slice(0,10)
  if (preset === 'tomorrow') { d.setDate(d.getDate()+1); return d.toISOString().slice(0,10) }
  if (preset === 'next_week') { d.setDate(d.getDate()+((8-d.getDay())%7||7)); return d.toISOString().slice(0,10) }
  return null
}

/* ━━━ App ━━━ */
export default function App() {
  const { todos, loading, connected, addTodo, updateTodo, deleteTodo } = useTodos()
  const employees = useEmployees()
  const shop = useShopping()
  const [addingTask, setAddingTask] = useState(false)
  const [addingShop, setAddingShop] = useState(false)

  const active = useMemo(() => todos.filter(t => !t.resolved), [todos])
  const overdue = useMemo(() => active.filter(t => isOverdue(t.due_date)), [active])
  const tasks = useMemo(() => {
    const t = active.filter(t => !isIdeaCategory(t.category))
    t.sort((a,b) => {
      const d = getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
      return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return t
  }, [active])

  const ideaGroups = useMemo(() => {
    const ideas = active.filter(t => isIdeaCategory(t.category))
    const m = new Map<string, Todo[]>()
    ideas.forEach(t => { const k = t.category || 'x'; m.set(k, [...(m.get(k)||[]), t]) })
    return [...m.entries()]
  }, [active])

  const pendShop = shop.items.filter(i => !i.purchased)
  const doneShop = shop.items.filter(i => i.purchased)

  if (loading) return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Loader2 style={{ width:32, height:32, color:C.blue }} className="animate-spin" />
    </div>
  )

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:C.bg }}>

      {/* ── Overdue alert ── */}
      {overdue.length > 0 && (
        <div style={{ background:'rgba(240,96,96,0.07)', borderBottom:`1px solid rgba(240,96,96,0.2)`, padding:'10px 0' }}>
          <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 40px', display:'flex', alignItems:'center', gap:10 }}>
            <AlertTriangle style={{ width:16, height:16, color:C.red, flexShrink:0 }} />
            <span style={{ fontSize:13, fontWeight:600, color:C.red }}>
              {overdue.length} overskredet{overdue.length > 1 ? 'e' : ''} opgave{overdue.length > 1 ? 'r' : ''}
            </span>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginLeft:8 }}>
              {overdue.slice(0,3).map(t => (
                <span key={t.id} style={{ fontSize:11, background:'rgba(240,96,96,0.12)', color:'#fca5a5', padding:'2px 8px', borderRadius:6, border:'1px solid rgba(240,96,96,0.2)' }}>
                  {decodeHtmlEntities(t.title).slice(0,35)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header style={{ borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'20px 40px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, letterSpacing:'-0.02em', color:C.text }}>TeamBattle Todo</h1>
            <div style={{ display:'flex', alignItems:'center', gap:20, marginTop:6 }}>
              <StatPill n={tasks.length} label="Opgaver" color={C.blue} />
              <StatPill n={pendShop.length} label="Indkøb" color={C.green} />
              <StatPill n={ideaGroups.reduce((s,[,v])=>s+v.length,0)} label="Idéer" color={C.purple} />
              {overdue.length > 0 && <StatPill n={overdue.length} label="Overdue" color={C.red} />}
              <div style={{ width:8, height:8, borderRadius:4, background: connected ? '#34d399' : C.red, marginLeft:4 }} />
            </div>
          </div>
          <LiveClock />
        </div>
      </header>

      {/* ── 3-column grid ── */}
      <div style={{ flex:1, overflow:'auto' }}>
        <div style={{ maxWidth:1200, margin:'0 auto', padding:'28px 40px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24, alignItems:'start' }}>

          {/* COL 1 — Tasks */}
          <Column title="Opgaver" count={tasks.length} color={C.blue}
            action={<AddBtn label="Ny opgave" onClick={() => setAddingTask(true)} />}>
            {addingTask && <TaskForm employees={employees} onDone={async d => { await addTodo(d); setAddingTask(false) }} onCancel={() => setAddingTask(false)} />}
            {tasks.map(t => <TaskCard key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} />)}
            {tasks.length === 0 && !addingTask && <Empty text="Ingen aktive opgaver" />}
          </Column>

          {/* COL 2 — Shopping */}
          <Column title="Indkøb" count={pendShop.length} color={C.green}
            action={<AddBtn label="Tilføj" onClick={() => setAddingShop(true)} />}>
            {addingShop && <ShopForm onDone={async (t,n,u) => { await shop.addItem(t,n,u); setAddingShop(false) }} onCancel={() => setAddingShop(false)} />}
            {pendShop.map(i => <ShopCard key={i.id} item={i} onCheck={() => shop.togglePurchased(i.id, true)} onDel={() => shop.deleteItem(i.id)} />)}
            {pendShop.length === 0 && !addingShop && <Empty text="Listen er tom" />}
            {doneShop.length > 0 && (
              <Collapse label={`Købt (${doneShop.length})`} open={false}>
                {doneShop.map(i => <ShopCard key={i.id} item={i} done onCheck={() => shop.togglePurchased(i.id, false)} onDel={() => shop.deleteItem(i.id)} />)}
              </Collapse>
            )}
          </Column>

          {/* COL 3 — Ideas */}
          <Column title="Idéer & Inspiration" count={ideaGroups.reduce((s,[,v])=>s+v.length,0)} color={C.purple}>
            {ideaGroups.map(([cat, items]) => (
              <Collapse key={cat} label={getCategoryLabel(cat)} count={items.length} color={CAT_COLORS[cat] || C.blue} open={false}>
                {items.map(t => <IdeaRow key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} />)}
              </Collapse>
            ))}
            {ideaGroups.length === 0 && <Empty text="Ingen idéer" />}
          </Column>

        </div>
      </div>
    </div>
  )
}

/* ━━━ Reusable components ━━━ */

function StatPill({ n, label, color }: { n:number; label:string; color:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:18, fontWeight:700, color }}>{n}</span>
      <span style={{ fontSize:11, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
    </div>
  )
}

function LiveClock() {
  const [n, sN] = useState(new Date())
  useEffect(() => { const i = setInterval(() => sN(new Date()), 1000); return () => clearInterval(i) }, [])
  return (
    <div style={{ textAlign:'right' }}>
      <div style={{ fontSize:28, fontWeight:300, letterSpacing:'0.02em', color:C.text }}>{n.toLocaleTimeString('da-DK',{hour:'2-digit',minute:'2-digit'})}</div>
      <div style={{ fontSize:11, color:C.textMuted, textTransform:'capitalize' }}>{n.toLocaleDateString('da-DK',{weekday:'long',day:'numeric',month:'long'})}</div>
    </div>
  )
}

function Column({ title, count, color, action, children }: { title:string; count:number; color:string; action?:ReactNode; children:ReactNode }) {
  return (
    <div style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:4, height:20, borderRadius:2, background:color }} />
        <span style={{ fontSize:13, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.04em' }}>{title}</span>
        <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, background:C.card, padding:'2px 8px', borderRadius:10 }}>{count}</span>
        {action && <div style={{ marginLeft:'auto' }}>{action}</div>}
      </div>
      {/* Body */}
      <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8, maxHeight:'calc(100vh - 220px)', overflowY:'auto' }}>
        {children}
      </div>
    </div>
  )
}

function AddBtn({ label, onClick }: { label:string; onClick:()=>void }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 14px', borderRadius:8, fontSize:11, fontWeight:700, color:'#fff', background:C.red, border:'none', cursor:'pointer', transition:'all 0.15s', textTransform:'uppercase', letterSpacing:'0.04em' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#d44' }}
      onMouseLeave={e => { e.currentTarget.style.background = C.red }}>
      <Plus style={{ width:14, height:14 }} /> {label}
    </button>
  )
}

function Empty({ text }: { text:string }) {
  return <div style={{ textAlign:'center', padding:'32px 0', fontSize:13, color:C.textMuted }}>{text}</div>
}

function Collapse({ label, count, color, open: initOpen, children }: { label:string; count?:number; color?:string; open:boolean; children:ReactNode }) {
  const [open, setOpen] = useState(initOpen)
  return (
    <div style={{ borderRadius:10, border:`1px solid ${color ? color+'30' : C.border}`, overflow:'hidden' }}>
      <button onClick={() => setOpen(o=>!o)} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background: color ? color+'08' : 'transparent', border:'none', cursor:'pointer', color: color || C.textSec, fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em', textAlign:'left' }}>
        {open ? <ChevronDown style={{ width:14, height:14 }} /> : <ChevronRight style={{ width:14, height:14 }} />}
        {color && <div style={{ width:7, height:7, borderRadius:4, background:color, flexShrink:0 }} />}
        {label}
        {count !== undefined && <span style={{ fontSize:10, fontWeight:700, marginLeft:'auto', padding:'1px 7px', borderRadius:8, background: color ? color+'18' : C.card, color: color || C.textMuted }}>{count}</span>}
      </button>
      {open && <div style={{ padding:'8px 12px 12px', display:'flex', flexDirection:'column', gap:6 }}>{children}</div>}
    </div>
  )
}

function Avatar({ name, id, sz=26 }: { name:string; id:string; sz?:number }) {
  return (
    <div style={{ width:sz, height:sz, borderRadius:sz, background:hashColor(id), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:sz*0.38, fontWeight:600, flexShrink:0 }} title={name}>
      {getInitials(name)}
    </div>
  )
}

function DuePill({ date }: { date:string|null }) {
  if (!date) return null
  const od = isOverdue(date)
  const d = new Date(date); d.setHours(0,0,0,0)
  const today = new Date(); today.setHours(0,0,0,0)
  const tmrw = new Date(today); tmrw.setDate(tmrw.getDate()+1)
  const lbl = d.getTime()===today.getTime() ? 'I dag' : d.getTime()===tmrw.getTime() ? 'I morgen' : d.toLocaleDateString('da-DK',{day:'numeric',month:'short'})

  const bg = od ? 'rgba(240,96,96,0.12)' : d.getTime()===today.getTime() ? 'rgba(245,166,35,0.1)' : C.card
  const fg = od ? '#fca5a5' : d.getTime()===today.getTime() ? C.amber : C.textMuted
  const bdr = od ? 'rgba(240,96,96,0.25)' : 'transparent'

  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:500, padding:'2px 7px', borderRadius:5, background:bg, color:fg, border:`1px solid ${bdr}` }}>
      <Calendar style={{ width:10, height:10 }} />
      {od ? `Overskredet - ${lbl}` : lbl}
    </span>
  )
}

/* ━━━ Task Card ━━━ */
function TaskCard({ t, emp, onDone, onDel }: { t:Todo; emp?:Employee; onDone:()=>void; onDel:()=>void }) {
  const od = isOverdue(t.due_date)
  const pc = getPriorityColor(t.priority)
  const title = decodeHtmlEntities(t.title)
  const desc = parseDescription(t.description)

  return (
    <div style={{
      background: od ? 'rgba(240,96,96,0.04)' : C.card,
      borderRadius:10,
      border: `1px solid ${od ? 'rgba(240,96,96,0.18)' : C.border}`,
      borderLeft: `3px solid ${pc}`,
      padding:'14px 16px',
      transition:'background 0.15s',
      cursor:'default',
    }}
      onMouseEnter={e => { if(!od) e.currentTarget.style.background = C.cardHover }}
      onMouseLeave={e => { e.currentTarget.style.background = od ? 'rgba(240,96,96,0.04)' : C.card }}>

      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        {/* Checkbox */}
        <button onClick={onDone} style={{
          width:20, height:20, borderRadius:6, border:`2px solid ${pc}50`, background:'transparent',
          display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, marginTop:1,
          transition:'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = pc+'20'; e.currentTarget.style.borderColor = pc }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = pc+'50' }}>
          <Check style={{ width:12, height:12, color:pc, opacity:0 }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0'} />
        </button>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, lineHeight:1.4, color:C.text }}>{title}</div>
          {desc.text && <div style={{ fontSize:12, color:C.textSec, marginTop:3, lineHeight:1.5, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{desc.text}</div>}

          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginTop:8 }}>
            <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:5, background:pc+'14', color:pc }}>{getPriorityLabel(t.priority)}</span>
            <DuePill date={t.due_date} />
            {(t.geo_address || t.location) && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:C.textMuted }}><MapPin style={{ width:10, height:10 }} />{t.geo_address || t.location}</span>
            )}
            {emp && <span style={{ fontSize:10, color:C.textMuted, marginLeft:'auto' }}>{emp.navn}</span>}
            <button onClick={onDel} style={{ padding:3, borderRadius:4, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer', opacity:0.3, transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.red }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.3'; e.currentTarget.style.color = C.textMuted }}>
              <Trash2 style={{ width:12, height:12 }} />
            </button>
          </div>
        </div>

        {emp && <Avatar name={emp.navn} id={emp.id} />}
      </div>
    </div>
  )
}

/* ━━━ Idea Row ━━━ */
function IdeaRow({ t, emp }: { t:Todo; emp?:Employee }) {
  const title = decodeHtmlEntities(t.title)
  const desc = parseDescription(t.description)
  const [ie, sIe] = useState(false)

  return (
    <div style={{ display:'flex', borderRadius:8, border:`1px solid ${C.border}`, background:C.card, overflow:'hidden', transition:'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = C.cardHover}
      onMouseLeave={e => e.currentTarget.style.background = C.card}>
      {desc.image && !ie ? (
        <div style={{ width:64, height:64, flexShrink:0, background:C.input }}>
          <img src={desc.image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={() => sIe(true)} />
        </div>
      ) : (
        <div style={{ width:64, height:64, flexShrink:0, background:C.input, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Lightbulb style={{ width:20, height:20, color:C.textMuted, opacity:0.3 }} />
        </div>
      )}
      <div style={{ flex:1, padding:'8px 12px', minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:12, fontWeight:600, color:C.text, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</span>
          {emp && <Avatar name={emp.navn} id={emp.id} sz={20} />}
        </div>
        {desc.text && <div style={{ fontSize:10, color:C.textSec, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{desc.text}</div>}
        <div style={{ display:'flex', gap:4, marginTop:4 }}>
          {desc.tags?.slice(0,3).map((tag,i) => (
            <span key={i} style={{ fontSize:9, fontWeight:500, padding:'1px 5px', borderRadius:4, background:C.purple+'14', color:C.purple }}>{tag}</span>
          ))}
          {desc.url && <span style={{ fontSize:9, color:C.textMuted, display:'inline-flex', alignItems:'center', gap:2 }}><ExternalLink style={{ width:8, height:8 }} />Link</span>}
        </div>
      </div>
    </div>
  )
}

/* ━━━ Shop Card ━━━ */
function ShopCard({ item, done, onCheck, onDel }: { item:ShoppingItem; done?:boolean; onCheck:()=>void; onDel:()=>void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, background: done ? 'transparent' : C.card, border:`1px solid ${done ? C.border : C.green+'25'}`, opacity: done ? 0.45 : 1, transition:'all 0.15s' }}>
      <button onClick={onCheck} style={{ width:18, height:18, borderRadius:5, border:`2px solid ${done ? C.green : C.green+'60'}`, background: done ? C.green : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}
        onMouseEnter={e => { if(!done) { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.background = C.green+'20' } }}
        onMouseLeave={e => { if(!done) { e.currentTarget.style.borderColor = C.green+'60'; e.currentTarget.style.background = 'transparent' } }}>
        {done && <Check style={{ width:11, height:11, color:'#fff' }} />}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <span style={{ fontSize:13, fontWeight:500, textDecoration: done ? 'line-through' : 'none', color: done ? C.textMuted : C.text }}>{item.title}</span>
        {item.note && <div style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{item.note}</div>}
      </div>
      {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color:C.textMuted, transition:'color 0.15s' }} onClick={e=>e.stopPropagation()} onMouseEnter={e=>e.currentTarget.style.color=C.green} onMouseLeave={e=>e.currentTarget.style.color=C.textMuted}><ExternalLink style={{ width:13, height:13 }} /></a>}
      <button onClick={onDel} style={{ padding:2, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer', opacity:0.25, transition:'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color=C.red }}
        onMouseLeave={e => { e.currentTarget.style.opacity='0.25'; e.currentTarget.style.color=C.textMuted }}>
        <Trash2 style={{ width:11, height:11 }} />
      </button>
    </div>
  )
}

/* ━━━ Forms ━━━ */
const inputStyle: React.CSSProperties = { width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border}`, background:C.input, color:C.text, fontSize:13, outline:'none', fontFamily:'inherit', transition:'border-color 0.15s' }
const inputFocus = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement>) => e.currentTarget.style.borderColor = C.blue
const inputBlur = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement>) => e.currentTarget.style.borderColor = C.border

function TaskForm({ employees, onDone, onCancel }: { employees:Map<string,Employee>; onDone:(d:Partial<Todo>)=>Promise<any>; onCancel:()=>void }) {
  const [title, sT] = useState('')
  const [pri, sP] = useState('Normal')
  const [due, sD] = useState('')
  const [cDate, sCD] = useState('')
  const [assign, sA] = useState('')
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    sB(true)
    await onDone({ title: title.trim(), priority: pri, due_date: cDate || computeDue(due), assigned_to: assign || null })
    sB(false)
  }

  return (
    <form onSubmit={submit} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.blue}30`, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
      <input ref={ref} placeholder="Opgavetitel..." value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />

      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {PRIORITIES.map(p => (
          <button key={p.value} type="button" onClick={() => sP(p.value)} style={{
            padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${p.color}40`,
            background: pri===p.value ? p.color+'20' : 'transparent', color: pri===p.value ? p.color : C.textMuted,
            transition:'all 0.15s',
          }}>{p.label}</button>
        ))}
      </div>

      <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
        {['today','tomorrow','next_week'].map(d => (
          <button key={d} type="button" onClick={() => { sD(d); sCD('') }} style={{
            padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:500, cursor:'pointer',
            border:`1px solid ${due===d ? C.blue+'40' : C.border}`,
            background: due===d ? C.blue+'12' : 'transparent',
            color: due===d ? C.blue : C.textMuted,
            transition:'all 0.15s',
          }}>{d==='today'?'I dag':d==='tomorrow'?'I morgen':'Næste uge'}</button>
        ))}
        <input type="date" value={cDate} onChange={e => { sCD(e.target.value); sD('') }}
          style={{ ...inputStyle, width:'auto', padding:'4px 8px', fontSize:11 }} onFocus={inputFocus} onBlur={inputBlur} />
      </div>

      <select value={assign} onChange={e => sA(e.target.value)} style={{ ...inputStyle, color: assign ? C.text : C.textMuted }} onFocus={inputFocus as any} onBlur={inputBlur as any}>
        <option value="">Tildel medarbejder...</option>
        {[...employees.values()].sort((a,b) => a.navn.localeCompare(b.navn)).map(e => (
          <option key={e.id} value={e.id}>{e.navn} ({e.location})</option>
        ))}
      </select>

      <div style={{ display:'flex', gap:8, marginTop:2 }}>
        <button type="submit" disabled={!title.trim()||busy} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, transition:'opacity 0.15s', textTransform:'uppercase', letterSpacing:'0.04em' }}>
          {busy ? 'OPRETTER...' : 'OPRET OPGAVE'}
        </button>
        <button type="button" onClick={onCancel} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>ANNULLER</button>
      </div>
    </form>
  )
}

function ShopForm({ onDone, onCancel }: { onDone:(t:string,n?:string,u?:string)=>Promise<any>; onCancel:()=>void }) {
  const [title, sT] = useState('')
  const [note, sN] = useState('')
  const [url, sU] = useState('')
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()||busy) return
    sB(true)
    await onDone(title.trim(), note.trim()||undefined, url.trim()||undefined)
    sB(false)
  }

  return (
    <form onSubmit={submit} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.green}30`, padding:16, display:'flex', flexDirection:'column', gap:8 }}>
      <input ref={ref} placeholder="Hvad skal købes?" value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <input placeholder="Note (valgfrit)" value={note} onChange={e=>sN(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <input placeholder="Link (valgfrit)" value={url} onChange={e=>sU(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <div style={{ display:'flex', gap:8, marginTop:2 }}>
        <button type="submit" disabled={!title.trim()||busy} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, textTransform:'uppercase', letterSpacing:'0.04em' }}>
          {busy ? 'TILF\u00d8JER...' : 'TILF\u00d8J'}
        </button>
        <button type="button" onClick={onCancel} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>ANNULLER</button>
      </div>
    </form>
  )
}
