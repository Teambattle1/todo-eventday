import { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useTodos } from './hooks/useTodos'
import { useEmployees } from './hooks/useEmployees'
import { useShopping } from './hooks/useShopping'
import { useGeofence } from './hooks/useGeofence'
import { useWakeLock } from './hooks/useWakeLock'
import { supabase } from './lib/supabase'
import { useLocations } from './hooks/useLocations'
import type { Todo, Employee, ShoppingItem } from './lib/types'
import {
  getPriorityColor, getPriorityOrder, getPriorityLabel,
  isIdeaCategory, getCategoryLabel, parseDescription,
  decodeHtmlEntities, isOverdue, getInitials, hashColor,
} from './lib/utils'
import {
  Plus, Check, Trash2, ChevronDown, ChevronRight, AlertTriangle,
  ExternalLink, MapPin, Calendar, Loader2, X, Lightbulb, Flame, Pencil,
  Navigation, XCircle, ChevronLeft, ArrowRight, ShoppingCart, Image, Mic, MicOff, Keyboard,
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
  text: '#ffffff',
  textSec: '#d4d4dc',
  textMuted: '#a0a0b0',
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
  const locations = useLocations()
  const { nearbyItems, watching: gpsActive } = useGeofence(todos, shop.items)
  useWakeLock()
  const [addingTaskThomas, setAddingTaskThomas] = useState(false)
  const [addingTaskMaria, setAddingTaskMaria] = useState(false)
  const [addingShop, setAddingShop] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState<Todo | null>(null)
  const [editingShop, setEditingShop] = useState<ShoppingItem | null>(null)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [mobileTab, setMobileTab] = useState<number>(0)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [quickCreate, setQuickCreate] = useState(false)
  const [currentUser, setCurrentUser] = useState<'thomas' | 'maria'>(() => (localStorage.getItem('todo-user') as any) || 'thomas')

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Keyboard shortcut: N or Ctrl+N to quick-create
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'n' || e.key === 'N' || (e.key === 'n' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault()
        setQuickCreate(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const switchUser = useCallback((user: 'thomas' | 'maria') => {
    setCurrentUser(user)
    localStorage.setItem('todo-user', user)
  }, [])

  const firstName = useCallback((emp: Employee | undefined, fallback: string) => {
    if (!emp) return fallback
    return emp.navn.split(' ')[0] || fallback
  }, [])

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

  // Find Thomas and Maria employee IDs
  const thomasEmp = useMemo(() => [...employees.values()].find(e => e.navn.toLowerCase().includes('thomas')), [employees])
  const mariaEmp = useMemo(() => [...employees.values()].find(e => e.navn.toLowerCase().includes('maria')), [employees])

  const thomasTasks = useMemo(() => tasks.filter(t => t.assigned_to === thomasEmp?.id), [tasks, thomasEmp])
  const mariaTasks = useMemo(() => tasks.filter(t => t.assigned_to === mariaEmp?.id), [tasks, mariaEmp])
  const unassignedTasks = useMemo(() => tasks.filter(t => t.assigned_to !== thomasEmp?.id && t.assigned_to !== mariaEmp?.id), [tasks, thomasEmp, mariaEmp])

  const ideaGroups = useMemo(() => {
    const ideas = active.filter(t => isIdeaCategory(t.category) && t.category !== 'idea-company')
    const m = new Map<string, Todo[]>()
    ideas.forEach(t => { const k = t.category || 'x'; m.set(k, [...(m.get(k)||[]), t]) })
    return [...m.entries()]
  }, [active])

  const pendShop = shop.items.filter(i => !i.purchased).sort((a,b) => {
    if (a.urgent && !b.urgent) return -1
    if (!a.urgent && b.urgent) return 1
    return 0
  })
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

      {/* ── Nearby GPS alert ── */}
      {nearbyItems.length > 0 && (
        <div style={{ background:'rgba(34,211,238,0.07)', borderBottom:`1px solid rgba(34,211,238,0.2)`, padding:'10px 0' }}>
          <div style={{ maxWidth:1600, margin:'0 auto', padding:'0 40px', display:'flex', alignItems:'center', gap:10 }}>
            <Navigation style={{ width:16, height:16, color:C.cyan, flexShrink:0 }} />
            <span style={{ fontSize:13, fontWeight:600, color:C.cyan }}>
              {nearbyItems.length} i nærheden
            </span>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginLeft:8 }}>
              {nearbyItems.slice(0,4).map(ni => (
                <span key={ni.id} style={{ fontSize:11, background:'rgba(34,211,238,0.12)', color:'#67e8f9', padding:'2px 8px', borderRadius:6, border:'1px solid rgba(34,211,238,0.2)', cursor:'pointer' }}
                  onClick={() => {
                    if (ni.type === 'todo') {
                      const t = todos.find(x => x.id === ni.id)
                      if (t) setEditingTodo(t)
                    } else {
                      const s = shop.items.find(x => x.id === ni.id)
                      if (s) setEditingShop(s)
                    }
                  }}>
                  {ni.type === 'shopping' ? '🛒 ' : ''}{decodeHtmlEntities(ni.title).slice(0,25)} ({Math.round(ni.distance)}m)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header style={{ borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
        <div style={{ maxWidth:1600, margin:'0 auto', padding: isMobile ? '12px 12px' : '20px 40px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h1 style={{ fontSize: isMobile ? 16 : 20, fontWeight:700, letterSpacing:'-0.02em', color:C.text }}>TeamBattle Todo</h1>
              {gpsActive && (
                <div style={{ width:8, height:8, borderRadius:4, background:C.cyan, boxShadow:`0 0 6px ${C.cyan}` }} title="GPS aktiv" />
              )}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap: isMobile ? 12 : 20, marginTop:6 }}>
              <StatPill n={tasks.length} label="Opgaver" color={C.blue} />
              <StatPill n={pendShop.length} label="Indkøb" color={C.green} />
              <StatPill n={ideaGroups.reduce((s,[,v])=>s+v.length,0)} label="Idéer" color={C.purple} />
              {overdue.length > 0 && <StatPill n={overdue.length} label="Overdue" color={C.red} />}
              <div style={{ width:8, height:8, borderRadius:4, background: connected ? '#34d399' : C.red, marginLeft:4 }} />
            </div>
          </div>
          {!isMobile && <LiveClock />}
        </div>
      </header>

      {/* ── Mobile tabs ── */}
      {isMobile && (
        <div style={{ display:'flex', overflow:'auto', borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
          {[
            { label: firstName(thomasEmp, 'Thomas'), color: C.blue },
            { label: firstName(mariaEmp, 'Maria'), color: C.pink },
            { label: 'Indkøb', color: C.green },
            { label: 'Idéer', color: C.purple },
          ].map((tab, i) => (
            <button key={i} onClick={() => setMobileTab(i)} style={{
              flex:'0 0 auto', padding:'10px 16px', fontSize:11, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'0.04em', border:'none', cursor:'pointer', whiteSpace:'nowrap',
              background: mobileTab === i ? tab.color + '18' : 'transparent',
              color: mobileTab === i ? tab.color : C.textMuted,
              borderBottom: mobileTab === i ? `2px solid ${tab.color}` : '2px solid transparent',
              transition:'all 0.15s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Content grid (4-col desktop / single tab mobile) ── */}
      <div style={{ flex:1, overflow:'auto' }}>
        <div style={{ maxWidth:1600, margin:'0 auto', padding: isMobile ? '12px 12px' : '28px 40px', display: isMobile ? 'flex' : 'grid', flexDirection:'column', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap: isMobile ? 12 : 24, alignItems:'start' }}>

          {/* COL 1 — Thomas */}
          {(!isMobile || mobileTab === 0) && (
          <Column title={`TODO ${firstName(thomasEmp, 'Thomas')}`} count={thomasTasks.length} color={C.blue}
            action={<AddBtn label="Ny opgave" onClick={() => setAddingTaskThomas(true)} />}>
            {addingTaskThomas && <TaskForm employees={employees} defaultAssign={thomasEmp?.id} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo({ ...d, assigned_to: d.assigned_to || thomasEmp?.id || null }); setAddingTaskThomas(false) }} onCancel={() => setAddingTaskThomas(false)} />}
            {thomasTasks.map(t => <TaskCard key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} onClick={() => setEditingTodo(t)} />)}
            {unassignedTasks.length > 0 && (
              <Collapse label={`Ikke tildelt (${unassignedTasks.length})`} open={true}>
                {unassignedTasks.map(t => <TaskCard key={t.id} t={t} emp={undefined} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} onClick={() => setEditingTodo(t)} />)}
              </Collapse>
            )}
            {thomasTasks.length === 0 && unassignedTasks.length === 0 && !addingTaskThomas && <Empty text="Ingen aktive opgaver" />}
          </Column>
          )}

          {/* COL 2 — Maria */}
          {(!isMobile || mobileTab === 1) && (
          <Column title={`TODO ${firstName(mariaEmp, 'Maria')}`} count={mariaTasks.length} color={C.pink}
            action={<AddBtn label="Ny opgave" onClick={() => setAddingTaskMaria(true)} />}>
            {addingTaskMaria && <TaskForm employees={employees} defaultAssign={mariaEmp?.id} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo({ ...d, assigned_to: d.assigned_to || mariaEmp?.id || null }); setAddingTaskMaria(false) }} onCancel={() => setAddingTaskMaria(false)} />}
            {mariaTasks.map(t => <TaskCard key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} onClick={() => setEditingTodo(t)} />)}
            {mariaTasks.length === 0 && !addingTaskMaria && <Empty text="Ingen aktive opgaver" />}
          </Column>
          )}

          {/* COL 3 — Shopping */}
          {(!isMobile || mobileTab === 2) && (
          <Column title="Indkøb" count={pendShop.length} color={C.green}
            action={<AddBtn label="Tilføj" onClick={() => setAddingShop(true)} />}>
            {addingShop && <ShopForm onDone={async (t,n,u,d,urg) => { await shop.addItem(t,n,u,d,urg); setAddingShop(false) }} onCancel={() => setAddingShop(false)} />}
            {pendShop.map(i => <ShopCard key={i.id} item={i} emp={i.assigned_to ? employees.get(i.assigned_to) : undefined} onCheck={() => shop.togglePurchased(i.id, true)} onDel={() => shop.deleteItem(i.id)} onClick={() => setEditingShop(i)} />)}
            {pendShop.length === 0 && !addingShop && <Empty text="Listen er tom" />}
            {doneShop.length > 0 && (
              <Collapse label={`Købt (${doneShop.length})`} open={false}>
                {doneShop.map(i => <ShopCard key={i.id} item={i} done emp={i.assigned_to ? employees.get(i.assigned_to) : undefined} onCheck={() => shop.togglePurchased(i.id, false)} onDel={() => shop.deleteItem(i.id)} onClick={() => setEditingShop(i)} />)}
              </Collapse>
            )}
          </Column>
          )}

          {/* COL 4 — Ideas */}
          {(!isMobile || mobileTab === 3) && (
          <Column title="Idéer & Inspiration" count={ideaGroups.reduce((s,[,v])=>s+v.length,0)} color={C.purple}>
            {ideaGroups.map(([cat, items]) => (
              <Collapse key={cat} label={getCategoryLabel(cat)} count={items.length} color={CAT_COLORS[cat] || C.blue} open={false}>
                {items.map(t => <IdeaRow key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onOpen={setSelectedIdea} />)}
              </Collapse>
            ))}
            {ideaGroups.length === 0 && <Empty text="Ingen idéer" />}
          </Column>
          )}

        </div>
      </div>

      {/* ── Idea Detail Modal ── */}
      {selectedIdea && (
        <IdeaModal
          todo={selectedIdea}
          emp={selectedIdea.assigned_to ? employees.get(selectedIdea.assigned_to) : undefined}
          onClose={() => setSelectedIdea(null)}
          onDelete={async () => {
            await deleteTodo(selectedIdea.id)
            setSelectedIdea(null)
          }}
          onAddTodo={async (title, desc) => {
            await addTodo({ title, description: desc, priority: 'Normal' })
            setSelectedIdea(null)
          }}
          onAddShopping={async (title, note, url) => {
            await shop.addItem(title, note, url)
            setSelectedIdea(null)
          }}
        />
      )}

      {/* ── Edit Todo Modal ── */}
      {editingTodo && (
        <EditTodoModal
          todo={editingTodo}
          employees={employees}
          locations={locations}
          thomasId={thomasEmp?.id}
          mariaId={mariaEmp?.id}
          onClose={() => setEditingTodo(null)}
          onSave={async (updates) => {
            await updateTodo(editingTodo.id, updates)
            setEditingTodo(null)
          }}
          onDelete={async () => {
            await deleteTodo(editingTodo.id)
            setEditingTodo(null)
          }}
        />
      )}

      {/* ── Edit Shopping Modal ── */}
      {editingShop && (
        <EditShoppingModal
          item={editingShop}
          employees={employees}
          locations={locations}
          thomasId={thomasEmp?.id}
          mariaId={mariaEmp?.id}
          onClose={() => setEditingShop(null)}
          onSave={async (updates) => {
            await shop.updateItem(editingShop.id, updates)
            setEditingShop(null)
          }}
          onDelete={async () => {
            await shop.deleteItem(editingShop.id)
            setEditingShop(null)
          }}
          onConvertToTask={async () => {
            await addTodo({
              title: editingShop.title,
              description: editingShop.note,
              assigned_to: editingShop.assigned_to,
              priority: editingShop.urgent ? 'HASTER' : 'Normal',
              due_date: editingShop.due_date,
              lat: editingShop.lat,
              lon: editingShop.lon,
              geo_address: editingShop.geo_address,
            })
            await shop.deleteItem(editingShop.id)
            setEditingShop(null)
          }}
        />
      )}

      {/* ── Quick Create Modal ── */}
      {quickCreate && (
        <QuickCreateModal
          currentUser={currentUser}
          onSwitchUser={switchUser}
          thomasEmp={thomasEmp}
          mariaEmp={mariaEmp}
          onClose={() => setQuickCreate(false)}
          onSubmit={async (title, desc) => {
            const assignTo = currentUser === 'thomas' ? thomasEmp?.id : mariaEmp?.id
            await addTodo({ title, description: desc || null, priority: 'Normal', assigned_to: assignTo || null })
            setQuickCreate(false)
            // On mobile, switch to the correct tab
            if (isMobile) setMobileTab(currentUser === 'thomas' ? 0 : 1)
          }}
        />
      )}

      {/* ── Floating Action Button (mobile) ── */}
      {isMobile && !quickCreate && (
        <button onClick={() => setQuickCreate(true)} style={{
          position:'fixed', bottom:24, right:24, width:56, height:56, borderRadius:28,
          background:C.red, color:'#fff', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 16px rgba(0,0,0,0.5)', zIndex:900,
        }}>
          <Plus style={{ width:28, height:28 }} />
        </button>
      )}
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

function AssignBtn({ name, label, color, active, onClick }: { name:string; label:string; color:string; active:boolean; onClick:()=>void }) {
  return (
    <button type="button" onClick={onClick} title={label} style={{
      width:32, height:32, borderRadius:32, display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:13, fontWeight:700, color: active ? '#fff' : color,
      background: active ? color : 'transparent',
      border: `2px solid ${active ? color : color+'50'}`,
      cursor:'pointer', transition:'all 0.15s', flexShrink:0,
    }}
      onMouseEnter={e => { if(!active) { e.currentTarget.style.background = color+'20'; e.currentTarget.style.borderColor = color } }}
      onMouseLeave={e => { if(!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = color+'50' } }}>
      {name}
    </button>
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

/* ━━━ Date Picker with weekend highlighting ━━━ */
const DAY_NAMES = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø']
const MONTH_NAMES = ['Januar','Februar','Marts','April','Maj','Juni','Juli','August','September','Oktober','November','December']

function DatePicker({ value, onChange, style: wrapStyle }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) { const d = new Date(value); return { year: d.getFullYear(), month: d.getMonth() } }
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }
  })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const today = new Date(); today.setHours(0,0,0,0)
  const selectedDate = value ? new Date(value + 'T00:00:00') : null

  const firstDay = new Date(viewDate.year, viewDate.month, 1)
  const startDow = (firstDay.getDay() + 6) % 7 // Monday=0
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })
  const nextMonth = () => setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })

  const pick = (day: number) => {
    const m = String(viewDate.month + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewDate.year}-${m}-${d}`)
    setOpen(false)
  }

  const displayLabel = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Vælg dato...'

  return (
    <div ref={ref} style={{ position: 'relative', ...wrapStyle }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        ...inputStyle, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
        color: value ? C.text : C.textMuted, textAlign: 'left', width: '100%',
      }}>
        <Calendar style={{ width: 12, height: 12, flexShrink: 0 }} />
        {displayLabel}
        {value && (
          <span onClick={e => { e.stopPropagation(); onChange(''); setOpen(false) }} style={{ marginLeft: 'auto', padding: 2, color: C.textMuted, cursor: 'pointer' }}>
            <XCircle style={{ width: 12, height: 12 }} />
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12,
          width: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={prevMonth} style={{ padding: 4, border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer' }}>
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              {MONTH_NAMES[viewDate.month]} {viewDate.year}
            </span>
            <button type="button" onClick={nextMonth} style={{ padding: 4, border: 'none', background: 'transparent', color: C.textMuted, cursor: 'pointer' }}>
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAY_NAMES.map((d, i) => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 10, fontWeight: 700, padding: '2px 0',
                color: i >= 5 ? C.amber : C.textMuted,
                textTransform: 'uppercase',
              }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />
              const dow = i % 7
              const isWeekend = dow >= 5
              const cellDate = new Date(viewDate.year, viewDate.month, day)
              const isToday = cellDate.getTime() === today.getTime()
              const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime()

              return (
                <button key={day} type="button" onClick={() => pick(day)} style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: isSelected || isToday ? 700 : 500,
                  background: isSelected ? C.blue : isToday ? C.blue + '20' : isWeekend ? C.amber + '10' : 'transparent',
                  color: isSelected ? '#fff' : isToday ? C.blue : isWeekend ? C.amber : C.text,
                  transition: 'all 0.1s',
                  outline: isToday && !isSelected ? `1px solid ${C.blue}40` : 'none',
                }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isWeekend ? C.amber + '20' : C.cardHover }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isToday ? C.blue + '20' : isWeekend ? C.amber + '10' : 'transparent' }}>
                  {day}
                </button>
              )
            })}
          </div>

          {/* Quick picks */}
          <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            {[
              { label: 'I dag', fn: () => { const d = new Date(); return d.toISOString().slice(0, 10) } },
              { label: 'I morgen', fn: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) } },
              { label: 'Næste uge', fn: () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toISOString().slice(0, 10) } },
            ].map(q => (
              <button key={q.label} type="button" onClick={() => { onChange(q.fn()); setOpen(false) }} style={{
                flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted,
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.color = C.text }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted }}>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ━━━ Task Card ━━━ */
function TaskCard({ t, emp, onDone, onDel, onClick }: { t:Todo; emp?:Employee; onDone:()=>void; onDel:()=>void; onClick?:()=>void }) {
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
      cursor: onClick ? 'pointer' : 'default',
    }}
      onClick={onClick}
      onMouseEnter={e => { if(!od) e.currentTarget.style.background = C.cardHover }}
      onMouseLeave={e => { e.currentTarget.style.background = od ? 'rgba(240,96,96,0.04)' : C.card }}>

      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        {/* Checkbox */}
        <button onClick={e => { e.stopPropagation(); onDone() }} style={{
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
            <span style={{ fontSize:10, color:C.textMuted, marginLeft:'auto' }}>
              {new Date(t.created_at).toLocaleDateString('da-DK', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
            </span>
            <button onClick={e => { e.stopPropagation(); onDel() }} style={{ padding:3, borderRadius:4, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer', opacity:0.3, transition:'all 0.15s' }}
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
function IdeaRow({ t, emp, onOpen }: { t:Todo; emp?:Employee; onOpen:(t:Todo)=>void }) {
  const title = decodeHtmlEntities(t.title)
  const desc = parseDescription(t.description)
  const [ie, sIe] = useState(false)

  return (
    <div onClick={() => onOpen(t)} style={{ display:'flex', borderRadius:8, border:`1px solid ${C.border}`, background:C.card, overflow:'hidden', transition:'background 0.15s', cursor:'pointer' }}
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
function ShopCard({ item, done, onCheck, onDel, onClick, emp }: { item:ShoppingItem; done?:boolean; onCheck:()=>void; onDel:()=>void; onClick?:()=>void; emp?:Employee }) {
  const borderColor = done ? C.border : item.urgent ? C.red+'40' : C.green+'25'
  const bg = done ? 'transparent' : item.urgent ? C.red+'06' : C.card
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, background:bg, border:`1px solid ${borderColor}`, opacity: done ? 0.45 : 1, transition:'all 0.15s', cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={e => { if(onClick && !done) e.currentTarget.style.background = C.cardHover }}
      onMouseLeave={e => { if(onClick) e.currentTarget.style.background = bg }}>
      <button onClick={e => { e.stopPropagation(); onCheck() }} style={{ width:18, height:18, borderRadius:5, border:`2px solid ${done ? C.green : C.green+'60'}`, background: done ? C.green : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}
        onMouseEnter={e => { if(!done) { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.background = C.green+'20' } }}
        onMouseLeave={e => { if(!done) { e.currentTarget.style.borderColor = C.green+'60'; e.currentTarget.style.background = 'transparent' } }}>
        {done && <Check style={{ width:11, height:11, color:'#fff' }} />}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {item.urgent && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:C.red+'20', color:C.red, textTransform:'uppercase' }}>HASTER</span>}
          <span style={{ fontSize:13, fontWeight:500, textDecoration: done ? 'line-through' : 'none', color: done ? C.textMuted : C.text }}>{item.title}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
          {item.note && <span style={{ fontSize:10, color:C.textMuted }}>{item.note}</span>}
          {item.due_date && <DuePill date={item.due_date} />}
          {item.geo_address && <span style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:10, color:C.cyan }}><MapPin style={{ width:9, height:9 }} />{item.geo_address.slice(0,20)}</span>}
        </div>
      </div>
      {emp && <Avatar name={emp.navn} id={emp.id} sz={22} />}
      {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color:C.textMuted, transition:'color 0.15s' }} onClick={e=>e.stopPropagation()} onMouseEnter={e=>e.currentTarget.style.color=C.green} onMouseLeave={e=>e.currentTarget.style.color=C.textMuted}><ExternalLink style={{ width:13, height:13 }} /></a>}
      <button onClick={e => { e.stopPropagation(); onDel() }} style={{ padding:2, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer', opacity:0.25, transition:'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color=C.red }}
        onMouseLeave={e => { e.currentTarget.style.opacity='0.25'; e.currentTarget.style.color=C.textMuted }}>
        <Trash2 style={{ width:11, height:11 }} />
      </button>
    </div>
  )
}

/* ━━━ Forms ━━━ */
const inputStyle: React.CSSProperties = { width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${C.border}`, background:C.input, color:'#ffffff', fontSize:13, outline:'none', fontFamily:'inherit', transition:'border-color 0.15s' }
const inputFocus = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement>) => e.currentTarget.style.borderColor = C.blue
const inputBlur = (e: React.FocusEvent<HTMLInputElement|HTMLSelectElement>) => e.currentTarget.style.borderColor = C.border

function TaskForm({ employees, onDone, onCancel, defaultAssign, locations, thomasId, mariaId }: { employees:Map<string,Employee>; onDone:(d:Partial<Todo>)=>Promise<any>; onCancel:()=>void; defaultAssign?:string; locations:ReturnType<typeof useLocations>; thomasId?:string; mariaId?:string }) {
  const [title, sT] = useState('')
  const [desc, sDe] = useState('')
  const [pri, sP] = useState('Normal')
  const [due, sD] = useState('')
  const [cDate, sCD] = useState('')
  const [assign, sA] = useState(defaultAssign || '')
  const [locId, sLocId] = useState('')
  const [geoLat, sGeoLat] = useState<number | null>(null)
  const [geoLon, sGeoLon] = useState<number | null>(null)
  const [geoAddr, sGeoAddr] = useState('')
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const pickGps = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      sGeoLat(pos.coords.latitude); sGeoLon(pos.coords.longitude)
      sGeoAddr(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`)
      sLocId('')
    })
  }

  const pickLocation = (id: string) => {
    sLocId(id)
    const loc = locations.find(l => l.id === id)
    if (loc && loc.lat && loc.lon) {
      sGeoLat(loc.lat); sGeoLon(loc.lon); sGeoAddr(loc.address || loc.name)
    } else {
      sGeoLat(null); sGeoLon(null); sGeoAddr('')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    sB(true)
    await onDone({ title: title.trim(), description: desc.trim() || null, priority: pri, due_date: cDate || computeDue(due), assigned_to: assign || null, lat: geoLat, lon: geoLon, geo_address: geoAddr || null })
    sB(false)
  }

  return (
    <form onSubmit={submit} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.blue}30`, padding:16, display:'flex', flexDirection:'column', gap:10 }}>
      <input ref={ref} placeholder="Opgavetitel..." value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <textarea placeholder="Beskrivelse / note (valgfrit)..." value={desc} onChange={e=>sDe(e.target.value)} rows={3}
        style={{ ...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit' }}
        onFocus={e => e.currentTarget.style.borderColor = C.blue}
        onBlur={e => e.currentTarget.style.borderColor = C.border} />

      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {PRIORITIES.map(p => (
          <button key={p.value} type="button" onClick={() => sP(p.value)} style={{
            padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${p.color}40`,
            background: pri===p.value ? p.color+'20' : 'transparent', color: pri===p.value ? p.color : C.textMuted,
            transition:'all 0.15s',
          }}>{p.label}</button>
        ))}
      </div>

      <DatePicker value={cDate} onChange={v => { sCD(v); sD('') }} />

      {/* Thomas / Maria quick assign */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        {thomasId && <AssignBtn name="T" label={employees.get(thomasId)?.navn || 'Thomas'} color={C.green} active={assign===thomasId} onClick={() => sA(assign===thomasId ? '' : thomasId)} />}
        {mariaId && <AssignBtn name="M" label={employees.get(mariaId)?.navn || 'Maria'} color={C.pink} active={assign===mariaId} onClick={() => sA(assign===mariaId ? '' : mariaId)} />}
        <select value={assign} onChange={e => sA(e.target.value)} style={{ ...inputStyle, flex:1, color: assign ? C.text : C.textMuted, fontSize:12 }} onFocus={inputFocus as any} onBlur={inputBlur as any}>
          <option value="">Anden medarbejder...</option>
          {[...employees.values()].filter(e => e.id !== thomasId && e.id !== mariaId).sort((a,b) => a.navn.localeCompare(b.navn)).map(e => (
            <option key={e.id} value={e.id}>{e.navn} ({e.location})</option>
          ))}
        </select>
      </div>

      {/* Location picker */}
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <button type="button" onClick={pickGps} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${C.cyan}40`, background: geoLat && !locId ? C.cyan+'18' : 'transparent', color: geoLat && !locId ? C.cyan : C.textMuted, transition:'all 0.15s' }}>
          <Navigation style={{ width:12, height:12 }} /> GPS
        </button>
        <select value={locId} onChange={e => pickLocation(e.target.value)} style={{ ...inputStyle, flex:1, fontSize:11, padding:'5px 8px', color: locId ? C.text : C.textMuted }}>
          <option value="">Vælg lokation fra FLOW...</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {geoAddr && (
          <button type="button" onClick={() => { sGeoLat(null); sGeoLon(null); sGeoAddr(''); sLocId('') }} style={{ padding:3, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer' }}>
            <XCircle style={{ width:14, height:14 }} />
          </button>
        )}
      </div>
      {geoAddr && <div style={{ fontSize:10, color:C.cyan, display:'flex', alignItems:'center', gap:4 }}><MapPin style={{ width:10, height:10 }} />{geoAddr}</div>}

      <div style={{ display:'flex', gap:8, marginTop:2 }}>
        <button type="submit" disabled={!title.trim()||busy} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, transition:'opacity 0.15s', textTransform:'uppercase', letterSpacing:'0.04em' }}>
          {busy ? 'OPRETTER...' : 'OPRET OPGAVE'}
        </button>
        <button type="button" onClick={onCancel} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>ANNULLER</button>
      </div>
    </form>
  )
}

function ShopForm({ onDone, onCancel }: { onDone:(t:string,n?:string,u?:string,d?:string,urg?:boolean)=>Promise<any>; onCancel:()=>void }) {
  const [title, sT] = useState('')
  const [note, sN] = useState('')
  const [url, sU] = useState('')
  const [dueDate, sDD] = useState('')
  const [urgent, sUrg] = useState(false)
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()||busy) return
    sB(true)
    await onDone(title.trim(), note.trim()||undefined, url.trim()||undefined, dueDate||undefined, urgent)
    sB(false)
  }

  return (
    <form onSubmit={submit} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.green}30`, padding:16, display:'flex', flexDirection:'column', gap:8 }}>
      <input ref={ref} placeholder="Hvad skal købes?" value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <input placeholder="Note (valgfrit)" value={note} onChange={e=>sN(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <input placeholder="Link (valgfrit)" value={url} onChange={e=>sU(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <DatePicker value={dueDate} onChange={sDD} style={{ flex:1 }} />
        <button type="button" onClick={() => sUrg(u=>!u)} style={{
          display:'flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer',
          border: `1px solid ${urgent ? C.red+'60' : C.border}`,
          background: urgent ? C.red+'18' : 'transparent',
          color: urgent ? C.red : C.textMuted,
          textTransform:'uppercase',
        }}>
          <Flame style={{ width:12, height:12 }} /> HASTER
        </button>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:2 }}>
        <button type="submit" disabled={!title.trim()||busy} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, textTransform:'uppercase', letterSpacing:'0.04em' }}>
          {busy ? 'TILF\u00d8JER...' : 'TILF\u00d8J'}
        </button>
        <button type="button" onClick={onCancel} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>ANNULLER</button>
      </div>
    </form>
  )
}

/* ━━━ Edit Todo Modal ━━━ */
/* ━━━ Image Upload (drag/drop + click) ━━━ */
function ImageUpload({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const upload = async (files: FileList | File[]) => {
    setUploading(true)
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`
      const { error } = await supabase.storage.from('todo-images').upload(path, file)
      if (!error) {
        const { data } = supabase.storage.from('todo-images').getPublicUrl(path)
        newUrls.push(data.publicUrl)
      }
    }
    if (newUrls.length) onChange([...images, ...newUrls])
    setUploading(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
  }

  return (
    <div>
      {images.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position:'relative', width:72, height:72, borderRadius:8, overflow:'hidden', border:`1px solid ${C.border}` }}>
              <img src={img} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              <button type="button" onClick={() => onChange(images.filter((_,j) => j!==i))} style={{ position:'absolute', top:2, right:2, width:18, height:18, borderRadius:9, background:'rgba(0,0,0,0.7)', border:'none', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X style={{ width:10, height:10 }} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? C.purple : C.border}`,
          borderRadius: 10, padding: '16px 0', textAlign: 'center', cursor: 'pointer',
          background: dragOver ? C.purple+'10' : 'transparent', transition: 'all 0.15s',
        }}
      >
        <Image style={{ width:20, height:20, color: dragOver ? C.purple : C.textMuted, margin:'0 auto 4px' }} />
        <div style={{ fontSize:12, color: dragOver ? C.purple : C.textMuted, fontWeight:500 }}>
          {uploading ? 'Uploader...' : 'Træk billeder hertil eller klik'}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }}
        onChange={e => { if (e.target.files?.length) upload(e.target.files); e.target.value = '' }} />
    </div>
  )
}

function SectionLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 0 6px', borderTop:`1px solid ${C.border}`, marginTop:4 }}>
      <span style={{ color:C.textMuted }}>{icon}</span>
      <span style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</span>
    </div>
  )
}

function LeafletMap({ lat, lon, onMapClick }: { lat: number; lon: number; onMapClick: (lat: number, lon: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    import('leaflet').then(L => {
      // Inject Leaflet CSS if not already present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }

      const map = L.map(containerRef.current!, { zoomControl: true, attributionControl: true }).setView([lat, lon], 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map)

      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41], iconAnchor: [12, 41],
      })

      markerRef.current = L.marker([lat, lon], { icon }).addTo(map)
      mapRef.current = map

      map.on('click', (e: any) => {
        const { lat: cLat, lng: cLon } = e.latlng
        markerRef.current.setLatLng([cLat, cLon])
        onMapClick(cLat, cLon)
      })

      // Fix tiles not loading due to container resize
      setTimeout(() => map.invalidateSize(), 200)
    })

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, []) // eslint-disable-line

  // Update marker + view when lat/lon changes externally
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lon])
      mapRef.current.setView([lat, lon], mapRef.current.getZoom())
    }
  }, [lat, lon])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

function MapPicker({ lat, lon, address, onPick, onClear, locations, onPickLocation, hideOCC }: {
  lat: number | null; lon: number | null; address: string
  onPick: (lat: number, lon: number, addr: string) => void
  onClear: () => void
  locations: ReturnType<typeof useLocations>
  hideOCC?: boolean
  onPickLocation: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [mapOpen, setMapOpen] = useState(!!lat)
  const [reversing, setReversing] = useState(false)

  const reverseGeocode = async (rlat: number, rlon: number) => {
    setReversing(true)
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${rlat}&lon=${rlon}`)
      const data = await resp.json()
      if (data.display_name) {
        onPick(rlat, rlon, data.display_name.split(',').slice(0, 3).join(',').trim())
      } else {
        onPick(rlat, rlon, `${rlat.toFixed(5)}, ${rlon.toFixed(5)}`)
      }
    } catch {
      onPick(rlat, rlon, `${rlat.toFixed(5)}, ${rlon.toFixed(5)}`)
    }
    setReversing(false)
  }

  const searchLocation = async () => {
    if (!search.trim()) return
    setSearching(true)
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=1&countrycodes=dk`)
      const data = await resp.json()
      if (data.length > 0) {
        const r = data[0]
        onPick(parseFloat(r.lat), parseFloat(r.lon), r.display_name.split(',').slice(0, 3).join(','))
        setMapOpen(true)
      }
    } catch { /* ignore */ }
    setSearching(false)
  }

  const useMyGps = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      onPick(pos.coords.latitude, pos.coords.longitude, `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`)
      setMapOpen(true)
    })
  }

  const handleMapClick = (cLat: number, cLon: number) => {
    reverseGeocode(cLat, cLon)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {/* Search bar */}
      <div style={{ display:'flex', gap:6 }}>
        <input
          placeholder="Søg adresse eller sted..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); searchLocation() } }}
          style={{ ...inputStyle, flex:1, fontSize:12 }}
          onFocus={inputFocus} onBlur={inputBlur}
        />
        <button type="button" onClick={searchLocation} disabled={searching} style={{
          padding:'6px 12px', borderRadius:8, fontSize:11, fontWeight:700, border:'none', cursor:'pointer',
          background:C.cyan, color:'#fff', textTransform:'uppercase', opacity: searching ? 0.5 : 1,
        }}>
          {searching ? '...' : 'SØG'}
        </button>
      </div>

      {/* Quick actions */}
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <button type="button" onClick={useMyGps} style={{
          display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
          border:`1px solid ${C.cyan}40`, background: lat ? C.cyan+'18' : 'transparent', color: lat ? C.cyan : C.textMuted, transition:'all 0.15s',
        }}>
          <Navigation style={{ width:12, height:12 }} /> MIN POSITION
        </button>
        <button type="button" onClick={() => { onPick(55.8399, 12.0681, 'Elsenbakken 7, 3600 Frederikssund'); setMapOpen(true) }} style={{
          padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer',
          border:`1px solid ${C.blue}40`, background: address.includes('Frederikssund') ? C.blue+'18' : 'transparent', color: address.includes('Frederikssund') ? C.blue : C.textMuted, transition:'all 0.15s',
        }}>ØST</button>
        <button type="button" onClick={() => { onPick(55.5685, 9.7477, 'Navervej 7, 7000 Fredericia'); setMapOpen(true) }} style={{
          padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer',
          border:`1px solid ${C.amber}40`, background: address.includes('Fredericia') ? C.amber+'18' : 'transparent', color: address.includes('Fredericia') ? C.amber : C.textMuted, transition:'all 0.15s',
        }}>VEST</button>
        {!hideOCC && (
          <select onChange={e => { if (e.target.value) { onPickLocation(e.target.value); setMapOpen(true) }; e.target.value = '' }} style={{ ...inputStyle, flex:1, fontSize:11, padding:'5px 8px', color:C.textMuted }}>
            <option value="">Vælg fra FLOW...</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {!mapOpen && !lat && (
          <button type="button" onClick={() => setMapOpen(true)} style={{
            display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer',
            border:`1px solid ${C.border}`, background:'transparent', color:C.textMuted, transition:'all 0.15s',
          }}>
            <MapPin style={{ width:12, height:12 }} /> VIS KORT
          </button>
        )}
        {address && (
          <button type="button" onClick={() => { onClear(); setMapOpen(false) }} style={{ padding:3, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer' }}>
            <XCircle style={{ width:14, height:14 }} />
          </button>
        )}
      </div>

      {/* Interactive Leaflet map */}
      {mapOpen && (
        <div style={{ borderRadius:10, overflow:'hidden', border:`1px solid ${C.border}`, height:220, position:'relative' }}>
          <LeafletMap
            lat={lat || 55.67}
            lon={lon || 9.54}
            onMapClick={handleMapClick}
          />
          {reversing && (
            <div style={{ position:'absolute', top:8, right:8, background:C.surface+'ee', padding:'4px 10px', borderRadius:6, fontSize:10, color:C.cyan, zIndex:500 }}>
              Henter adresse...
            </div>
          )}
          <div style={{ position:'absolute', bottom:8, left:8, background:C.surface+'dd', padding:'3px 8px', borderRadius:6, fontSize:10, color:C.textMuted, zIndex:500 }}>
            Klik på kortet for at sætte pin
          </div>
        </div>
      )}

      {/* Address display */}
      {address && (
        <div style={{ fontSize:11, color:C.cyan, display:'flex', alignItems:'center', gap:4 }}>
          <MapPin style={{ width:11, height:11, flexShrink:0 }} />{address}
        </div>
      )}
    </div>
  )
}

function EditTodoModal({ todo, employees, locations, thomasId, mariaId, onClose, onSave, onDelete }: {
  todo: Todo; employees: Map<string, Employee>; locations: ReturnType<typeof useLocations>; thomasId?: string; mariaId?: string
  onClose: () => void
  onSave: (updates: Partial<Todo>) => Promise<any>
  onDelete: () => Promise<any>
}) {
  const [title, sT] = useState(todo.title)
  const [desc, sDe] = useState(todo.description || '')
  const [pri, sP] = useState(todo.priority || 'Normal')
  const [cDate, sCD] = useState(todo.due_date || '')
  const [assign, sA] = useState(todo.assigned_to || '')
  const [geoLat, sGeoLat] = useState<number | null>(todo.lat)
  const [geoLon, sGeoLon] = useState<number | null>(todo.lon)
  const [geoAddr, sGeoAddr] = useState(todo.geo_address || '')
  const [images, sImages] = useState<string[]>(todo.images || [])
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const pickLocation = (id: string) => {
    const loc = locations.find(l => l.id === id)
    if (loc && loc.lat && loc.lon) {
      sGeoLat(loc.lat); sGeoLon(loc.lon); sGeoAddr(loc.address || loc.name)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    sB(true)
    await onSave({
      title: title.trim(),
      description: desc.trim() || null,
      priority: pri,
      due_date: cDate || null,
      assigned_to: assign || null,
      lat: geoLat,
      lon: geoLon,
      geo_address: geoAddr || null,
      images: images.length > 0 ? images : null,
    })
    sB(false)
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:560, width:'100%', maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ padding:24 }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>REDIGER OPGAVE</h2>
            <button onClick={onClose} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer' }}>
              <X style={{ width:16, height:16 }} />
            </button>
          </div>

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:4 }}>

            {/* ── SECTION: Opgave ── */}
            <SectionLabel icon={<Pencil style={{ width:12, height:12 }} />} label="Opgave" />
            <input ref={ref} placeholder="Opgavetitel..." value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            <textarea placeholder="Beskrivelse / note (valgfrit)..." value={desc} onChange={e=>sDe(e.target.value)} rows={3}
              style={{ ...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit', marginTop:4 }}
              onFocus={e => e.currentTarget.style.borderColor = C.blue}
              onBlur={e => e.currentTarget.style.borderColor = C.border} />
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:4 }}>
              {PRIORITIES.map(p => (
                <button key={p.value} type="button" onClick={() => sP(p.value)} style={{
                  padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${p.color}40`,
                  background: pri===p.value ? p.color+'20' : 'transparent', color: pri===p.value ? p.color : C.textMuted,
                  transition:'all 0.15s',
                }}>{p.label}</button>
              ))}
            </div>

            {/* ── SECTION: Tid / Dato ── */}
            <SectionLabel icon={<Calendar style={{ width:12, height:12 }} />} label="Tid / Dato" />
            <DatePicker value={cDate} onChange={sCD} />

            {/* ── SECTION: Sted ── */}
            <SectionLabel icon={<MapPin style={{ width:12, height:12 }} />} label="Sted" />
            <MapPicker
              lat={geoLat} lon={geoLon} address={geoAddr}
              onPick={(lat, lon, addr) => { sGeoLat(lat); sGeoLon(lon); sGeoAddr(addr) }}
              onClear={() => { sGeoLat(null); sGeoLon(null); sGeoAddr('') }}
              locations={locations}
              onPickLocation={pickLocation}
            />

            {/* ── SECTION: Tildelt ── */}
            <SectionLabel icon={<Check style={{ width:12, height:12 }} />} label="Tildelt" />
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {thomasId && <AssignBtn name="T" label={employees.get(thomasId)?.navn || 'Thomas'} color={C.green} active={assign===thomasId} onClick={() => sA(assign===thomasId ? '' : thomasId)} />}
              {mariaId && <AssignBtn name="M" label={employees.get(mariaId)?.navn || 'Maria'} color={C.pink} active={assign===mariaId} onClick={() => sA(assign===mariaId ? '' : mariaId)} />}
              <select value={assign} onChange={e => sA(e.target.value)} style={{ ...inputStyle, flex:1, fontSize:12 }} onFocus={inputFocus as any} onBlur={inputBlur as any}>
                <option value="">Anden medarbejder...</option>
                {[...employees.values()].filter(e => e.id !== thomasId && e.id !== mariaId).sort((a,b) => a.navn.localeCompare(b.navn)).map(e => (
                  <option key={e.id} value={e.id}>{e.navn} ({e.location})</option>
                ))}
              </select>
            </div>

            {/* ── SECTION: Billeder ── */}
            <SectionLabel icon={<Image style={{ width:12, height:12 }} />} label="Billeder" />
            <ImageUpload images={images} onChange={sImages} />

            {/* ── Actions ── */}
            <div style={{ display:'flex', gap:8, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
              <button type="submit" disabled={!title.trim()||busy} style={{ padding:'9px 20px', borderRadius:8, fontSize:11, fontWeight:700, background:C.blue, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, transition:'opacity 0.15s', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                {busy ? 'GEMMER...' : 'GEM ÆNDRINGER'}
              </button>
              <button type="button" onClick={onClose} style={{ padding:'9px 20px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>ANNULLER</button>
              <button type="button" onClick={onDelete} style={{ marginLeft:'auto', padding:'9px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red+'18', color:C.red, border:`1px solid ${C.red}30`, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em', display:'flex', alignItems:'center', gap:4 }}>
                <Trash2 style={{ width:12, height:12 }} /> SLET
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ━━━ Quick Create Modal ━━━ */
function QuickCreateModal({ currentUser, onSwitchUser, thomasEmp, mariaEmp, onClose, onSubmit }: {
  currentUser: 'thomas' | 'maria'
  onSwitchUser: (u: 'thomas' | 'maria') => void
  thomasEmp?: Employee
  mariaEmp?: Employee
  onClose: () => void
  onSubmit: (title: string, desc: string) => Promise<any>
}) {
  const [title, sT] = useState('')
  const [desc, sDe] = useState('')
  const [busy, sB] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceTarget, setVoiceTarget] = useState<'title' | 'desc'>('title')
  const recognitionRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const startVoice = (target: 'title' | 'desc') => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Tale-input er ikke understøttet i denne browser. Brug Chrome.'); return }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }

    const recognition = new SR()
    recognition.lang = 'da-DK'
    recognition.continuous = false
    recognition.interimResults = false
    recognitionRef.current = recognition
    setVoiceTarget(target)
    setListening(true)

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      if (target === 'title') sT(prev => prev ? prev + ' ' + transcript : transcript)
      else sDe(prev => prev ? prev + ' ' + transcript : transcript)
      setListening(false)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
  }

  const submit = async () => {
    if (!title.trim() || busy) return
    sB(true)
    await onSubmit(title.trim(), desc.trim())
    sB(false)
  }

  const thomasName = thomasEmp ? thomasEmp.navn.split(' ')[0] : 'Thomas'
  const mariaName = mariaEmp ? mariaEmp.navn.split(' ')[0] : 'Maria'
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, width:'100%', maxWidth:480, maxHeight:'90vh', overflow:'auto' }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Plus style={{ width:18, height:18, color:C.red }} />
            <span style={{ fontSize:15, fontWeight:700, color:C.text }}>HURTIG OPRET</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:9, color:C.textMuted, padding:'2px 6px', borderRadius:4, border:`1px solid ${C.border}` }}>
              {isMac ? '⌘' : 'Ctrl'}+N
            </span>
            <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:C.textMuted, padding:4 }}>
              <X style={{ width:18, height:18 }} />
            </button>
          </div>
        </div>

        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          {/* User switcher */}
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={() => onSwitchUser('thomas')} style={{
              flex:1, padding:'10px 0', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
              border: currentUser === 'thomas' ? `2px solid ${C.blue}` : `1px solid ${C.border}`,
              background: currentUser === 'thomas' ? C.blue + '18' : 'transparent',
              color: currentUser === 'thomas' ? C.blue : C.textMuted,
              transition:'all 0.15s',
            }}>
              {thomasName}
            </button>
            <button type="button" onClick={() => onSwitchUser('maria')} style={{
              flex:1, padding:'10px 0', borderRadius:10, fontSize:13, fontWeight:700, cursor:'pointer',
              border: currentUser === 'maria' ? `2px solid ${C.pink}` : `1px solid ${C.border}`,
              background: currentUser === 'maria' ? C.pink + '18' : 'transparent',
              color: currentUser === 'maria' ? C.pink : C.textMuted,
              transition:'all 0.15s',
            }}>
              {mariaName}
            </button>
          </div>

          {/* Title + voice */}
          <div style={{ display:'flex', gap:8 }}>
            <input
              ref={inputRef}
              placeholder="Hvad skal gøres?..."
              value={title}
              onChange={e => sT(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              style={{ ...inputStyle, flex:1, fontSize:15, padding:'12px 14px' }}
              onFocus={inputFocus} onBlur={inputBlur}
            />
            <button type="button" onClick={() => startVoice('title')} style={{
              width:44, height:44, borderRadius:10, border:`1px solid ${listening && voiceTarget === 'title' ? C.red : C.border}`,
              background: listening && voiceTarget === 'title' ? C.red + '18' : 'transparent',
              color: listening && voiceTarget === 'title' ? C.red : C.textMuted,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              {listening && voiceTarget === 'title' ? <MicOff style={{ width:18, height:18 }} /> : <Mic style={{ width:18, height:18 }} />}
            </button>
          </div>

          {/* Description + voice */}
          <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
            <textarea
              placeholder="Note (valgfrit)..."
              value={desc}
              onChange={e => sDe(e.target.value)}
              rows={2}
              style={{ ...inputStyle, flex:1, resize:'vertical', minHeight:50, fontFamily:'inherit', fontSize:13 }}
              onFocus={e => e.currentTarget.style.borderColor = C.blue}
              onBlur={e => e.currentTarget.style.borderColor = C.border}
            />
            <button type="button" onClick={() => startVoice('desc')} style={{
              width:44, height:44, borderRadius:10, border:`1px solid ${listening && voiceTarget === 'desc' ? C.red : C.border}`,
              background: listening && voiceTarget === 'desc' ? C.red + '18' : 'transparent',
              color: listening && voiceTarget === 'desc' ? C.red : C.textMuted,
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              {listening && voiceTarget === 'desc' ? <MicOff style={{ width:18, height:18 }} /> : <Mic style={{ width:18, height:18 }} />}
            </button>
          </div>

          {/* Hint */}
          <div style={{ fontSize:10, color:C.textMuted, display:'flex', alignItems:'center', gap:6 }}>
            <Keyboard style={{ width:11, height:11 }} />
            Tryk <b>N</b> for hurtig opret &middot; <b>Enter</b> for gem &middot; <b>Esc</b> for luk
          </div>

          {/* Submit */}
          <button onClick={submit} disabled={!title.trim() || busy} style={{
            padding:'12px 0', borderRadius:10, fontSize:13, fontWeight:700,
            background: currentUser === 'thomas' ? C.blue : C.pink,
            color:'#fff', border:'none', cursor:'pointer',
            opacity: (!title.trim() || busy) ? 0.35 : 1,
            textTransform:'uppercase', letterSpacing:'0.04em',
            transition:'opacity 0.15s',
          }}>
            {busy ? 'OPRETTER...' : `OPRET FOR ${currentUser === 'thomas' ? thomasName.toUpperCase() : mariaName.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ━━━ Edit Shopping Modal ━━━ */
function EditShoppingModal({ item, employees, locations, thomasId, mariaId, onClose, onSave, onDelete, onConvertToTask }: {
  item: ShoppingItem; employees: Map<string, Employee>; locations: ReturnType<typeof useLocations>; thomasId?: string; mariaId?: string
  onClose: () => void
  onSave: (updates: Partial<ShoppingItem>) => Promise<any>
  onDelete: () => Promise<any>
  onConvertToTask: () => Promise<any>
}) {
  const [title, sT] = useState(item.title)
  const [note, sN] = useState(item.note || '')
  const [url, sU] = useState(item.url || '')
  const [urgent, sUrg] = useState(item.urgent)
  const [cDate, sCD] = useState(item.due_date || '')
  const [assign, sA] = useState(item.assigned_to || '')
  const [geoLat, sGeoLat] = useState<number | null>(item.lat)
  const [geoLon, sGeoLon] = useState<number | null>(item.lon)
  const [geoAddr, sGeoAddr] = useState(item.geo_address || '')
  const [images, sImages] = useState<string[]>(item.images || [])
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const pickLocation = (id: string) => {
    const loc = locations.find(l => l.id === id)
    if (loc && loc.lat && loc.lon) {
      sGeoLat(loc.lat); sGeoLon(loc.lon); sGeoAddr(loc.address || loc.name)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    sB(true)
    await onSave({
      title: title.trim(),
      note: note.trim() || null,
      url: url.trim() || null,
      urgent,
      due_date: cDate || null,
      assigned_to: assign || null,
      lat: geoLat,
      lon: geoLon,
      geo_address: geoAddr || null,
      images: images.length > 0 ? images : null,
    })
    sB(false)
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:560, width:'100%', maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>REDIGER INDKØB</h2>
            <button onClick={onClose} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer' }}>
              <X style={{ width:16, height:16 }} />
            </button>
          </div>

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:4 }}>

            {/* ── SECTION: Indkøb ── */}
            <SectionLabel icon={<ShoppingCart style={{ width:12, height:12 }} />} label="Indkøb" />
            <input ref={ref} placeholder="Hvad skal købes?" value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            <textarea placeholder="Note (valgfrit)..." value={note} onChange={e=>sN(e.target.value)} rows={2}
              style={{ ...inputStyle, resize:'vertical', minHeight:48, fontFamily:'inherit', marginTop:4 }}
              onFocus={e => e.currentTarget.style.borderColor = C.blue}
              onBlur={e => e.currentTarget.style.borderColor = C.border} />
            <input placeholder="Link (valgfrit)" value={url} onChange={e=>sU(e.target.value)} style={{ ...inputStyle, marginTop:4 }} onFocus={inputFocus} onBlur={inputBlur} />
            <div style={{ marginTop:4 }}>
              <button type="button" onClick={() => sUrg(u=>!u)} style={{
                display:'flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer',
                border: `1px solid ${urgent ? C.red+'60' : C.border}`,
                background: urgent ? C.red+'18' : 'transparent',
                color: urgent ? C.red : C.textMuted,
                textTransform:'uppercase',
              }}>
                <Flame style={{ width:12, height:12 }} /> HASTER
              </button>
            </div>

            {/* ── SECTION: Tid / Dato ── */}
            <SectionLabel icon={<Calendar style={{ width:12, height:12 }} />} label="Tid / Dato" />
            <DatePicker value={cDate} onChange={sCD} />

            {/* ── SECTION: Sted ── */}
            <SectionLabel icon={<MapPin style={{ width:12, height:12 }} />} label="Sted" />
            <MapPicker
              lat={geoLat} lon={geoLon} address={geoAddr}
              onPick={(lat, lon, addr) => { sGeoLat(lat); sGeoLon(lon); sGeoAddr(addr) }}
              onClear={() => { sGeoLat(null); sGeoLon(null); sGeoAddr('') }}
              locations={locations}
              onPickLocation={pickLocation}
              hideOCC
            />

            {/* ── SECTION: Tildelt ── */}
            <SectionLabel icon={<Check style={{ width:12, height:12 }} />} label="Tildelt" />
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {thomasId && <AssignBtn name="T" label={employees.get(thomasId)?.navn || 'Thomas'} color={C.green} active={assign===thomasId} onClick={() => sA(assign===thomasId ? '' : thomasId)} />}
              {mariaId && <AssignBtn name="M" label={employees.get(mariaId)?.navn || 'Maria'} color={C.pink} active={assign===mariaId} onClick={() => sA(assign===mariaId ? '' : mariaId)} />}
              <select value={assign} onChange={e => sA(e.target.value)} style={{ ...inputStyle, flex:1, fontSize:12 }} onFocus={inputFocus as any} onBlur={inputBlur as any}>
                <option value="">Anden medarbejder...</option>
                {[...employees.values()].filter(e => e.id !== thomasId && e.id !== mariaId).sort((a,b) => a.navn.localeCompare(b.navn)).map(e => (
                  <option key={e.id} value={e.id}>{e.navn} ({e.location})</option>
                ))}
              </select>
            </div>

            {/* ── SECTION: Billeder ── */}
            <SectionLabel icon={<Image style={{ width:12, height:12 }} />} label="Billeder" />
            <ImageUpload images={images} onChange={sImages} />

            {/* ── Actions ── */}
            <div style={{ display:'flex', gap:8, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}`, flexWrap:'wrap' }}>
              <button type="submit" disabled={!title.trim()||busy} style={{ padding:'9px 20px', borderRadius:8, fontSize:11, fontWeight:700, background:C.blue, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                {busy ? 'GEMMER...' : 'GEM ÆNDRINGER'}
              </button>
              <button type="button" onClick={onConvertToTask} style={{ padding:'9px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.amber+'18', color:C.amber, border:`1px solid ${C.amber}30`, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em', display:'flex', alignItems:'center', gap:4 }}>
                <ArrowRight style={{ width:12, height:12 }} /> OVERFØR TIL TASK
              </button>
              <button type="button" onClick={onClose} style={{ padding:'9px 16px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>ANNULLER</button>
              <button type="button" onClick={onDelete} style={{ marginLeft:'auto', padding:'9px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red+'18', color:C.red, border:`1px solid ${C.red}30`, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em', display:'flex', alignItems:'center', gap:4 }}>
                <Trash2 style={{ width:12, height:12 }} /> SLET
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ━━━ Idea Detail Modal ━━━ */
function IdeaModal({ todo, emp, onClose, onDelete, onAddTodo, onAddShopping }: {
  todo: Todo; emp?: Employee
  onClose: () => void
  onDelete: () => Promise<any>
  onAddTodo: (title: string, desc: string | null) => Promise<any>
  onAddShopping: (title: string, note?: string, url?: string) => Promise<any>
}) {
  const title = decodeHtmlEntities(todo.title)
  const desc = parseDescription(todo.description)
  const [busy, setBusy] = useState('')

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:40 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:560, width:'100%', maxHeight:'80vh', overflow:'auto' }}>

        {/* Image header */}
        {desc.image && (
          <div style={{ width:'100%', height:220, background:C.card, overflow:'hidden', borderRadius:'16px 16px 0 0' }}>
            <img src={desc.image} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          </div>
        )}

        <div style={{ padding:24 }}>
          {/* Title + close */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 }}>
            <div style={{ flex:1 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:C.text, lineHeight:1.3 }}>{title}</h2>
              <div style={{ fontSize:12, color:C.textMuted, marginTop:6 }}>
                {todo.category && <span>{getCategoryLabel(todo.category)}</span>}
                {emp && <span> &middot; {emp.navn}</span>}
                {todo.created_at && <span> &middot; {new Date(todo.created_at).toLocaleDateString('da-DK', { day:'numeric', month:'short', year:'numeric' })}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer', flexShrink:0 }}>
              <X style={{ width:16, height:16 }} />
            </button>
          </div>

          {/* Description */}
          {desc.text && (
            <p style={{ fontSize:14, color:C.textSec, lineHeight:1.7, marginBottom:16 }}>{desc.text}</p>
          )}

          {/* Tags */}
          {desc.tags && desc.tags.length > 0 && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {desc.tags.map((tag, i) => (
                <span key={i} style={{ fontSize:11, fontWeight:500, padding:'3px 10px', borderRadius:6, background:C.purple+'14', color:C.purple }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Link */}
          {desc.url && (
            <div style={{ marginBottom:20 }}>
              <a href={desc.url} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:C.blue, textDecoration:'none', padding:'6px 12px', borderRadius:8, background:C.blue+'10', border:`1px solid ${C.blue}25` }}>
                <ExternalLink style={{ width:13, height:13 }} /> Se original
              </a>
            </div>
          )}

          {/* Gallery images */}
          {desc.images && desc.images.length > 1 && (
            <div style={{ display:'flex', gap:8, marginBottom:20, overflowX:'auto' }}>
              {desc.images.slice(0, 6).map((img, i) => (
                <img key={i} src={img} alt="" style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:`1px solid ${C.border}`, flexShrink:0 }} />
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display:'flex', gap:8, borderTop:`1px solid ${C.border}`, paddingTop:16, marginTop:8 }}>
            <button
              disabled={!!busy}
              onClick={async () => { setBusy('todo'); await onAddTodo(title, desc.text || null); setBusy('') }}
              style={{ flex:1, padding:'10px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.blue, color:'#fff', border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em', opacity: busy ? 0.5 : 1, transition:'opacity 0.15s' }}>
              {busy === 'todo' ? 'OVERFØRER...' : 'TILFØJ TIL TODO'}
            </button>
            <button
              disabled={!!busy}
              onClick={async () => { setBusy('shop'); await onAddShopping(title, desc.text || undefined, desc.url); setBusy('') }}
              style={{ flex:1, padding:'10px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.green, color:'#fff', border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em', opacity: busy ? 0.5 : 1, transition:'opacity 0.15s' }}>
              {busy === 'shop' ? 'OVERFØRER...' : 'TILFØJ TIL INDKØB'}
            </button>
            <button
              disabled={!!busy}
              onClick={async () => { if (confirm('Slet denne idé permanent?')) { setBusy('del'); await onDelete(); setBusy('') } }}
              style={{ padding:'10px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em', opacity: busy ? 0.5 : 1, transition:'opacity 0.15s' }}>
              {busy === 'del' ? 'SLETTER...' : 'SLET'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
