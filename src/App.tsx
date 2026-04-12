import { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { useTodos } from './hooks/useTodos'
import { useEmployees } from './hooks/useEmployees'
import { useShopping } from './hooks/useShopping'
import { usePhoneCalls } from './hooks/usePhoneCalls'
import { useTransport } from './hooks/useTransport'
import { useLists } from './hooks/useLists'
import { useGeofence } from './hooks/useGeofence'
import { useWakeLock } from './hooks/useWakeLock'
import { supabase } from './lib/supabase'
import { useLocations } from './hooks/useLocations'
import type { Todo, Employee, ShoppingItem, PhoneCall, TransportItem } from './lib/types'
import {
  getPriorityColor, getPriorityOrder, getPriorityLabel,
  isIdeaCategory, getCategoryLabel, parseDescription,
  decodeHtmlEntities, isOverdue, getInitials, hashColor,
} from './lib/utils'
import {
  Plus, Check, Trash2, ChevronDown, ChevronRight, AlertTriangle,
  ExternalLink, MapPin, Calendar, Loader2, X, Lightbulb, Flame, Pencil,
  Navigation, XCircle, ChevronLeft, ArrowRight, ShoppingCart, Image, Phone, Truck, ArrowLeft, Printer, User, Briefcase,
  Mic, MicOff, Keyboard, Bell,
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
  { value: 'Normal', label: 'Haster ikke', color: C.blue },
  { value: 'let', label: 'Let', color: C.green },
]

const CAT_COLORS: Record<string, string> = {
  'idea-inspiration': C.purple,
  'idea-activity': C.pink,
  'idea-company': C.cyan,
  'IDEER': C.amber,
  'CODE': C.purple,
  'REPAIR': C.amber,
}

/* ━━━ App ━━━ */
export default function App() {
  const { todos, loading, connected, addTodo, updateTodo, deleteTodo } = useTodos()
  const employees = useEmployees()
  const shop = useShopping()
  const calls = usePhoneCalls()
  const transport = useTransport()
  const locations = useLocations()
  const { nearbyItems, watching: gpsActive } = useGeofence(todos, shop.items)
  useWakeLock()
  const [addingTaskThomas, setAddingTaskThomas] = useState(false)
  const [addingTaskMaria, setAddingTaskMaria] = useState(false)
  const [addingShop, setAddingShop] = useState(false)
  const [selectedIdea, setSelectedIdea] = useState<Todo | null>(null)
  const [editingShop, setEditingShop] = useState<ShoppingItem | null>(null)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [addingCall, setAddingCall] = useState(false)
  const [editingCall, setEditingCall] = useState<PhoneCall | null>(null)
  const [addingTaskCrew, setAddingTaskCrew] = useState(false)
  const [addingTaskInbox, setAddingTaskInbox] = useState(false)
  const [addingTaskToday, setAddingTaskToday] = useState(false)
  const [addingTaskUpcoming, setAddingTaskUpcoming] = useState(false)
  const [addingCode, setAddingCode] = useState(false)
  const [addingRepair, setAddingRepair] = useState(false)
  const [addingTransport, setAddingTransport] = useState(false)
  const [editingTransport, setEditingTransport] = useState<TransportItem | null>(null)
  const [showPrintTransport, setShowPrintTransport] = useState(false)
  const [showPersonalView, setShowPersonalView] = useState<string | null>(null)
  // Landing overlay — skipped on refresh if ?view= already exists in URL.
  // Default: show landing on very first entry (no view param yet).
  const [landingDismissed, setLandingDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).has('view')
  })
  const showLanding = !landingDismissed
  const setShowLanding = (v: boolean) => { setLandingDismissed(!v) }
  const [showIdeas, setShowIdeas] = useState(false)
  const [, setMobileTab] = useState<number>(0)
  const [quickCreate, setQuickCreate] = useState(false)
  const [currentUser, setCurrentUser] = useState<'thomas' | 'maria'>(() => (localStorage.getItem('todo-user') as any) || 'thomas')

  // Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (PC) to quick-create, or plain N when not typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      // Cmd/Ctrl+K works even inside inputs
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setQuickCreate(true)
        return
      }
      // Plain N only when not typing
      if (!isTyping && (e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
    const t = active.filter(t => {
      if (isIdeaCategory(t.category)) return false
      const c = t.category
      if (c === 'CODE' || c === 'REPAIR') return false
      if (c?.startsWith('custom:')) return false
      return true
    })
    t.sort((a,b) => {
      const d = getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
      return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return t
  }, [active])

  // Find Thomas and Maria employee IDs
  const thomasEmp = useMemo(() => [...employees.values()].find(e => e.navn.toLowerCase().includes('thomas')), [employees])
  const mariaEmp = useMemo(() => [...employees.values()].find(e => e.navn.toLowerCase().includes('maria')), [employees])
  const kimEmp = useMemo(() => [...employees.values()].find(e => e.navn.toLowerCase().includes('kim schrøder')), [employees])
  void useMemo(() => [...employees.values()].find(e => e.navn.toLowerCase().includes('jesper')), [employees])
  void useMemo(() => [...employees.values()].find(e => e.navn.toLowerCase().includes('steen')), [employees])

  // Person views show ALL active tasks assigned to that person, regardless of category (CODE, REPAIR, custom, etc.)
  const thomasTasks = useMemo(() => active.filter(t => !isIdeaCategory(t.category) && t.assigned_to === thomasEmp?.id).sort((a,b) => {
    const d = getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
    return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }), [active, thomasEmp])
  const mariaTasks = useMemo(() => active.filter(t => !isIdeaCategory(t.category) && t.assigned_to === mariaEmp?.id).sort((a,b) => {
    const d = getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
    return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }), [active, mariaEmp])
  const crewTasks = useMemo(() => active.filter(t => !isIdeaCategory(t.category) && t.assigned_to && t.assigned_to !== thomasEmp?.id && t.assigned_to !== mariaEmp?.id).sort((a,b) => {
    const d = getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
    return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  }), [active, thomasEmp, mariaEmp])
  const personSectionCounts = useMemo(() => {
    const c: Record<string, number> = {}
    thomasTasks.forEach(t => { if (t.section_id) c[`thomas:${t.section_id}`] = (c[`thomas:${t.section_id}`] || 0) + 1 })
    mariaTasks.forEach(t => { if (t.section_id) c[`maria:${t.section_id}`] = (c[`maria:${t.section_id}`] || 0) + 1 })
    return c
  }, [thomasTasks, mariaTasks])
  const unassignedTasks = useMemo(() => tasks.filter(t => !t.assigned_to), [tasks])
  const codeTasks = useMemo(() => {
    const t = active.filter(x => x.category === 'CODE')
    t.sort((a,b) => {
      const d = getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
      return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return t
  }, [active])
  const repairTasks = useMemo(() => {
    const t = active.filter(x => x.category === 'REPAIR')
    t.sort((a,b) => {
      const d = getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
      return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return t
  }, [active])

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

  const activeCalls = calls.items.filter(c => !c.completed).sort((a,b) => {
    if (a.urgent && !b.urgent) return -1
    if (!a.urgent && b.urgent) return 1
    return 0
  })
  const completedCalls = calls.items.filter(c => c.completed)

  const activeTransport = transport.items.filter(i => !i.completed)
  const completedTransport = transport.items.filter(i => i.completed)
  const toWest = activeTransport.filter(i => i.direction === 'east_to_west')
  const toEast = activeTransport.filter(i => i.direction === 'west_to_east')

  // Responsive
  const [winW, setWinW] = useState(window.innerWidth)
  useEffect(() => {
    const h = () => setWinW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  const isMobile = winW < 768
  const isTablet = winW >= 768 && winW < 1200
  void isTablet // tablet breakpoint no longer used with sidebar layout

  // Due tasks popup - only shown when user clicks a specific person from landing
  const [duePopupFor, setDuePopupFor] = useState<'thomas' | 'maria' | 'crew' | null>(null)
  const todayStr = new Date().toISOString().slice(0,10)

  // Helper: count of tasks that are overdue or due today in a list
  const dueFlagCount = (list: { due_date: string | null }[]) => list.filter(x => {
    if (!x.due_date) return false
    return x.due_date <= todayStr
  }).length
  const dueTodayTasks = useMemo(() => active.filter(t => !isIdeaCategory(t.category) && t.due_date === todayStr), [active, todayStr])
  const upcomingTasks = useMemo(() => tasks.filter(t => t.due_date && t.due_date > todayStr).sort((a,b) => (a.due_date || '').localeCompare(b.due_date || '')), [tasks, todayStr])
  const todayTasks = useMemo(() => [...overdue, ...dueTodayTasks.filter(t => !overdue.includes(t))], [overdue, dueTodayTasks])
  // "Denne uge" — tasks due within 7 days (including today + overdue)
  const weekEndStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return d.toISOString().slice(0,10)
  }, [])
  const weekTasks = useMemo(() => {
    return [...overdue, ...tasks.filter(t => t.due_date && t.due_date >= todayStr && t.due_date <= weekEndStr && !overdue.includes(t))]
      .sort((a,b) => (a.due_date || '').localeCompare(b.due_date || ''))
  }, [overdue, tasks, todayStr, weekEndStr])
  // Group upcoming tasks by due date
  const upcomingGrouped = useMemo(() => {
    const groups = new Map<string, Todo[]>()
    upcomingTasks.forEach(t => {
      const k = t.due_date || 'no-date'
      groups.set(k, [...(groups.get(k) || []), t])
    })
    return [...groups.entries()]
  }, [upcomingTasks])

  // Sidebar / view state — persisted in URL via nuqs so refresh keeps the view
  const [currentView, setCurrentViewQS] = useQueryState('view', parseAsString.withDefault('today'))
  const setCurrentView = (v: string) => { setCurrentViewQS(v) }
  const [sidebarOpen, setSidebarOpen] = useState(winW >= 768)
  useEffect(() => { if (winW >= 768) setSidebarOpen(true) }, [winW])

  // Custom lists + list sections — persisted in Supabase
  const { customLists, sectionsByList, addCustomList: addCustomListDb, renameCustomList: renameCustomListDb, deleteCustomList: deleteCustomListDb,
          addSection, renameSection, setSectionColor, deleteSection } = useLists()
  const [creatingList, setCreatingList] = useState(false)
  const addCustomList = (name: string, color: string) => { addCustomListDb(name, color) }
  const renameCustomList = (id: string, name: string) => { renameCustomListDb(id, name) }
  const deleteCustomList = (id: string) => {
    deleteCustomListDb(id)
    if (currentView === `custom:${id}`) setCurrentView('today')
  }
  const addListSection = (listKey: string, name: string, color?: string) => { addSection(listKey, name, color) }
  const renameListSection = (_listKey: string, sectionId: string, name: string) => { renameSection(sectionId, name) }
  const setListSectionColor = (_listKey: string, sectionId: string, color: string) => { setSectionColor(sectionId, color) }
  const deleteListSection = async (_listKey: string, sectionId: string) => {
    // Clear section_id on any tasks in this section (DB cascade handles it via on delete set null)
    await deleteSection(sectionId)
  }

  // Group tasks by section for a given list key (uses todo.section_id)
  const groupTasksBySection = (listKey: string, tasks: Todo[]): { sectionId: string | null; name: string; color?: string | null; items: Todo[] }[] => {
    const sections = sectionsByList[listKey] || []
    const groups: { sectionId: string | null; name: string; color?: string | null; items: Todo[] }[] = [
      { sectionId: null, name: 'Ingen sektion', items: [] },
    ]
    sections.forEach(s => groups.push({ sectionId: s.id, name: s.name, color: s.color, items: [] }))
    tasks.forEach(t => {
      const target = groups.find(g => g.sectionId === t.section_id) || groups[0]
      target.items.push(t)
    })
    return groups
  }
  // Map custom lists to their tasks
  const customListTasks = useMemo(() => {
    const m = new Map<string, Todo[]>()
    customLists.forEach(l => {
      m.set(l.id, active.filter(t => t.category === `custom:${l.id}`).sort((a,b) => {
        const d = getPriorityOrder(a.priority) - getPriorityOrder(b.priority)
        return d !== 0 ? d : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }))
    })
    return m
  }, [active, customLists])

  // Filter popup content by the selected person
  const popupFilter = (t: Todo) => {
    if (duePopupFor === 'thomas') return t.assigned_to === thomasEmp?.id
    if (duePopupFor === 'maria') return t.assigned_to === mariaEmp?.id
    if (duePopupFor === 'crew') return !!t.assigned_to && t.assigned_to !== thomasEmp?.id && t.assigned_to !== mariaEmp?.id
    return false
  }
  const popupOverdue = duePopupFor ? overdue.filter(popupFilter) : []
  const popupDueToday = duePopupFor ? dueTodayTasks.filter(popupFilter) : []
  const showDuePopup = !!duePopupFor && !loading && (popupOverdue.length > 0 || popupDueToday.length > 0)

  if (loading) return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <Loader2 style={{ width:32, height:32, color:C.blue }} className="animate-spin" />
    </div>
  )

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:C.bg }}>

      {/* ── Due Tasks Popup ── */}
      {showDuePopup && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:20 }}>
          <div style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:500, width:'100%', maxHeight:'80vh', overflow:'auto' }}>
            <div style={{ padding:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <AlertTriangle style={{ width:20, height:20, color:C.red }} />
                <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>
                  {duePopupFor === 'thomas' ? `OPGAVER FOR ${firstName(thomasEmp, 'THOMAS').toUpperCase()}` :
                   duePopupFor === 'maria' ? `OPGAVER FOR ${firstName(mariaEmp, 'MARIA').toUpperCase()}` :
                   'OPGAVER FOR CREW'}
                </h2>
              </div>

              {popupOverdue.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.red, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Overskredet ({popupOverdue.length})</div>
                  {popupOverdue.map(t => (
                    <div key={t.id} style={{ padding:'8px 12px', borderRadius:8, background:C.red+'08', border:`1px solid ${C.red}20`, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:getPriorityColor(t.priority)+'20', color:getPriorityColor(t.priority) }}>{getPriorityLabel(t.priority)}</span>
                      <span style={{ fontSize:12, fontWeight:500, color:C.text, flex:1 }}>{t.title}</span>
                      {t.due_date && <span style={{ fontSize:10, color:C.red }}>{new Date(t.due_date).toLocaleDateString('da-DK', { day:'numeric', month:'short' })}</span>}
                    </div>
                  ))}
                </div>
              )}

              {popupDueToday.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:C.amber, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>I dag ({popupDueToday.length})</div>
                  {popupDueToday.map(t => (
                    <div key={t.id} style={{ padding:'8px 12px', borderRadius:8, background:C.amber+'08', border:`1px solid ${C.amber}20`, marginBottom:4, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:getPriorityColor(t.priority)+'20', color:getPriorityColor(t.priority) }}>{getPriorityLabel(t.priority)}</span>
                      <span style={{ fontSize:12, fontWeight:500, color:C.text, flex:1 }}>{t.title}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setDuePopupFor(null)} style={{ width:'100%', padding:'10px 20px', borderRadius:8, fontSize:12, fontWeight:700, background:C.blue, color:'#fff', border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                OK, FORSTÅET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overdue alert ── */}
      {overdue.length > 0 && (
        <div style={{ background:'rgba(240,96,96,0.07)', borderBottom:`1px solid rgba(240,96,96,0.2)`, padding:'10px 0' }}>
          <div style={{ maxWidth:1200, margin:'0 auto', padding:'0 40px', display:'flex', alignItems:'center', gap:10 }}>
            <AlertTriangle style={{ width:16, height:16, color:C.red, flexShrink:0 }} />
            <span style={{ fontSize:13, fontWeight:600, color:C.red }}>
              {overdue.length} {overdue.length > 1 ? 'overskredne' : 'overskredet'} opgave{overdue.length > 1 ? 'r' : ''}
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

      {/* ── Sidebar + Main area ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'row', minHeight:0 }}>
        <Sidebar
          open={sidebarOpen}
          isMobile={isMobile}
          onClose={() => setSidebarOpen(false)}
          currentView={currentView}
          setCurrentView={(v) => { setCurrentView(v); if (isMobile) setSidebarOpen(false) }}
          counts={{
            today: todayTasks.length,
            week: weekTasks.length,
            upcoming: upcomingTasks.length,
            inbox: unassignedTasks.length,
            thomas: thomasTasks.length,
            maria: mariaTasks.length,
            crew: crewTasks.length,
            phone: activeCalls.length,
            code: codeTasks.length,
            repair: repairTasks.length,
            transport: activeTransport.length,
            shop: pendShop.length,
            ideas: ideaGroups.reduce((s,[,v])=>s+v.length,0),
          }}
          dueCounts={{
            today: todayTasks.length,
            week: dueFlagCount(weekTasks),
            thomas: dueFlagCount(thomasTasks),
            maria: dueFlagCount(mariaTasks),
            crew: dueFlagCount(crewTasks),
            phone: dueFlagCount(activeCalls),
            code: dueFlagCount(codeTasks),
            repair: dueFlagCount(repairTasks),
            shop: dueFlagCount(pendShop),
          }}
          thomasName={firstName(thomasEmp, 'Thomas')}
          mariaName={firstName(mariaEmp, 'Maria')}
          thomasId={thomasEmp?.id}
          mariaId={mariaEmp?.id}
          gpsActive={gpsActive}
          connected={connected}
          onQuickCreate={() => setQuickCreate(true)}
          onShowPrintTransport={() => setShowPrintTransport(true)}
          customLists={customLists}
          customListCounts={Object.fromEntries(customLists.map(l => [l.id, customListTasks.get(l.id)?.length || 0]))}
          customListDueCounts={Object.fromEntries(customLists.map(l => [l.id, dueFlagCount(customListTasks.get(l.id) || [])]))}
          onCreateList={() => setCreatingList(true)}
          onDeleteCustomList={deleteCustomList}
          sectionsByList={sectionsByList}
          sectionCounts={personSectionCounts}
          onDropTodo={async (view, id) => {
            const secMatch = /^(thomas|maria):sec:(.+)$/.exec(view)
            if (secMatch) {
              const [, parentKey, secId] = secMatch
              if (parentKey === 'thomas') await updateTodo(id, { section_id: secId, assigned_to: thomasEmp?.id || null, category: null })
              else await updateTodo(id, { section_id: secId, assigned_to: mariaEmp?.id || null, category: null })
              return
            }
            if (view === 'thomas') await updateTodo(id, { assigned_to: thomasEmp?.id || null, category: null })
            else if (view === 'maria') await updateTodo(id, { assigned_to: mariaEmp?.id || null, category: null })
            else if (view === 'crew') await updateTodo(id, { category: null })
            else if (view === 'code') await updateTodo(id, { category: 'CODE' })
            else if (view === 'repair') await updateTodo(id, { category: 'REPAIR' })
            else if (view === 'inbox') await updateTodo(id, { assigned_to: null, category: null })
            else if (view.startsWith('custom:')) await updateTodo(id, { category: view })
          }}
        />

        {/* Mobile sidebar backdrop */}
        {isMobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:899 }} />
        )}

        {/* Main area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
          <MainViewHeader
            currentView={currentView}
            isMobile={isMobile}
            onToggleSidebar={() => setSidebarOpen(o => !o)}
            counts={{
              today: todayTasks.length, week: weekTasks.length, upcoming: upcomingTasks.length, inbox: unassignedTasks.length,
              thomas: thomasTasks.length, maria: mariaTasks.length, crew: crewTasks.length,
              phone: activeCalls.length, code: codeTasks.length, repair: repairTasks.length,
              transport: activeTransport.length, shop: pendShop.length,
              ideas: ideaGroups.reduce((s,[,v])=>s+v.length,0),
            }}
            thomasName={firstName(thomasEmp, 'Thomas')}
            mariaName={firstName(mariaEmp, 'Maria')}
            customLists={customLists}
            customListCount={currentView.startsWith('custom:') ? (customListTasks.get(currentView.slice(7))?.length || 0) : 0}
            onRenameCustomList={renameCustomList}
            titleOverride={(() => {
              const m = /^(thomas|maria):sec:(.+)$/.exec(currentView)
              if (!m) return undefined
              const parentKey = m[1] as 'thomas' | 'maria'
              const section = (sectionsByList[parentKey] || []).find(s => s.id === m[2])
              const parentName = parentKey === 'thomas' ? firstName(thomasEmp, 'Thomas') : firstName(mariaEmp, 'Maria')
              return `${parentName} – ${section?.name || 'Sektion'}`
            })()}
            countOverride={(() => {
              const m = /^(thomas|maria):sec:(.+)$/.exec(currentView)
              if (!m) return undefined
              return personSectionCounts[`${m[1]}:${m[2]}`] || 0
            })()}
          />
          <div style={{ flex:1, overflowY:'auto' }}>
            <div style={{ maxWidth:900, margin:'0 auto', padding: isMobile ? '16px' : '24px 40px 48px' }}>

              {/* Thomas */}
              {currentView === 'thomas' && (<>
                {addingTaskThomas && <TaskForm employees={employees} defaultAssign={thomasEmp?.id} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo({ ...d, assigned_to: d.assigned_to || thomasEmp?.id || null }); setAddingTaskThomas(false) }} onCancel={() => setAddingTaskThomas(false)} />}
                {!addingTaskThomas && <AddRow label="Tilføj opgave" onClick={() => setAddingTaskThomas(true)} />}
                <SectionManager listKey="thomas" sections={sectionsByList['thomas'] || []} onAdd={name => addListSection('thomas', name)} />
                <SectionedList
                  listKey="thomas"
                  groups={groupTasksBySection('thomas', thomasTasks)}
                  color={C.blue}
                  employees={employees}
                  onToggle={t => updateTodo(t.id, { resolved: true })}
                  onDelete={t => deleteTodo(t.id)}
                  onClickTask={t => setEditingTodo(t)}
                  onDropTodo={async (id, sectionId) => { await updateTodo(id, { section_id: sectionId, assigned_to: thomasEmp?.id || null, category: null }) }}
                  onDeleteSection={sid => deleteListSection('thomas', sid)}
                  onRenameSection={(sid, name) => renameListSection('thomas', sid, name)}
                  onSetSectionColor={(sid, col) => setListSectionColor('thomas', sid, col)}
                />
                {thomasTasks.length === 0 && !addingTaskThomas && <Empty text="Ingen aktive opgaver" />}
              </>)}

              {/* Maria */}
              {currentView === 'maria' && (<>
                {addingTaskMaria && <TaskForm employees={employees} defaultAssign={mariaEmp?.id} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo({ ...d, assigned_to: d.assigned_to || mariaEmp?.id || null }); setAddingTaskMaria(false) }} onCancel={() => setAddingTaskMaria(false)} />}
                {!addingTaskMaria && <AddRow label="Tilføj opgave" onClick={() => setAddingTaskMaria(true)} />}
                <SectionManager listKey="maria" sections={sectionsByList['maria'] || []} onAdd={name => addListSection('maria', name)} />
                <SectionedList
                  listKey="maria"
                  groups={groupTasksBySection('maria', mariaTasks)}
                  color={C.pink}
                  employees={employees}
                  onToggle={t => updateTodo(t.id, { resolved: true })}
                  onDelete={t => deleteTodo(t.id)}
                  onClickTask={t => setEditingTodo(t)}
                  onDropTodo={async (id, sectionId) => { await updateTodo(id, { section_id: sectionId, assigned_to: mariaEmp?.id || null, category: null }) }}
                  onDeleteSection={sid => deleteListSection('maria', sid)}
                  onRenameSection={(sid, name) => renameListSection('maria', sid, name)}
                  onSetSectionColor={(sid, col) => setListSectionColor('maria', sid, col)}
                />
                {mariaTasks.length === 0 && !addingTaskMaria && <Empty text="Ingen aktive opgaver" />}
              </>)}

              {/* Thomas/Maria section sub-view */}
              {(() => {
                const m = /^(thomas|maria):sec:(.+)$/.exec(currentView)
                if (!m) return null
                const parentKey = m[1] as 'thomas' | 'maria'
                const secId = m[2]
                const section = (sectionsByList[parentKey] || []).find(s => s.id === secId)
                if (!section) return <Empty text="Sektionen findes ikke" />
                const parentEmp = parentKey === 'thomas' ? thomasEmp : mariaEmp
                const parentColor = parentKey === 'thomas' ? C.blue : C.pink
                const secColor = section.color || parentColor
                const parentTasks = parentKey === 'thomas' ? thomasTasks : mariaTasks
                const items = parentTasks.filter(t => t.section_id === secId)
                const adding = parentKey === 'thomas' ? addingTaskThomas : addingTaskMaria
                const setAdding = parentKey === 'thomas' ? setAddingTaskThomas : setAddingTaskMaria
                return (
                  <>
                    {adding && <TaskForm employees={employees} defaultAssign={parentEmp?.id} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo({ ...d, assigned_to: d.assigned_to || parentEmp?.id || null, section_id: secId, category: null }); setAdding(false) }} onCancel={() => setAdding(false)} />}
                    {!adding && <AddRow label={`Tilføj til ${section.name}`} onClick={() => setAdding(true)} />}
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px 10px', borderBottom:`1px solid ${C.border}`, marginBottom:10 }}>
                      <div style={{ width:4, height:14, borderRadius:2, background:secColor }} />
                      <span style={{ fontSize:12, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.05em' }}>{section.name}</span>
                      <span style={{ fontSize:10, fontWeight:600, color:C.textMuted, background:C.card, padding:'2px 7px', borderRadius:10 }}>{items.length}</span>
                    </div>
                    {items.map(t => <TaskCard key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} onClick={() => setEditingTodo(t)} />)}
                    {items.length === 0 && !adding && <Empty text="Sektionen er tom — træk opgaver hertil eller tilføj en ny" />}
                  </>
                )
              })()}

              {/* Crew — grouped by crew member */}
              {currentView === 'crew' && (<>
                {addingTaskCrew && <TaskForm employees={employees} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo(d); setAddingTaskCrew(false) }} onCancel={() => setAddingTaskCrew(false)} />}
                {!addingTaskCrew && <AddRow label="Tilføj opgave" onClick={() => setAddingTaskCrew(true)} />}
                {(() => {
                  // Group crew tasks by assigned_to
                  const grouped = new Map<string, Todo[]>()
                  crewTasks.forEach(t => {
                    const k = t.assigned_to || 'unknown'
                    grouped.set(k, [...(grouped.get(k) || []), t])
                  })
                  // Sort groups by employee name
                  const sortedGroups = [...grouped.entries()].sort((a, b) => {
                    const na = employees.get(a[0])?.navn || ''
                    const nb = employees.get(b[0])?.navn || ''
                    return na.localeCompare(nb)
                  })
                  return sortedGroups.map(([empId, empTasks]) => {
                    const emp = employees.get(empId)
                    const empColor = hashColor(empId)
                    return (
                      <div key={empId} style={{ marginBottom:20 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px 12px', borderBottom:`1px solid ${C.border}`, marginBottom:10 }}>
                          {emp && <Avatar name={emp.navn} id={empId} sz={28} />}
                          <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{emp?.navn || 'Ukendt'}</span>
                          {emp?.location && <span style={{ fontSize:11, color:C.textMuted }}>({emp.location})</span>}
                          <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, background:C.card, padding:'2px 8px', borderRadius:10, marginLeft:'auto' }}>{empTasks.length}</span>
                          <div style={{ width:3, height:16, borderRadius:2, background:empColor }} />
                        </div>
                        {empTasks.map(t => <TaskCard key={t.id} t={t} emp={emp} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} onClick={() => setEditingTodo(t)} />)}
                      </div>
                    )
                  })
                })()}
                {crewTasks.length === 0 && !addingTaskCrew && <Empty text="Ingen crew-opgaver" />}
              </>)}

              {/* Inbox */}
              {currentView === 'inbox' && (<>
                {addingTaskInbox && <TaskForm employees={employees} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo(d); setAddingTaskInbox(false) }} onCancel={() => setAddingTaskInbox(false)} />}
                {!addingTaskInbox && <AddRow label="Tilføj opgave" onClick={() => setAddingTaskInbox(true)} />}
                {unassignedTasks.map(t => <TaskCard key={t.id} t={t} emp={undefined} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} onClick={() => setEditingTodo(t)} />)}
                {unassignedTasks.length === 0 && !addingTaskInbox && <Empty text="Indbakken er tom" />}
              </>)}

              {/* Today */}
              {currentView === 'today' && (<>
                {addingTaskToday && <TaskForm employees={employees} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo({ ...d, due_date: d.due_date || todayStr }); setAddingTaskToday(false) }} onCancel={() => setAddingTaskToday(false)} />}
                {!addingTaskToday && <AddRow label="Tilføj opgave" onClick={() => setAddingTaskToday(true)} />}
                {todayTasks.map(t => <TaskCard key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} onClick={() => setEditingTodo(t)} />)}
                {todayTasks.length === 0 && !addingTaskToday && <Empty text="Ingen opgaver i dag — godt gået!" />}
              </>)}

              {/* Denne uge */}
              {currentView === 'week' && (<>
                {addingTaskUpcoming && <TaskForm employees={employees} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo(d); setAddingTaskUpcoming(false) }} onCancel={() => setAddingTaskUpcoming(false)} />}
                {!addingTaskUpcoming && <AddRow label="Tilføj opgave" onClick={() => setAddingTaskUpcoming(true)} />}
                {weekTasks.map(t => <TaskCard key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} onClick={() => setEditingTodo(t)} />)}
                {weekTasks.length === 0 && !addingTaskUpcoming && <Empty text="Ingen opgaver denne uge" />}
              </>)}

              {/* Upcoming — grouped by day with week-number markers */}
              {currentView === 'upcoming' && (<>
                {addingTaskUpcoming && <TaskForm employees={employees} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo(d); setAddingTaskUpcoming(false) }} onCancel={() => setAddingTaskUpcoming(false)} />}
                {!addingTaskUpcoming && <AddRow label="Tilføj opgave" onClick={() => setAddingTaskUpcoming(true)} />}
                {(() => {
                  let lastWeek = -1
                  return upcomingGrouped.map(([date, items]) => {
                    const d = new Date(date + 'T00:00:00')
                    const weekday = d.toLocaleDateString('da-DK', { weekday: 'long' })
                    const dateLabel = d.toLocaleDateString('da-DK', { day:'numeric', month:'long' })
                    const weekNo = getIsoWeek(d)
                    const showWeekHeader = weekNo !== lastWeek
                    lastWeek = weekNo
                    return (
                      <div key={date}>
                        {showWeekHeader && (
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:22, marginBottom:8 }}>
                            <div style={{ fontSize:11, fontWeight:800, color:C.amber, background:C.amber+'18', border:`1px solid ${C.amber}40`, padding:'4px 12px', borderRadius:14, letterSpacing:'0.06em' }}>UGE {weekNo}</div>
                            <div style={{ flex:1, height:1, background:C.border }} />
                          </div>
                        )}
                        <div style={{ marginBottom:18 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px 10px', borderBottom:`1px solid ${C.border}`, marginBottom:10 }}>
                            <Calendar style={{ width:14, height:14, color:C.blue }} />
                            <span style={{ fontSize:13, fontWeight:700, color:C.text, textTransform:'capitalize' }}>{weekday}</span>
                            <span style={{ fontSize:11, color:C.textMuted }}>{dateLabel} (uge {weekNo})</span>
                            <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, background:C.card, padding:'2px 8px', borderRadius:10, marginLeft:'auto' }}>{items.length}</span>
                          </div>
                          {items.map(t => <TaskCard key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onDone={() => updateTodo(t.id, { resolved: true })} onDel={() => deleteTodo(t.id)} onClick={() => setEditingTodo(t)} />)}
                        </div>
                      </div>
                    )
                  })
                })()}
                {upcomingGrouped.length === 0 && !addingTaskUpcoming && <Empty text="Ingen kommende opgaver" />}
              </>)}

              {/* Phone */}
              {currentView === 'phone' && (<>
                {addingCall && <PhoneCallForm employees={employees} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await calls.addCall(d); setAddingCall(false) }} onCancel={() => setAddingCall(false)} />}
                {!addingCall && <AddRow label="Tilføj opkald" onClick={() => setAddingCall(true)} />}
                {activeCalls.map(c => <PhoneCallCard key={c.id} call={c} emp={c.assigned_to ? employees.get(c.assigned_to) : undefined} onCheck={() => calls.toggleCompleted(c.id, true)} onDel={() => calls.deleteCall(c.id)} onClick={() => setEditingCall(c)} />)}
                {activeCalls.length === 0 && !addingCall && <Empty text="Ingen at ringe til" />}
                {completedCalls.length > 0 && (
                  <div style={{ marginTop:16 }}>
                    <Collapse label={`Ringet (${completedCalls.length})`} open={false}>
                      {completedCalls.map(c => <PhoneCallCard key={c.id} call={c} done emp={c.assigned_to ? employees.get(c.assigned_to) : undefined} onCheck={() => calls.toggleCompleted(c.id, false)} onDel={() => calls.deleteCall(c.id)} onClick={() => setEditingCall(c)} />)}
                    </Collapse>
                  </div>
                )}
              </>)}

              {/* Code */}
              {currentView === 'code' && (<>
                {addingCode && <TaskForm employees={employees} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo({ ...d, category: 'CODE' }); setAddingCode(false) }} onCancel={() => setAddingCode(false)} />}
                {!addingCode && <AddRow label="Ny code-opgave" onClick={() => setAddingCode(true)} />}
                <SectionManager listKey="CODE" sections={sectionsByList['CODE'] || []} onAdd={name => addListSection('CODE', name)} />
                <SectionedList
                  listKey="CODE"
                  groups={groupTasksBySection('CODE', codeTasks)}
                  color={C.purple}
                  employees={employees}
                  onToggle={t => updateTodo(t.id, { resolved: true })}
                  onDelete={t => deleteTodo(t.id)}
                  onClickTask={t => setEditingTodo(t)}
                  onDropTodo={async (id, sectionId) => { await updateTodo(id, { section_id: sectionId, category: 'CODE' }) }}
                  onDeleteSection={sid => deleteListSection('CODE', sid)}
                  onRenameSection={(sid, name) => renameListSection('CODE', sid, name)}
                  onSetSectionColor={(sid, col) => setListSectionColor('CODE', sid, col)}
                />
                {codeTasks.length === 0 && !addingCode && <Empty text="Ingen code opgaver" />}
              </>)}

              {/* Repair */}
              {currentView === 'repair' && (<>
                {addingRepair && <TaskForm employees={employees} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo({ ...d, category: 'REPAIR' }); setAddingRepair(false) }} onCancel={() => setAddingRepair(false)} />}
                {!addingRepair && <AddRow label="Tilføj reparation" onClick={() => setAddingRepair(true)} />}
                <SectionManager listKey="REPAIR" sections={sectionsByList['REPAIR'] || []} onAdd={name => addListSection('REPAIR', name)} />
                <SectionedList
                  listKey="REPAIR"
                  groups={groupTasksBySection('REPAIR', repairTasks)}
                  color={C.amber}
                  employees={employees}
                  onToggle={t => updateTodo(t.id, { resolved: true })}
                  onDelete={t => deleteTodo(t.id)}
                  onClickTask={t => setEditingTodo(t)}
                  onDropTodo={async (id, sectionId) => { await updateTodo(id, { section_id: sectionId, category: 'REPAIR' }) }}
                  onDeleteSection={sid => deleteListSection('REPAIR', sid)}
                  onRenameSection={(sid, name) => renameListSection('REPAIR', sid, name)}
                  onSetSectionColor={(sid, col) => setListSectionColor('REPAIR', sid, col)}
                />
                {repairTasks.length === 0 && !addingRepair && <Empty text="Intet at reparere" />}
              </>)}

              {/* Transport */}
              {currentView === 'transport' && (<>
                {addingTransport && <TransportForm employees={employees} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} kimId={kimEmp?.id} onDone={async d => { await transport.addItem(d); setAddingTransport(false) }} onCancel={() => setAddingTransport(false)} />}
                {!addingTransport && <AddRow label="Tilføj transport" onClick={() => setAddingTransport(true)} />}
                {toWest.length > 0 && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 0', fontSize:11, fontWeight:700, color:C.amber, textTransform:'uppercase' }}>
                      <ArrowRight style={{ width:14, height:14 }} /> TIL VEST ({toWest.length})
                    </div>
                    {toWest.map(i => <TransportCard key={i.id} item={i} emp={i.assigned_to ? employees.get(i.assigned_to) : undefined} onCheck={() => transport.toggleCompleted(i.id, true)} onDel={() => transport.deleteItem(i.id)} onClick={() => setEditingTransport(i)} />)}
                  </div>
                )}
                {toEast.length > 0 && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 0', fontSize:11, fontWeight:700, color:C.blue, textTransform:'uppercase' }}>
                      <ArrowLeft style={{ width:14, height:14 }} /> TIL ØST ({toEast.length})
                    </div>
                    {toEast.map(i => <TransportCard key={i.id} item={i} emp={i.assigned_to ? employees.get(i.assigned_to) : undefined} onCheck={() => transport.toggleCompleted(i.id, true)} onDel={() => transport.deleteItem(i.id)} onClick={() => setEditingTransport(i)} />)}
                  </div>
                )}
                {activeTransport.length === 0 && !addingTransport && <Empty text="Intet at transportere" />}
                {completedTransport.length > 0 && (
                  <div style={{ marginTop:16 }}>
                    <Collapse label={`Leveret (${completedTransport.length})`} open={false}>
                      {completedTransport.map(i => <TransportCard key={i.id} item={i} done emp={i.assigned_to ? employees.get(i.assigned_to) : undefined} onCheck={() => transport.toggleCompleted(i.id, false)} onDel={() => transport.deleteItem(i.id)} onClick={() => setEditingTransport(i)} />)}
                    </Collapse>
                  </div>
                )}
              </>)}

              {/* Shopping */}
              {currentView === 'shop' && (<>
                {addingShop && <ShopForm onDone={async (t,n,u,d,urg) => { await shop.addItem(t,n,u,d,urg); setAddingShop(false) }} onCancel={() => setAddingShop(false)} />}
                {!addingShop && <AddRow label="Tilføj til listen" onClick={() => setAddingShop(true)} />}
                {pendShop.map(i => <ShopCard key={i.id} item={i} emp={i.assigned_to ? employees.get(i.assigned_to) : undefined} onCheck={() => shop.togglePurchased(i.id, true)} onDel={() => shop.deleteItem(i.id)} onClick={() => setEditingShop(i)} />)}
                {pendShop.length === 0 && !addingShop && <Empty text="Listen er tom" />}
                {doneShop.length > 0 && (
                  <div style={{ marginTop:16 }}>
                    <Collapse label={`Købt (${doneShop.length})`} open={false}>
                      {doneShop.map(i => <ShopCard key={i.id} item={i} done emp={i.assigned_to ? employees.get(i.assigned_to) : undefined} onCheck={() => shop.togglePurchased(i.id, false)} onDel={() => shop.deleteItem(i.id)} onClick={() => setEditingShop(i)} />)}
                    </Collapse>
                  </div>
                )}
              </>)}

              {/* Ideas */}
              {currentView === 'ideas' && (<>
                {ideaGroups.map(([cat, items]) => (
                  <div key={cat} style={{ marginBottom:12 }}>
                    <Collapse label={getCategoryLabel(cat)} count={items.length} color={CAT_COLORS[cat] || C.blue} open={true}>
                      {items.map(t => <IdeaRow key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onOpen={setSelectedIdea} />)}
                    </Collapse>
                  </div>
                ))}
                {ideaGroups.length === 0 && <Empty text="Ingen idéer" />}
              </>)}

              {/* Custom lists */}
              {currentView.startsWith('custom:') && (() => {
                const listId = currentView.slice(7)
                const list = customLists.find(l => l.id === listId)
                if (!list) return <Empty text="Listen findes ikke" />
                const items = customListTasks.get(listId) || []
                const listKey = `custom:${listId}`
                return (
                  <>
                    {addingTaskThomas && <TaskForm employees={employees} locations={locations} thomasId={thomasEmp?.id} mariaId={mariaEmp?.id} onDone={async d => { await addTodo({ ...d, category: listKey }); setAddingTaskThomas(false) }} onCancel={() => setAddingTaskThomas(false)} />}
                    {!addingTaskThomas && <AddRow label={`Tilføj til ${list.name}`} onClick={() => setAddingTaskThomas(true)} />}
                    <SectionManager listKey={listKey} sections={sectionsByList[listKey] || []} onAdd={name => addListSection(listKey, name)} />
                    <SectionedList
                      listKey={listKey}
                      groups={groupTasksBySection(listKey, items)}
                      color={list.color}
                      employees={employees}
                      onToggle={t => updateTodo(t.id, { resolved: true })}
                      onDelete={t => deleteTodo(t.id)}
                      onClickTask={t => setEditingTodo(t)}
                      onDropTodo={async (id, sectionId) => { await updateTodo(id, { section_id: sectionId, category: listKey }) }}
                      onDeleteSection={sid => deleteListSection(listKey, sid)}
                      onRenameSection={(sid, name) => renameListSection(listKey, sid, name)}
                      onSetSectionColor={(sid, col) => setListSectionColor(listKey, sid, col)}
                    />
                    {items.length === 0 && !addingTaskThomas && <Empty text="Listen er tom — træk opgaver hertil eller tilføj en ny" />}
                  </>
                )
              })()}

            </div>
          </div>
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
          onConvertToTransport={async () => {
            await transport.addItem({
              title: editingTodo.title,
              direction: 'east_to_west',
              note: editingTodo.description || undefined,
              assigned_to: editingTodo.assigned_to || undefined,
            })
            await deleteTodo(editingTodo.id)
            setEditingTodo(null)
          }}
          customLists={customLists}
          onConvertToShop={async () => {
            await shop.addItem(
              editingTodo.title,
              editingTodo.description || undefined,
              undefined,
              editingTodo.due_date || undefined,
              editingTodo.priority === 'HASTER'
            )
            await deleteTodo(editingTodo.id)
            setEditingTodo(null)
          }}
          onConvertToPhoneCall={async () => {
            await calls.addCall({
              navn: editingTodo.title,
              nummer: '',
              note: editingTodo.description || undefined,
              assigned_to: editingTodo.assigned_to || undefined,
              urgent: editingTodo.priority === 'HASTER',
              due_date: editingTodo.due_date || undefined,
            })
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

      {/* ── Edit Phone Call Modal ── */}
      {editingCall && (
        <EditPhoneCallModal
          call={editingCall}
          employees={employees}
          thomasId={thomasEmp?.id}
          mariaId={mariaEmp?.id}
          onClose={() => setEditingCall(null)}
          onSave={async (updates) => {
            await calls.updateCall(editingCall.id, updates)
            setEditingCall(null)
          }}
          onDelete={async () => {
            await calls.deleteCall(editingCall.id)
            setEditingCall(null)
          }}
          onConvertToTask={async () => {
            await addTodo({
              title: `Ring ${editingCall.navn}${editingCall.firma ? ` (${editingCall.firma})` : ''}`,
              description: `Tlf: ${editingCall.nummer}${editingCall.note ? `\n${editingCall.note}` : ''}`,
              assigned_to: editingCall.assigned_to,
              priority: editingCall.urgent ? 'HASTER' : 'Normal',
              due_date: editingCall.due_date,
            })
            await calls.deleteCall(editingCall.id)
            setEditingCall(null)
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

      {/* ── Edit Transport Modal ── */}
      {editingTransport && (
        <EditTransportModal
          item={editingTransport}
          employees={employees}
          thomasId={thomasEmp?.id}
          mariaId={mariaEmp?.id}
          onClose={() => setEditingTransport(null)}
          onSave={async (updates) => {
            await transport.updateItem(editingTransport.id, updates)
            setEditingTransport(null)
          }}
          onDelete={async () => {
            await transport.deleteItem(editingTransport.id)
            setEditingTransport(null)
          }}
        />
      )}

      {/* ── Print Transport Modal ── */}
      {showPrintTransport && (
        <PrintTransportModal
          toWest={toWest}
          toEast={toEast}
          employees={employees}
          onClose={() => setShowPrintTransport(false)}
        />
      )}

      {/* ── Personal View Modal ── */}
      {showPersonalView && showPersonalView !== 'crew' && (() => {
        const resolvedId = showPersonalView === 'thomas' ? thomasEmp?.id : showPersonalView === 'maria' ? mariaEmp?.id : showPersonalView
        const resolvedEmp = resolvedId ? employees.get(resolvedId) : undefined
        const resolvedColor = showPersonalView === 'thomas' ? C.green : showPersonalView === 'maria' ? C.pink : hashColor(resolvedId || '')
        return (
          <PersonalViewModal
            empId={resolvedId}
            empName={resolvedEmp?.navn || 'Medarbejder'}
            color={resolvedColor}
            tasks={tasks}
            shopItems={pendShop}
            phoneCalls={activeCalls}
            transportItems={activeTransport}
            onClose={() => setShowPersonalView(null)}
            onToggleTodo={(id) => updateTodo(id, { resolved: true })}
            onToggleShop={(id) => shop.togglePurchased(id, true)}
            onToggleCall={(id) => calls.toggleCompleted(id, true)}
            onToggleTransport={(id) => transport.toggleCompleted(id, true)}
          />
        )
      })()}

      {/* ── Crew View Modal ── */}
      {showPersonalView === 'crew' && (
        <div onClick={() => setShowPersonalView(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:560, width:'100%', maxHeight:'85vh', overflow:'auto' }}>
            <div style={{ padding:24 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <User style={{ width:18, height:18, color:C.cyan }} />
                  <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>CREW TODO</h2>
                  <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, background:C.card, padding:'2px 8px', borderRadius:10 }}>{crewTasks.length}</span>
                </div>
                <button onClick={() => setShowPersonalView(null)} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer' }}><X style={{ width:16, height:16 }} /></button>
              </div>
              {(() => {
                const grouped = new Map<string, Todo[]>()
                crewTasks.forEach(t => {
                  const key = t.assigned_to || 'unknown'
                  grouped.set(key, [...(grouped.get(key) || []), t])
                })
                return [...grouped.entries()].map(([empId, empTasks]) => {
                  const emp = employees.get(empId)
                  return (
                    <div key={empId} style={{ marginBottom:16 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                        <Avatar name={emp?.navn || '?'} id={empId} sz={24} />
                        <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{emp?.navn || 'Ukendt'}</span>
                        <span style={{ fontSize:10, color:C.textMuted }}>({emp?.location})</span>
                        <span style={{ fontSize:10, color:C.textMuted, background:C.card, padding:'1px 6px', borderRadius:8 }}>{empTasks.length}</span>
                      </div>
                      {empTasks.map(t => (
                        <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:6, border:`1px solid ${C.border}`, marginBottom:3 }}>
                          <button onClick={() => updateTodo(t.id, { resolved: true })} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${C.cyan}60`, background:'transparent', cursor:'pointer', flexShrink:0 }} />
                          <span style={{ fontSize:12, color:C.text, flex:1 }}>{t.title}</span>
                          {t.priority && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:getPriorityColor(t.priority)+'20', color:getPriorityColor(t.priority) }}>{getPriorityLabel(t.priority)}</span>}
                          {t.due_date && <DuePill date={t.due_date} />}
                        </div>
                      ))}
                    </div>
                  )
                })
              })()}
              {crewTasks.length === 0 && <Empty text="Ingen crew-opgaver" />}
            </div>
          </div>
        </div>
      )}

      {/* ── Ideas Modal ── */}
      {showIdeas && (
        <div onClick={() => setShowIdeas(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:560, width:'100%', maxHeight:'85vh', overflow:'auto' }}>
            <div style={{ padding:24 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Lightbulb style={{ width:18, height:18, color:C.purple }} />
                  <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>IDÉER & INSPIRATION</h2>
                  <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, background:C.card, padding:'2px 8px', borderRadius:10 }}>{ideaGroups.reduce((s,[,v])=>s+v.length,0)}</span>
                </div>
                <button onClick={() => setShowIdeas(false)} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer' }}><X style={{ width:16, height:16 }} /></button>
              </div>
              {ideaGroups.map(([cat, items]) => (
                <Collapse key={cat} label={getCategoryLabel(cat)} count={items.length} color={CAT_COLORS[cat] || C.blue} open={false}>
                  {items.map(t => <IdeaRow key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onOpen={(idea) => { setSelectedIdea(idea); setShowIdeas(false) }} />)}
                </Collapse>
              ))}
              {ideaGroups.length === 0 && <Empty text="Ingen idéer" />}
            </div>
          </div>
        </div>
      )}

      {/* ── Landing Animation ── */}
      {showLanding && !loading && (
        <LandingOverlay onSelect={(idx) => {
          setShowLanding(false)
          // Map landing index to view key + set URL via nuqs so refresh restores
          const viewMap: string[] = ['thomas','maria','crew','transport','phone','shop']
          const target = viewMap[idx] || 'today'
          setCurrentView(target)
          // Open due-popup only when a person is selected (Thomas/Maria/Crew)
          if (idx === 0) setDuePopupFor('thomas')
          else if (idx === 1) setDuePopupFor('maria')
          else if (idx === 2) setDuePopupFor('crew')
        }} onDismiss={() => { setShowLanding(false); setCurrentView('today') }} />
      )}

      {/* ── Create List Modal ── */}
      {creatingList && (
        <CreateListModal
          onClose={() => setCreatingList(false)}
          onCreate={(name, color) => {
            addCustomList(name, color)
            setCreatingList(false)
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

/* StatPill kept for potential reuse (sidebar-era layout replaced header stats) */
// @ts-expect-error -- intentionally unused after redesign
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

/* ━━━ Task Card (compact) ━━━ */
function TaskCard({ t, emp, onDone, onDel, onClick }: { t:Todo; emp?:Employee; onDone:()=>void; onDel:()=>void; onClick?:()=>void }) {
  const od = isOverdue(t.due_date)
  const pc = getPriorityColor(t.priority)
  const title = decodeHtmlEntities(t.title)

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('application/x-todo-id', t.id); e.dataTransfer.effectAllowed = 'move' }}
      style={{
        background: od ? 'rgba(240,96,96,0.04)' : C.card,
        borderRadius:8,
        border: `1px solid ${od ? 'rgba(240,96,96,0.18)' : C.border}`,
        borderLeft: `3px solid ${pc}`,
        padding:'8px 10px',
        transition:'background 0.15s',
        cursor: onClick ? 'grab' : 'default',
        display:'flex', alignItems:'center', gap:8,
      }}
      onClick={onClick}
      onMouseEnter={e => { if(!od) e.currentTarget.style.background = C.cardHover }}
      onMouseLeave={e => { e.currentTarget.style.background = od ? 'rgba(240,96,96,0.04)' : C.card }}>

      <button onClick={e => { e.stopPropagation(); onDone() }} style={{
        width:18, height:18, borderRadius:5, border:`2px solid ${pc}60`, background:'transparent',
        display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0,
        transition:'all 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = pc+'20'; e.currentTarget.style.borderColor = pc }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = pc+'60' }} />

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, lineHeight:1.3, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap', marginTop:3 }}>
          {t.due_date && <DuePill date={t.due_date} />}
          {t.category && t.category !== 'null' && !t.category.startsWith('custom:') && (
            <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:(CAT_COLORS[t.category] || C.blue)+'18', color:CAT_COLORS[t.category] || C.blue, textTransform:'uppercase', letterSpacing:'0.04em' }}>{t.category}</span>
          )}
          {t.category?.startsWith('custom:') && (
            <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:C.purple+'18', color:C.purple, letterSpacing:'0.04em' }}>liste</span>
          )}
        </div>
      </div>

      {emp && <Avatar name={emp.navn} id={emp.id} sz={22} />}
      <button onClick={e => { e.stopPropagation(); onDel() }} style={{ padding:2, borderRadius:4, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer', opacity:0.25, transition:'all 0.15s', flexShrink:0 }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.red }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.25'; e.currentTarget.style.color = C.textMuted }}>
        <Trash2 style={{ width:11, height:11 }} />
      </button>
    </div>
  )
}

/* ━━━ CODE / REPAIR Task Card ━━━ */
// @ts-expect-error -- kept for potential re-use
function CodeTaskCard({ t, onDone, onDel, onClick, color }: { t:Todo; onDone:()=>void; onDel:()=>void; onClick?:()=>void; color:string }) {
  const od = isOverdue(t.due_date)
  const title = decodeHtmlEntities(t.title)
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('application/x-todo-id', t.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={onClick}
      style={{
        background: od ? 'rgba(240,96,96,0.04)' : C.card,
        borderRadius:8,
        border: `1px solid ${od ? 'rgba(240,96,96,0.18)' : C.border}`,
        borderLeft: `3px solid ${color}`,
        padding:'8px 10px',
        transition:'background 0.15s',
        cursor: onClick ? 'grab' : 'default',
        display:'flex', alignItems:'center', gap:8,
      }}
      onMouseEnter={e => { if(!od) e.currentTarget.style.background = C.cardHover }}
      onMouseLeave={e => { e.currentTarget.style.background = od ? 'rgba(240,96,96,0.04)' : C.card }}>
      <button onClick={e => { e.stopPropagation(); onDone() }} style={{ width:18, height:18, borderRadius:5, border:`2px solid ${color}60`, background:'transparent', cursor:'pointer', flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, lineHeight:1.3, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</div>
        {t.due_date && <div style={{ marginTop:3 }}><DuePill date={t.due_date} /></div>}
      </div>
      <button onClick={e => { e.stopPropagation(); onDel() }} style={{ padding:2, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer', opacity:0.25, flexShrink:0 }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.red }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.25'; e.currentTarget.style.color = C.textMuted }}>
        <Trash2 style={{ width:11, height:11 }} />
      </button>
    </div>
  )
}

/* ━━━ CODE / REPAIR Task Form ━━━ */
// @ts-expect-error -- kept for potential re-use
function CodeTaskForm({ onDone, onCancel, color, titlePlaceholder }: { onDone:(d:Partial<Todo>)=>Promise<any>; onCancel:()=>void; color:string; titlePlaceholder:string }) {
  const [title, sT] = useState('')
  const [desc, sDe] = useState('')
  const [pri, sP] = useState('Normal')
  const [cDate, sCD] = useState('')
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    sB(true)
    await onDone({ title: title.trim(), description: desc.trim() || null, priority: pri, due_date: cDate || null })
    sB(false)
  }

  return (
    <form onSubmit={submit} style={{ background:C.card, borderRadius:10, border:`1px solid ${color}30`, padding:14, display:'flex', flexDirection:'column', gap:8 }}>
      <input ref={ref} placeholder={titlePlaceholder} value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <textarea placeholder="Beskrivelse af opgaven..." value={desc} onChange={e=>sDe(e.target.value)} rows={3}
        style={{ ...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit' }}
        onFocus={e => e.currentTarget.style.borderColor = color}
        onBlur={e => e.currentTarget.style.borderColor = C.border} />
      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {PRIORITIES.map(p => (
          <button key={p.value} type="button" onClick={() => sP(p.value)} style={{
            padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${p.color}40`,
            background: pri===p.value ? p.color+'20' : 'transparent', color: pri===p.value ? p.color : C.textMuted,
          }}>{p.label}</button>
        ))}
      </div>
      <DatePicker value={cDate} onChange={sCD} />
      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <button type="submit" disabled={!title.trim()||busy} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, textTransform:'uppercase', letterSpacing:'0.04em' }}>
          {busy ? 'OPRETTER...' : 'OPRET'}
        </button>
        <button type="button" onClick={onCancel} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>ANNULLER</button>
      </div>
    </form>
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
  const [cDate, sCD] = useState('')
  const [assign, sA] = useState(defaultAssign || '')
  const [alarm, sAlarm] = useState('')
  const [geoLat, sGeoLat] = useState<number | null>(null)
  const [geoLon, sGeoLon] = useState<number | null>(null)
  const [geoAddr, sGeoAddr] = useState('')
  const [images, sImages] = useState<string[]>([])
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
    await onDone({ title: title.trim(), description: desc.trim() || null, priority: pri, due_date: cDate || null, alarm_at: alarm ? new Date(alarm).toISOString() : null, assigned_to: assign || null, lat: geoLat, lon: geoLon, geo_address: geoAddr || null, images: images.length > 0 ? images : null })
    sB(false)
  }

  return (
    <form onSubmit={submit} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.blue}30`, padding:16, display:'flex', flexDirection:'column', gap:4 }}>

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
      <SectionLabel icon={<Calendar style={{ width:12, height:12 }} />} label="Deadline (Udføres før)" />
      <DatePicker value={cDate} onChange={sCD} />

      {/* ── SECTION: Påmindelse ── */}
      <SectionLabel icon={<Bell style={{ width:12, height:12 }} />} label="Påmindelse" />
      <input type="datetime-local" value={alarm} onChange={e => sAlarm(e.target.value)}
        style={{ ...inputStyle, fontSize:12, color: alarm ? C.text : C.textMuted }}
        onFocus={inputFocus} onBlur={inputBlur} />
      <span style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>Hvornår skal der sendes påmindelse?</span>

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
        <select value={assign} onChange={e => sA(e.target.value)} style={{ ...inputStyle, flex:1, color: assign ? C.text : C.textMuted, fontSize:12 }} onFocus={inputFocus as any} onBlur={inputBlur as any}>
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

function EditTodoModal({ todo, employees, locations, thomasId, mariaId, onClose, onSave, onDelete, onConvertToTransport, customLists, onConvertToShop, onConvertToPhoneCall }: {
  todo: Todo; employees: Map<string, Employee>; locations: ReturnType<typeof useLocations>; thomasId?: string; mariaId?: string
  onClose: () => void
  onSave: (updates: Partial<Todo>) => Promise<any>
  onDelete: () => Promise<any>
  onConvertToTransport?: () => Promise<any>
  customLists?: { id: string; name: string; color: string }[]
  onConvertToShop?: () => Promise<any>
  onConvertToPhoneCall?: () => Promise<any>
}) {
  const [title, sT] = useState(todo.title)
  const [desc, sDe] = useState(todo.description || '')
  const [pri, sP] = useState(todo.priority || 'Normal')
  const [cDate, sCD] = useState(todo.due_date || '')
  const [assign, sA] = useState(todo.assigned_to || '')
  const [category, sCat] = useState<string | null>(todo.category || null)
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
      category,
      lat: geoLat,
      lon: geoLon,
      geo_address: geoAddr || null,
      images: images.length > 0 ? images : null,
    })
    sB(false)
  }

  // Flyt til liste helper
  const currentCol = category?.startsWith('custom:') ? category :
    category === 'CODE' ? 'CODE' :
    category === 'REPAIR' ? 'REPAIR' :
    (assign === thomasId ? 'thomas' : assign === mariaId ? 'maria' : assign ? 'crew' : 'none')
  const moveTo = async (col: string) => {
    if (col === '__shop__' && onConvertToShop) { await onConvertToShop(); return }
    if (col === '__phone__' && onConvertToPhoneCall) { await onConvertToPhoneCall(); return }
    if (col === '__transport__' && onConvertToTransport) { await onConvertToTransport(); return }
    if (col === 'CODE') { sCat('CODE'); return }
    if (col === 'REPAIR') { sCat('REPAIR'); return }
    if (col.startsWith('custom:')) { sCat(col); return }
    sCat(null)
    if (col === 'thomas') sA(thomasId || '')
    else if (col === 'maria') sA(mariaId || '')
    else if (col === 'none') sA('')
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

            {/* ── SECTION: Flyt til liste ── */}
            <SectionLabel icon={<ArrowRight style={{ width:12, height:12 }} />} label="Flyt til liste" />
            <select value={currentCol} onChange={e => moveTo(e.target.value)} style={{ ...inputStyle, fontSize:12 }} onFocus={inputFocus as any} onBlur={inputBlur as any}>
              <optgroup label="Personer">
                <option value="thomas">TODO {employees.get(thomasId || '')?.navn || 'Thomas'}</option>
                <option value="maria">TODO {employees.get(mariaId || '')?.navn || 'Maria'}</option>
                <option value="crew">CREW</option>
                <option value="none">Ikke tildelt</option>
              </optgroup>
              <optgroup label="Lister">
                <option value="CODE">CODE</option>
                <option value="REPAIR">Repareres</option>
                {customLists && customLists.map(l => (
                  <option key={l.id} value={`custom:${l.id}`}>{l.name}</option>
                ))}
              </optgroup>
              {(onConvertToShop || onConvertToPhoneCall || onConvertToTransport) && (
                <optgroup label="Konvertér (flytter til anden tabel)">
                  {onConvertToShop && <option value="__shop__">→ Indkøb</option>}
                  {onConvertToPhoneCall && <option value="__phone__">→ Ringes til</option>}
                  {onConvertToTransport && <option value="__transport__">→ Øst / Vest</option>}
                </optgroup>
              )}
            </select>

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
              <button type="submit" disabled={!title.trim()||busy} style={{ padding:'9px 20px', borderRadius:8, fontSize:11, fontWeight:700, background:C.blue, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, transition:'opacity 0.15s', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                {busy ? 'GEMMER...' : 'GEM ÆNDRINGER'}
              </button>
              {onConvertToTransport && <button type="button" onClick={onConvertToTransport} style={{ padding:'9px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.cyan+'18', color:C.cyan, border:`1px solid ${C.cyan}30`, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em', display:'flex', alignItems:'center', gap:4 }}>
                <Truck style={{ width:12, height:12 }} /> ØST/VEST
              </button>}
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

/* ━━━ Phone Call Card ━━━ */
function PhoneCallCard({ call, done, onCheck, onDel, onClick, emp }: { call:PhoneCall; done?:boolean; onCheck:()=>void; onDel:()=>void; onClick?:()=>void; emp?:Employee }) {
  const borderColor = done ? C.border : call.urgent ? C.red+'40' : C.amber+'25'
  const bg = done ? 'transparent' : call.urgent ? C.red+'06' : C.card
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:8, background:bg, border:`1px solid ${borderColor}`, opacity: done ? 0.45 : 1, transition:'all 0.15s', cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={e => { if(onClick && !done) e.currentTarget.style.background = C.cardHover }}
      onMouseLeave={e => { if(onClick) e.currentTarget.style.background = bg }}>
      <button onClick={e => { e.stopPropagation(); onCheck() }} style={{ width:18, height:18, borderRadius:5, border:`2px solid ${done ? C.amber : C.amber+'60'}`, background: done ? C.amber : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all 0.15s' }}
        onMouseEnter={e => { if(!done) { e.currentTarget.style.borderColor = C.amber; e.currentTarget.style.background = C.amber+'20' } }}
        onMouseLeave={e => { if(!done) { e.currentTarget.style.borderColor = C.amber+'60'; e.currentTarget.style.background = 'transparent' } }}>
        {done && <Check style={{ width:11, height:11, color:'#fff' }} />}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {call.urgent && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:C.red+'20', color:C.red, textTransform:'uppercase' }}>HASTER</span>}
          <span style={{ fontSize:13, fontWeight:600, textDecoration: done ? 'line-through' : 'none', color: done ? C.textMuted : C.text }}>{call.navn}</span>
          {call.firma && <span style={{ fontSize:10, color:C.textMuted, fontWeight:500 }}>{call.firma}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
          <a href={`tel:${call.nummer}`} onClick={e => e.stopPropagation()} style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:11, color:C.amber, textDecoration:'none' }}>
            <Phone style={{ width:10, height:10 }} />{call.nummer}
          </a>
          {call.due_date && <DuePill date={call.due_date} />}
          {call.note && <span style={{ fontSize:10, color:C.textMuted }}>{call.note.length > 30 ? call.note.slice(0,30)+'...' : call.note}</span>}
        </div>
      </div>
      {emp && <Avatar name={emp.navn} id={emp.id} sz={22} />}
      <button onClick={e => { e.stopPropagation(); onDel() }} style={{ padding:2, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer', opacity:0.25, transition:'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color=C.red }}
        onMouseLeave={e => { e.currentTarget.style.opacity='0.25'; e.currentTarget.style.color=C.textMuted }}>
        <Trash2 style={{ width:11, height:11 }} />
      </button>
    </div>
  )
}

/* ━━━ Phone Call Form ━━━ */
function PhoneCallForm({ employees, thomasId, mariaId, onDone, onCancel }: { employees:Map<string,Employee>; thomasId?:string; mariaId?:string; onDone:(d:{ navn:string; nummer:string; firma?:string; note?:string; assigned_to?:string; urgent?:boolean; due_date?:string })=>Promise<any>; onCancel:()=>void }) {
  const [navn, sN] = useState('')
  const [nummer, sNu] = useState('')
  const [firma, sF] = useState('')
  const [note, sNo] = useState('')
  const [assign, sA] = useState('')
  const [urgent, sUrg] = useState(false)
  const [dueDate, sDD] = useState('')
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!navn.trim() || !nummer.trim() || busy) return
    sB(true)
    await onDone({ navn: navn.trim(), nummer: nummer.trim(), firma: firma.trim() || undefined, note: note.trim() || undefined, assigned_to: assign || undefined, urgent, due_date: dueDate || undefined })
    sB(false)
  }

  return (
    <form onSubmit={submit} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.amber}30`, padding:16, display:'flex', flexDirection:'column', gap:8 }}>
      <input ref={ref} placeholder="Navn..." value={navn} onChange={e=>sN(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <input placeholder="Telefonnummer..." value={nummer} onChange={e=>sNu(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} type="tel" />
      <input placeholder="Firma (valgfrit)..." value={firma} onChange={e=>sF(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <textarea placeholder="Note (valgfrit)..." value={note} onChange={e=>sNo(e.target.value)} rows={2}
        style={{ ...inputStyle, resize:'vertical', minHeight:40, fontFamily:'inherit' }}
        onFocus={e => e.currentTarget.style.borderColor = C.blue}
        onBlur={e => e.currentTarget.style.borderColor = C.border} />

      <div style={{ display:'flex', gap:5, alignItems:'center' }}>
        <button type="button" onClick={() => sUrg(!urgent)} style={{
          padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${C.red}40`,
          background: urgent ? C.red+'20' : 'transparent', color: urgent ? C.red : C.textMuted, transition:'all 0.15s',
        }}>HASTER</button>
      </div>

      <SectionLabel icon={<Calendar style={{ width:12, height:12 }} />} label="Hvornår skal der ringes" />
      <DatePicker value={dueDate} onChange={sDD} />

      <SectionLabel icon={<Check style={{ width:12, height:12 }} />} label="Tildelt" />
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

      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <button type="submit" disabled={!navn.trim()||!nummer.trim()||busy} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity: (!navn.trim()||!nummer.trim()||busy) ? 0.35 : 1, transition:'opacity 0.15s', textTransform:'uppercase', letterSpacing:'0.04em' }}>
          {busy ? 'OPRETTER...' : 'TILFØJ OPKALD'}
        </button>
        <button type="button" onClick={onCancel} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>ANNULLER</button>
      </div>
    </form>
  )
}

/* ━━━ Edit Phone Call Modal ━━━ */
function EditPhoneCallModal({ call, employees, thomasId, mariaId, onClose, onSave, onDelete, onConvertToTask }: {
  call: PhoneCall; employees: Map<string, Employee>; thomasId?: string; mariaId?: string
  onClose: () => void
  onSave: (updates: Partial<PhoneCall>) => Promise<any>
  onDelete: () => Promise<any>
  onConvertToTask: () => Promise<any>
}) {
  const [navn, sN] = useState(call.navn)
  const [nummer, sNu] = useState(call.nummer)
  const [firma, sF] = useState(call.firma || '')
  const [note, sNo] = useState(call.note || '')
  const [assign, sA] = useState(call.assigned_to || '')
  const [urgent, sUrg] = useState(call.urgent || false)
  const [dueDate, sDD] = useState(call.due_date || '')
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!navn.trim() || !nummer.trim() || busy) return
    sB(true)
    await onSave({
      navn: navn.trim(),
      nummer: nummer.trim(),
      firma: firma.trim() || null,
      note: note.trim() || null,
      assigned_to: assign || null,
      urgent,
      due_date: dueDate || null,
    })
    sB(false)
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:480, width:'100%', maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>REDIGER OPKALD</h2>
            <button onClick={onClose} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer' }}>
              <X style={{ width:16, height:16 }} />
            </button>
          </div>

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:4 }}>

            <SectionLabel icon={<Phone style={{ width:12, height:12 }} />} label="Opkald" />
            <input ref={ref} placeholder="Navn..." value={navn} onChange={e=>sN(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            <input placeholder="Telefonnummer..." value={nummer} onChange={e=>sNu(e.target.value)} style={{ ...inputStyle, marginTop:4 }} onFocus={inputFocus} onBlur={inputBlur} type="tel" />
            <input placeholder="Firma (valgfrit)..." value={firma} onChange={e=>sF(e.target.value)} style={{ ...inputStyle, marginTop:4 }} onFocus={inputFocus} onBlur={inputBlur} />
            <textarea placeholder="Note (valgfrit)..." value={note} onChange={e=>sNo(e.target.value)} rows={3}
              style={{ ...inputStyle, resize:'vertical', minHeight:60, fontFamily:'inherit', marginTop:4 }}
              onFocus={e => e.currentTarget.style.borderColor = C.blue}
              onBlur={e => e.currentTarget.style.borderColor = C.border} />
            <div style={{ display:'flex', gap:5, alignItems:'center', marginTop:4 }}>
              <button type="button" onClick={() => sUrg(!urgent)} style={{
                padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${C.red}40`,
                background: urgent ? C.red+'20' : 'transparent', color: urgent ? C.red : C.textMuted, transition:'all 0.15s',
              }}>HASTER</button>
            </div>

            <SectionLabel icon={<Calendar style={{ width:12, height:12 }} />} label="Hvornår skal der ringes" />
            <DatePicker value={dueDate} onChange={sDD} />

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

            <div style={{ display:'flex', gap:8, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}`, flexWrap:'wrap' }}>
              <button type="submit" disabled={!navn.trim()||!nummer.trim()||busy} style={{ padding:'9px 20px', borderRadius:8, fontSize:11, fontWeight:700, background:C.blue, color:'#fff', border:'none', cursor:'pointer', opacity: (!navn.trim()||!nummer.trim()||busy) ? 0.35 : 1, transition:'opacity 0.15s', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                {busy ? 'GEMMER...' : 'GEM ÆNDRINGER'}
              </button>
              <button type="button" onClick={onConvertToTask} style={{ padding:'9px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.blue+'18', color:C.blue, border:`1px solid ${C.blue}30`, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em', display:'flex', alignItems:'center', gap:4 }}>
                <ArrowRight style={{ width:12, height:12 }} /> FLYT TIL OPGAVER
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

/* ━━━ Crew Task Form ━━━ */
// @ts-expect-error -- kept for potential re-use
function CrewTaskForm({ employees, thomasId, mariaId, jesperEmp, kimEmp, steenEmp, onDone, onCancel }: {
  employees:Map<string,Employee>; thomasId?:string; mariaId?:string
  jesperEmp?:Employee; kimEmp?:Employee; steenEmp?:Employee
  onDone:(d:Partial<Todo>)=>Promise<any>; onCancel:()=>void
}) {
  const [assign, sA] = useState('')
  const [title, sT] = useState('')
  const [desc, sDe] = useState('')
  const [pri, sP] = useState('Normal')
  const [cDate, sCD] = useState('')
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !assign || busy) return
    sB(true)
    await onDone({ title: title.trim(), description: desc.trim() || null, priority: pri, due_date: cDate || null, assigned_to: assign })
    sB(false)
  }

  // Crew = everyone except Thomas and Maria
  const crewList = [...employees.values()].filter(e => e.id !== thomasId && e.id !== mariaId).sort((a,b) => a.navn.localeCompare(b.navn))

  return (
    <form onSubmit={submit} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.cyan}30`, padding:16, display:'flex', flexDirection:'column', gap:8 }}>
      {/* Quick assign shortcuts */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
        {jesperEmp && <AssignBtn name="J" label={jesperEmp.navn.split(' ')[0]} color={C.cyan} active={assign===jesperEmp.id} onClick={() => sA(assign===jesperEmp.id ? '' : jesperEmp.id)} />}
        {kimEmp && <AssignBtn name="K" label={kimEmp.navn.split(' ')[0]} color={C.blue} active={assign===kimEmp.id} onClick={() => sA(assign===kimEmp.id ? '' : kimEmp.id)} />}
        {steenEmp && <AssignBtn name="S" label={steenEmp.navn.split(' ')[0]} color={C.amber} active={assign===steenEmp.id} onClick={() => sA(assign===steenEmp.id ? '' : steenEmp.id)} />}
      </div>
      <select value={assign} onChange={e => sA(e.target.value)} style={{ ...inputStyle, color: assign ? C.text : C.textMuted, fontSize:12 }} onFocus={inputFocus as any} onBlur={inputBlur as any}>
        <option value="">Vælg crew-medlem...</option>
        {crewList.map(e => (
          <option key={e.id} value={e.id}>{e.navn} ({e.location})</option>
        ))}
      </select>

      <input ref={ref} placeholder="Opgavetitel..." value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <textarea placeholder="Beskrivelse (valgfrit)..." value={desc} onChange={e=>sDe(e.target.value)} rows={2}
        style={{ ...inputStyle, resize:'vertical', minHeight:40, fontFamily:'inherit' }}
        onFocus={e => e.currentTarget.style.borderColor = C.blue}
        onBlur={e => e.currentTarget.style.borderColor = C.border} />

      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
        {PRIORITIES.map(p => (
          <button key={p.value} type="button" onClick={() => sP(p.value)} style={{
            padding:'4px 10px', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${p.color}40`,
            background: pri===p.value ? p.color+'20' : 'transparent', color: pri===p.value ? p.color : C.textMuted,
          }}>{p.label}</button>
        ))}
      </div>

      <DatePicker value={cDate} onChange={sCD} />

      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <button type="submit" disabled={!title.trim()||!assign||busy} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||!assign||busy) ? 0.35 : 1, textTransform:'uppercase', letterSpacing:'0.04em' }}>
          {busy ? 'OPRETTER...' : 'OPRET OPGAVE'}
        </button>
        <button type="button" onClick={onCancel} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase' }}>ANNULLER</button>
      </div>
    </form>
  )
}

/* ━━━ Transport Card ━━━ */
function TransportCard({ item, done, onCheck, onDel, onClick, emp }: { item:TransportItem; done?:boolean; onCheck:()=>void; onDel:()=>void; onClick?:()=>void; emp?:Employee }) {
  const isWest = item.direction === 'east_to_west'
  const dirColor = isWest ? C.amber : C.blue
  const bg = done ? 'transparent' : C.card
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:8, background:bg, border:`1px solid ${done ? C.border : dirColor+'25'}`, opacity: done ? 0.45 : 1, transition:'all 0.15s', cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={e => { if(onClick && !done) e.currentTarget.style.background = C.cardHover }}
      onMouseLeave={e => { if(onClick) e.currentTarget.style.background = bg }}>
      <button onClick={e => { e.stopPropagation(); onCheck() }} style={{ width:18, height:18, borderRadius:5, border:`2px solid ${done ? dirColor : dirColor+'60'}`, background: done ? dirColor : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
        {done && <Check style={{ width:11, height:11, color:'#fff' }} />}
      </button>
      <div style={{ flex:1, minWidth:0 }}>
        <span style={{ fontSize:12, fontWeight:500, textDecoration: done ? 'line-through' : 'none', color: done ? C.textMuted : C.text }}>{item.title}</span>
        {item.note && <div style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{item.note}</div>}
      </div>
      {emp && <Avatar name={emp.navn} id={emp.id} sz={20} />}
      <button onClick={e => { e.stopPropagation(); onDel() }} style={{ padding:2, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer', opacity:0.25, transition:'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color=C.red }}
        onMouseLeave={e => { e.currentTarget.style.opacity='0.25'; e.currentTarget.style.color=C.textMuted }}>
        <Trash2 style={{ width:11, height:11 }} />
      </button>
    </div>
  )
}

/* ━━━ Transport Form ━━━ */
function TransportForm({ employees, thomasId, mariaId, kimId, onDone, onCancel }: { employees:Map<string,Employee>; thomasId?:string; mariaId?:string; kimId?:string; onDone:(d:{ title:string; direction:'east_to_west'|'west_to_east'; note?:string; assigned_to?:string })=>Promise<any>; onCancel:()=>void }) {
  const [title, sT] = useState('')
  const [note, sN] = useState('')
  const [dir, setDirRaw] = useState<'east_to_west'|'west_to_east'>('east_to_west')
  const [assign, sA] = useState(thomasId || '')
  const [busy, sB] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const sDir = (d: 'east_to_west'|'west_to_east') => {
    setDirRaw(d)
    sA(d === 'east_to_west' ? (thomasId || '') : (mariaId || ''))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    sB(true)
    await onDone({ title: title.trim(), direction: dir, note: note.trim() || undefined, assigned_to: assign || undefined })
    sB(false)
  }

  return (
    <form onSubmit={submit} style={{ background:C.card, borderRadius:10, border:`1px solid ${C.cyan}30`, padding:16, display:'flex', flexDirection:'column', gap:8 }}>
      <input ref={ref} placeholder="Hvad skal med..." value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
      <textarea placeholder="Note (valgfrit)..." value={note} onChange={e=>sN(e.target.value)} rows={2}
        style={{ ...inputStyle, resize:'vertical', minHeight:40, fontFamily:'inherit' }}
        onFocus={e => e.currentTarget.style.borderColor = C.blue}
        onBlur={e => e.currentTarget.style.borderColor = C.border} />
      <div style={{ display:'flex', gap:6 }}>
        <button type="button" onClick={() => sDir('east_to_west')} style={{
          flex:1, padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer',
          border:`1px solid ${C.amber}40`, display:'flex', alignItems:'center', justifyContent:'center', gap:4,
          background: dir==='east_to_west' ? C.amber+'20' : 'transparent', color: dir==='east_to_west' ? C.amber : C.textMuted,
        }}><ArrowRight style={{ width:12, height:12 }} /> TIL VEST</button>
        <button type="button" onClick={() => sDir('west_to_east')} style={{
          flex:1, padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer',
          border:`1px solid ${C.blue}40`, display:'flex', alignItems:'center', justifyContent:'center', gap:4,
          background: dir==='west_to_east' ? C.blue+'20' : 'transparent', color: dir==='west_to_east' ? C.blue : C.textMuted,
        }}><ArrowLeft style={{ width:12, height:12 }} /> TIL ØST</button>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        {thomasId && <AssignBtn name="T" label={employees.get(thomasId)?.navn || 'Thomas'} color={C.green} active={assign===thomasId} onClick={() => sA(assign===thomasId ? '' : thomasId)} />}
        {mariaId && <AssignBtn name="M" label={employees.get(mariaId)?.navn || 'Maria'} color={C.pink} active={assign===mariaId} onClick={() => sA(assign===mariaId ? '' : mariaId)} />}
        {kimId && <AssignBtn name="K" label={employees.get(kimId)?.navn || 'Kim'} color={C.blue} active={assign===kimId} onClick={() => sA(assign===kimId ? '' : kimId)} />}
      </div>
      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <button type="submit" disabled={!title.trim()||busy} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, textTransform:'uppercase', letterSpacing:'0.04em' }}>
          {busy ? 'TILFØJER...' : 'TILFØJ'}
        </button>
        <button type="button" onClick={onCancel} style={{ padding:'7px 16px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase' }}>ANNULLER</button>
      </div>
    </form>
  )
}

/* ━━━ Edit Transport Modal ━━━ */
function EditTransportModal({ item, employees, thomasId, mariaId, onClose, onSave, onDelete }: {
  item: TransportItem; employees: Map<string, Employee>; thomasId?: string; mariaId?: string
  onClose: () => void; onSave: (u: Partial<TransportItem>) => Promise<any>; onDelete: () => Promise<any>
}) {
  const [title, sT] = useState(item.title)
  const [note, sN] = useState(item.note || '')
  const [dir, sDir] = useState(item.direction)
  const [assign, sA] = useState(item.assigned_to || '')
  const [busy, sB] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || busy) return
    sB(true)
    await onSave({ title: title.trim(), note: note.trim() || null, direction: dir, assigned_to: assign || null })
    sB(false)
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:440, width:'100%', maxHeight:'90vh', overflow:'auto' }}>
        <div style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>REDIGER TRANSPORT</h2>
            <button onClick={onClose} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer' }}><X style={{ width:16, height:16 }} /></button>
          </div>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <input placeholder="Hvad skal med..." value={title} onChange={e=>sT(e.target.value)} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} />
            <textarea placeholder="Note..." value={note} onChange={e=>sN(e.target.value)} rows={2} style={{ ...inputStyle, resize:'vertical', minHeight:40, fontFamily:'inherit' }} onFocus={e=>e.currentTarget.style.borderColor=C.blue} onBlur={e=>e.currentTarget.style.borderColor=C.border} />
            <div style={{ display:'flex', gap:6 }}>
              <button type="button" onClick={() => sDir('east_to_west')} style={{ flex:1, padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', border:`1px solid ${C.amber}40`, display:'flex', alignItems:'center', justifyContent:'center', gap:4, background: dir==='east_to_west' ? C.amber+'20' : 'transparent', color: dir==='east_to_west' ? C.amber : C.textMuted }}><ArrowRight style={{ width:12, height:12 }} /> TIL VEST</button>
              <button type="button" onClick={() => sDir('west_to_east')} style={{ flex:1, padding:'6px 10px', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', border:`1px solid ${C.blue}40`, display:'flex', alignItems:'center', justifyContent:'center', gap:4, background: dir==='west_to_east' ? C.blue+'20' : 'transparent', color: dir==='west_to_east' ? C.blue : C.textMuted }}><ArrowLeft style={{ width:12, height:12 }} /> TIL ØST</button>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {thomasId && <AssignBtn name="T" label={employees.get(thomasId)?.navn || 'Thomas'} color={C.green} active={assign===thomasId} onClick={() => sA(assign===thomasId ? '' : thomasId)} />}
              {mariaId && <AssignBtn name="M" label={employees.get(mariaId)?.navn || 'Maria'} color={C.pink} active={assign===mariaId} onClick={() => sA(assign===mariaId ? '' : mariaId)} />}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:8, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
              <button type="submit" disabled={!title.trim()||busy} style={{ padding:'9px 20px', borderRadius:8, fontSize:11, fontWeight:700, background:C.blue, color:'#fff', border:'none', cursor:'pointer', opacity: (!title.trim()||busy) ? 0.35 : 1, textTransform:'uppercase' }}>{busy ? 'GEMMER...' : 'GEM'}</button>
              <button type="button" onClick={onClose} style={{ padding:'9px 20px', borderRadius:8, fontSize:11, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase' }}>ANNULLER</button>
              <button type="button" onClick={onDelete} style={{ marginLeft:'auto', padding:'9px 16px', borderRadius:8, fontSize:11, fontWeight:700, background:C.red+'18', color:C.red, border:`1px solid ${C.red}30`, cursor:'pointer', textTransform:'uppercase', display:'flex', alignItems:'center', gap:4 }}><Trash2 style={{ width:12, height:12 }} /> SLET</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ━━━ Print Transport Modal ━━━ */
function PrintTransportModal({ toWest, toEast, employees, onClose }: { toWest:TransportItem[]; toEast:TransportItem[]; employees:Map<string,Employee>; onClose:()=>void }) {
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = () => {
    const w = window.open('', '_blank')
    if (!w || !printRef.current) return
    w.document.write(`<html><head><title>ØST/VEST Transport</title><style>
      body { font-family: system-ui, sans-serif; padding: 20px; color: #222; }
      h1 { font-size: 18px; margin-bottom: 20px; }
      h2 { font-size: 14px; margin: 16px 0 8px; padding: 6px 12px; border-radius: 6px; }
      .west { background: #fff3e0; color: #e65100; }
      .east { background: #e3f2fd; color: #1565c0; }
      .item { padding: 6px 12px; border-bottom: 1px solid #eee; font-size: 13px; display: flex; gap: 8px; }
      .item .note { color: #888; font-size: 11px; }
      .item .who { color: #666; font-size: 11px; font-style: italic; }
      .check { width: 14px; height: 14px; border: 2px solid #ccc; border-radius: 3px; flex-shrink: 0; margin-top: 2px; }
      @media print { body { padding: 10px; } }
    </style></head><body>`)
    w.document.write(`<h1>ØST / VEST Transport — ${new Date().toLocaleDateString('da-DK', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</h1>`)
    if (toWest.length > 0) {
      w.document.write('<h2 class="west">→ TIL VEST (' + toWest.length + ')</h2>')
      toWest.forEach(i => {
        const emp = i.assigned_to ? employees.get(i.assigned_to) : undefined
        w.document.write(`<div class="item"><div class="check"></div><div><strong>${i.title}</strong>${i.note ? `<br><span class="note">${i.note}</span>` : ''}${emp ? `<br><span class="who">${emp.navn}</span>` : ''}</div></div>`)
      })
    }
    if (toEast.length > 0) {
      w.document.write('<h2 class="east">← TIL ØST (' + toEast.length + ')</h2>')
      toEast.forEach(i => {
        const emp = i.assigned_to ? employees.get(i.assigned_to) : undefined
        w.document.write(`<div class="item"><div class="check"></div><div><strong>${i.title}</strong>${i.note ? `<br><span class="note">${i.note}</span>` : ''}${emp ? `<br><span class="who">${emp.navn}</span>` : ''}</div></div>`)
      })
    }
    w.document.write('</body></html>')
    w.document.close()
    w.print()
  }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
      <div onClick={e => e.stopPropagation()} ref={printRef} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:520, width:'100%', maxHeight:'85vh', overflow:'auto' }}>
        <div style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>ØST / VEST TRANSPORT</h2>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handlePrint} style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 14px', borderRadius:8, fontSize:11, fontWeight:700, background:C.cyan, color:'#fff', border:'none', cursor:'pointer', textTransform:'uppercase' }}><Printer style={{ width:12, height:12 }} /> PRINT</button>
              <button onClick={onClose} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer' }}><X style={{ width:16, height:16 }} /></button>
            </div>
          </div>
          {toWest.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:8, background:C.amber+'15', marginBottom:6 }}>
                <ArrowRight style={{ width:14, height:14, color:C.amber }} />
                <span style={{ fontSize:12, fontWeight:700, color:C.amber, textTransform:'uppercase' }}>Til Vest ({toWest.length})</span>
              </div>
              {toWest.map(i => (
                <div key={i.id} style={{ padding:'6px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color:C.text }}>{i.title}</span>
                  {i.note && <span style={{ fontSize:10, color:C.textMuted }}>— {i.note}</span>}
                  {i.assigned_to && employees.get(i.assigned_to) && <Avatar name={employees.get(i.assigned_to)!.navn} id={i.assigned_to} sz={18} />}
                </div>
              ))}
            </div>
          )}
          {toEast.length > 0 && (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 12px', borderRadius:8, background:C.blue+'15', marginBottom:6 }}>
                <ArrowLeft style={{ width:14, height:14, color:C.blue }} />
                <span style={{ fontSize:12, fontWeight:700, color:C.blue, textTransform:'uppercase' }}>Til Øst ({toEast.length})</span>
              </div>
              {toEast.map(i => (
                <div key={i.id} style={{ padding:'6px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color:C.text }}>{i.title}</span>
                  {i.note && <span style={{ fontSize:10, color:C.textMuted }}>— {i.note}</span>}
                  {i.assigned_to && employees.get(i.assigned_to) && <Avatar name={employees.get(i.assigned_to)!.navn} id={i.assigned_to} sz={18} />}
                </div>
              ))}
            </div>
          )}
          {toWest.length === 0 && toEast.length === 0 && <Empty text="Intet at transportere" />}
        </div>
      </div>
    </div>
  )
}

/* ━━━ Personal View Modal (Thomas/Maria TODO) ━━━ */
function PersonalViewModal({ empId, empName, color, tasks, shopItems, phoneCalls, transportItems, onClose, onToggleTodo, onToggleShop, onToggleCall, onToggleTransport }: {
  empId?: string; empName: string; color: string
  tasks: Todo[]; shopItems: ShoppingItem[]; phoneCalls: PhoneCall[]; transportItems: TransportItem[]
  onClose: () => void
  onToggleTodo: (id: string) => void; onToggleShop: (id: string) => void; onToggleCall: (id: string) => void; onToggleTransport: (id: string) => void
}) {
  const [sortBy, setSortBy] = useState<'priority' | 'due'>('priority')
  const sortTasks = (arr: Todo[]) => {
    const filtered = arr.filter(t => t.assigned_to === empId)
    if (sortBy === 'due') return [...filtered].sort((a,b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    })
    return [...filtered].sort((a,b) => getPriorityOrder(a.priority) - getPriorityOrder(b.priority))
  }
  const myTasks = sortTasks(tasks)
  const myShop = shopItems.filter(i => i.assigned_to === empId)
  const myCalls = phoneCalls.filter(c => c.assigned_to === empId)
  const myTransport = transportItems.filter(i => i.assigned_to === empId)
  const total = myTasks.length + myShop.length + myCalls.length + myTransport.length

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:520, width:'100%', maxHeight:'85vh', overflow:'auto' }}>
        <div style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:18, background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff' }}>{empName[0]}</div>
              <div>
                <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>{empName.toUpperCase()} TODO</h2>
                <span style={{ fontSize:11, color:C.textMuted }}>{total} aktive opgaver</span>
              </div>
            </div>
            <button onClick={onClose} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer' }}><X style={{ width:16, height:16 }} /></button>
          </div>

          <div style={{ display:'flex', gap:6, marginBottom:12 }}>
            <button onClick={() => setSortBy('priority')} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:`1px solid ${C.red}40`, background: sortBy==='priority' ? C.red+'20' : 'transparent', color: sortBy==='priority' ? C.red : C.textMuted, textTransform:'uppercase' }}>SORTÉR: VIGTIGHED</button>
            <button onClick={() => setSortBy('due')} style={{ padding:'4px 10px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:`1px solid ${C.blue}40`, background: sortBy==='due' ? C.blue+'20' : 'transparent', color: sortBy==='due' ? C.blue : C.textMuted, textTransform:'uppercase' }}>SORTÉR: DEADLINE</button>
          </div>

          {myTasks.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.blue, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}><Briefcase style={{ width:11, height:11 }} /> Opgaver ({myTasks.length})</div>
              {myTasks.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, border:`1px solid ${C.border}`, marginBottom:3 }}>
                  <button onClick={() => onToggleTodo(t.id)} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${C.blue}60`, background:'transparent', cursor:'pointer', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:C.text, flex:1 }}>{t.title}</span>
                  {t.priority && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:getPriorityColor(t.priority)+'20', color:getPriorityColor(t.priority) }}>{getPriorityLabel(t.priority)}</span>}
                  {t.due_date && <DuePill date={t.due_date} />}
                </div>
              ))}
            </div>
          )}

          {myCalls.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.amber, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}><Phone style={{ width:11, height:11 }} /> Ringes ({myCalls.length})</div>
              {myCalls.map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, border:`1px solid ${C.border}`, marginBottom:3 }}>
                  <button onClick={() => onToggleCall(c.id)} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${C.amber}60`, background:'transparent', cursor:'pointer', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:C.text, flex:1 }}>{c.navn} — {c.nummer}</span>
                  {c.urgent && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:C.red+'20', color:C.red }}>HASTER</span>}
                </div>
              ))}
            </div>
          )}

          {myShop.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.green, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}><ShoppingCart style={{ width:11, height:11 }} /> Indkøb ({myShop.length})</div>
              {myShop.map(i => (
                <div key={i.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, border:`1px solid ${C.border}`, marginBottom:3 }}>
                  <button onClick={() => onToggleShop(i.id)} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${C.green}60`, background:'transparent', cursor:'pointer', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:C.text, flex:1 }}>{i.title}</span>
                  {i.urgent && <span style={{ fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:4, background:C.red+'20', color:C.red }}>HASTER</span>}
                </div>
              ))}
            </div>
          )}

          {myTransport.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.cyan, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}><Truck style={{ width:11, height:11 }} /> Transport ({myTransport.length})</div>
              {myTransport.map(i => (
                <div key={i.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, border:`1px solid ${C.border}`, marginBottom:3 }}>
                  <button onClick={() => onToggleTransport(i.id)} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${C.cyan}60`, background:'transparent', cursor:'pointer', flexShrink:0 }} />
                  <span style={{ fontSize:12, color:C.text, flex:1 }}>{i.title}</span>
                  {i.direction === 'east_to_west' ? <ArrowRight style={{ width:11, height:11, color:C.amber }} /> : <ArrowLeft style={{ width:11, height:11, color:C.blue }} />}
                </div>
              ))}
            </div>
          )}

          {total === 0 && <Empty text="Ingen aktive opgaver" />}
        </div>
      </div>
    </div>
  )
}

/* ━━━ Landing Overlay ━━━ */
/* ━━━ Sidebar ━━━ */
type BuiltInViewKey = 'today' | 'week' | 'upcoming' | 'inbox' | 'thomas' | 'maria' | 'crew' | 'phone' | 'code' | 'repair' | 'transport' | 'shop' | 'ideas'
type ViewKeyLocal = BuiltInViewKey | `custom:${string}` | string

function Sidebar({
  open, isMobile, onClose, currentView, setCurrentView, counts, dueCounts,
  thomasName, mariaName, thomasId, mariaId, gpsActive, connected,
  onQuickCreate, onShowPrintTransport, onDropTodo,
  customLists, customListCounts, customListDueCounts, onCreateList, onDeleteCustomList,
  sectionsByList, sectionCounts,
}: {
  open: boolean
  isMobile: boolean
  onClose: () => void
  currentView: string
  setCurrentView: (v: ViewKeyLocal) => void
  counts: Record<BuiltInViewKey, number>
  dueCounts: Partial<Record<BuiltInViewKey, number>>
  thomasName: string
  mariaName: string
  thomasId?: string
  mariaId?: string
  customLists?: { id: string; name: string; color: string }[]
  customListCounts?: Record<string, number>
  customListDueCounts?: Record<string, number>
  onCreateList?: () => void
  onDeleteCustomList?: (id: string) => void
  gpsActive: boolean
  connected: boolean
  onQuickCreate: () => void
  onShowPrintTransport: () => void
  onDropTodo: (view: ViewKeyLocal, id: string) => void | Promise<any>
  sectionsByList?: Record<string, { id: string; name: string; color?: string | null }[]>
  sectionCounts?: Record<string, number>
}) {
  if (!open) return null

  const width = isMobile ? 280 : 260
  const wrapperStyle: React.CSSProperties = isMobile
    ? { position:'fixed', top:0, left:0, bottom:0, width, zIndex:900, background:C.surface, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }
    : { width, flexShrink:0, background:C.surface, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', overflow:'hidden' }

  return (
    <aside style={wrapperStyle}>
      {/* Top: quick-create button */}
      <div style={{ padding:'16px 16px 8px', borderBottom:`1px solid ${C.border}` }}>
        <button onClick={onQuickCreate} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:8, border:`1px solid ${C.red}40`, background:'transparent', color:C.red, fontSize:12, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>
          <div style={{ width:22, height:22, borderRadius:11, background:C.red, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Plus style={{ width:14, height:14, color:'#fff' }} />
          </div>
          Tilføj opgave
        </button>
      </div>

      {/* Scrollable nav */}
      <nav style={{ flex:1, overflowY:'auto', padding:'8px 8px 16px' }}>
        {/* Quick views */}
        <SidebarItem icon={<Calendar style={{ width:14, height:14 }} />} label="I dag" count={counts.today} active={currentView==='today'} color={C.red} highlight={(dueCounts.today || 0) > 0} onClick={() => setCurrentView('today')} />
        <SidebarItem icon={<Calendar style={{ width:14, height:14 }} />} label="Denne uge" count={counts.week || 0} active={currentView==='week'} color={C.amber} highlight={(dueCounts.week || 0) > 0} onClick={() => setCurrentView('week')} />
        <SidebarItem icon={<ChevronRight style={{ width:14, height:14 }} />} label="Kommende" count={counts.upcoming} active={currentView==='upcoming'} color={C.blue} onClick={() => setCurrentView('upcoming')} />

        {/* Personer */}
        <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', padding:'14px 10px 6px' }}>Personer</div>
        <SidebarItem dotColor={C.blue} label={thomasName} count={counts.thomas} active={currentView==='thomas'} color={C.blue} highlight={(dueCounts.thomas || 0) > 0} onClick={() => setCurrentView('thomas')} onDropTodo={thomasId ? id => onDropTodo('thomas', id) : undefined} />
        {(sectionsByList?.['thomas'] || []).map(sec => (
          <SidebarItem
            key={sec.id}
            indent
            dotColor={sec.color || C.blue}
            label={sec.name}
            count={sectionCounts?.[`thomas:${sec.id}`] || 0}
            active={currentView === `thomas:sec:${sec.id}`}
            color={sec.color || C.blue}
            onClick={() => setCurrentView(`thomas:sec:${sec.id}` as ViewKeyLocal)}
            onDropTodo={thomasId ? id => onDropTodo(`thomas:sec:${sec.id}` as ViewKeyLocal, id) : undefined}
          />
        ))}
        <SidebarItem dotColor={C.pink} label={mariaName} count={counts.maria} active={currentView==='maria'} color={C.pink} highlight={(dueCounts.maria || 0) > 0} onClick={() => setCurrentView('maria')} onDropTodo={mariaId ? id => onDropTodo('maria', id) : undefined} />
        {(sectionsByList?.['maria'] || []).map(sec => (
          <SidebarItem
            key={sec.id}
            indent
            dotColor={sec.color || C.pink}
            label={sec.name}
            count={sectionCounts?.[`maria:${sec.id}`] || 0}
            active={currentView === `maria:sec:${sec.id}`}
            color={sec.color || C.pink}
            onClick={() => setCurrentView(`maria:sec:${sec.id}` as ViewKeyLocal)}
            onDropTodo={mariaId ? id => onDropTodo(`maria:sec:${sec.id}` as ViewKeyLocal, id) : undefined}
          />
        ))}
        <SidebarItem dotColor={C.cyan} label="Crew" count={counts.crew} active={currentView==='crew'} color={C.cyan} highlight={(dueCounts.crew || 0) > 0} onClick={() => setCurrentView('crew')} onDropTodo={id => onDropTodo('crew', id)} />

        {/* Lister */}
        <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', padding:'14px 10px 6px' }}>Lister</div>
        <SidebarItem dotColor={C.amber} label="Ringes til" count={counts.phone} active={currentView==='phone'} color={C.amber} highlight={(dueCounts.phone || 0) > 0} onClick={() => setCurrentView('phone')} />
        <SidebarItem dotColor={C.purple} label="Code" count={counts.code} active={currentView==='code'} color={C.purple} highlight={(dueCounts.code || 0) > 0} onClick={() => setCurrentView('code')} onDropTodo={id => onDropTodo('code', id)} />
        <SidebarItem dotColor={C.amber} label="Repareres" count={counts.repair} active={currentView==='repair'} color={C.amber} highlight={(dueCounts.repair || 0) > 0} onClick={() => setCurrentView('repair')} onDropTodo={id => onDropTodo('repair', id)} />
        <SidebarItem dotColor={C.cyan} label="Øst / Vest" count={counts.transport} active={currentView==='transport'} color={C.cyan} onClick={() => setCurrentView('transport')} />
        <SidebarItem dotColor={C.green} label="Indkøb" count={counts.shop} active={currentView==='shop'} color={C.green} highlight={(dueCounts.shop || 0) > 0} onClick={() => setCurrentView('shop')} />

        {/* Custom lists */}
        {customLists && customLists.length > 0 && customLists.map(list => (
          <SidebarItem
            key={list.id}
            dotColor={list.color}
            label={list.name}
            count={customListCounts?.[list.id] || 0}
            active={currentView === `custom:${list.id}`}
            color={list.color}
            highlight={(customListDueCounts?.[list.id] || 0) > 0}
            onClick={() => setCurrentView(`custom:${list.id}` as ViewKeyLocal)}
            onDropTodo={id => onDropTodo(`custom:${list.id}` as ViewKeyLocal, id)}
            onDelete={onDeleteCustomList ? () => onDeleteCustomList(list.id) : undefined}
          />
        ))}

        {/* Create new list button */}
        {onCreateList && (
          <button onClick={onCreateList} style={{
            width:'100%', display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:6,
            border:`1px dashed ${C.border}`, background:'transparent', color:C.textMuted, fontSize:12, fontWeight:600,
            cursor:'pointer', marginTop:6, transition:'all 0.15s', textAlign:'left',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.red+'60'; e.currentTarget.style.color = C.red }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted }}>
            <Plus style={{ width:12, height:12 }} /> Opret ny liste
          </button>
        )}

        {/* Tools */}
        <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', padding:'14px 10px 6px' }}>Værktøjer</div>
        <SidebarItem icon={<Lightbulb style={{ width:14, height:14, color:C.purple }} />} label="Idéer" count={counts.ideas} active={currentView==='ideas'} color={C.purple} onClick={() => setCurrentView('ideas')} />
        <button onClick={onShowPrintTransport} style={sidebarBtnStyle()}>
          <Printer style={{ width:14, height:14, color:C.cyan }} />
          <span style={{ flex:1, textAlign:'left' }}>Print Øst/Vest</span>
        </button>
      </nav>

      {/* Bottom: status */}
      <div style={{ padding:'10px 16px', borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:10, fontSize:10, color:C.textMuted }}>
        <div style={{ width:7, height:7, borderRadius:4, background: connected ? '#34d399' : C.red }} title={connected ? 'Forbundet' : 'Offline'} />
        <span>{connected ? 'Live' : 'Offline'}</span>
        {gpsActive && <><div style={{ width:7, height:7, borderRadius:4, background:C.cyan, boxShadow:`0 0 6px ${C.cyan}` }} /><span>GPS</span></>}
        {isMobile && <button onClick={onClose} style={{ marginLeft:'auto', padding:4, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer' }}><X style={{ width:14, height:14 }} /></button>}
      </div>
    </aside>
  )
}

function sidebarBtnStyle(active?: boolean, bgHover?: string): React.CSSProperties {
  return {
    width:'100%', display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:6,
    border:'none', background: active ? (bgHover || C.red + '18') : 'transparent',
    color: active ? C.text : C.textSec, fontSize:13, fontWeight: active ? 600 : 500,
    cursor:'pointer', textAlign:'left', transition:'background 0.12s',
  }
}

function SidebarItem({ icon, dotColor, label, count, active, color, highlight, onClick, onDropTodo, onDelete, indent }: {
  icon?: ReactNode; dotColor?: string; label: string; count: number; active: boolean; color: string; highlight?: boolean
  onClick: () => void; onDropTodo?: (id: string) => void | Promise<any>; onDelete?: () => void
  indent?: boolean
}) {
  const [dragOver, setDragOver] = useState(false)
  const [hover, setHover] = useState(false)
  const dropProps = onDropTodo ? {
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('application/x-todo-id')) { e.preventDefault(); setDragOver(true) } },
    onDragLeave: () => setDragOver(false),
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault(); setDragOver(false)
      const id = e.dataTransfer.getData('application/x-todo-id')
      if (id) await onDropTodo(id)
    },
  } : {}
  return (
    <div {...dropProps} style={{ position:'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}>
      <button onClick={onClick} style={{
        width:'100%', display:'flex', alignItems:'center', gap:10,
        padding: indent ? '5px 10px 5px 26px' : '7px 10px', borderRadius:6,
        border: dragOver ? `1px dashed ${color}` : '1px solid transparent',
        background: active ? C.card : dragOver ? color + '14' : hover ? C.cardHover : 'transparent',
        color: active ? C.text : C.textSec, fontSize: indent ? 12 : 13, fontWeight: active ? 600 : 500,
        cursor:'pointer', textAlign:'left', transition:'background 0.12s',
        marginBottom:1,
      }}>
        {icon ? icon : dotColor && <div style={{ width: indent ? 6 : 8, height: indent ? 6 : 8, borderRadius:4, background:dotColor, flexShrink:0 }} />}
        <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
        {onDelete && hover ? (
          <span onClick={e => { e.stopPropagation(); if (confirm(`Slet listen "${label}"?`)) onDelete() }} style={{ padding:2, color:C.textMuted, cursor:'pointer', display:'inline-flex' }}>
            <Trash2 style={{ width:12, height:12 }} />
          </span>
        ) : highlight ? (
          <span style={{ fontSize:10, fontWeight:800, color:C.red, background:C.red+'18', border:`1px solid ${C.red}40`, padding:'0 6px', borderRadius:10, minWidth:18, textAlign:'center' }}>! {count}</span>
        ) : count > 0 ? (
          <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, minWidth:18, textAlign:'right' }}>{count}</span>
        ) : null}
      </button>
    </div>
  )
}

/* ━━━ ISO week number ━━━ */
function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/* ━━━ Main View Header ━━━ */
function MainViewHeader({ currentView, isMobile, onToggleSidebar, counts, thomasName, mariaName, customLists, customListCount, onRenameCustomList, titleOverride, countOverride }: {
  currentView: string
  isMobile: boolean
  onToggleSidebar: () => void
  counts: Record<BuiltInViewKey, number>
  thomasName: string
  mariaName: string
  customLists?: { id: string; name: string; color: string }[]
  customListCount?: number
  onRenameCustomList?: (id: string, name: string) => void
  titleOverride?: string
  countOverride?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  const TITLES: Record<BuiltInViewKey, string> = {
    today: 'I dag',
    week: 'Denne uge',
    upcoming: 'Kommende',
    inbox: 'Indbakke',
    thomas: `TODO ${thomasName}`,
    maria: `TODO ${mariaName}`,
    crew: 'Crew',
    phone: 'Ringes til',
    code: 'Code',
    repair: 'Repareres',
    transport: 'Øst / Vest',
    shop: 'Indkøb',
    ideas: 'Idéer & Inspiration',
  }
  let title: string
  let count: number
  const isCustom = currentView.startsWith('custom:')
  const customListId = isCustom ? currentView.slice(7) : null
  if (titleOverride) {
    title = titleOverride
    count = countOverride || 0
  } else if (isCustom) {
    const list = customLists?.find(l => l.id === customListId)
    title = list?.name || 'Liste'
    count = customListCount || 0
  } else {
    title = TITLES[currentView as BuiltInViewKey] || currentView
    count = counts[currentView as BuiltInViewKey] || 0
  }
  const weekNo = getIsoWeek(new Date())

  const commitRename = () => {
    if (customListId && draftName.trim() && onRenameCustomList) {
      onRenameCustomList(customListId, draftName.trim())
    }
    setEditing(false)
  }

  return (
    <header style={{ padding: isMobile ? '12px 16px' : '20px 40px', borderBottom:`1px solid ${C.border}`, background:C.surface, display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
      {isMobile && (
        <button onClick={onToggleSidebar} style={{ padding:6, border:`1px solid ${C.border}`, borderRadius:6, background:'transparent', color:C.textSec, cursor:'pointer' }}>
          <ChevronRight style={{ width:16, height:16 }} />
        </button>
      )}
      {editing && isCustom ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false) }}
          style={{ fontSize: isMobile ? 18 : 22, fontWeight:700, color:C.text, background:C.input, border:`1px solid ${C.blue}`, borderRadius:8, padding:'4px 10px', outline:'none', minWidth:200 }}
        />
      ) : (
        <h1
          onClick={() => { if (isCustom && onRenameCustomList) { setDraftName(title); setEditing(true) } }}
          title={isCustom && onRenameCustomList ? 'Klik for at omdøbe' : undefined}
          style={{ fontSize: isMobile ? 18 : 22, fontWeight:700, color:C.text, letterSpacing:'-0.01em', cursor: isCustom && onRenameCustomList ? 'pointer' : 'default', display:'inline-flex', alignItems:'center', gap:6 }}
        >
          {title}
          {isCustom && onRenameCustomList && <Pencil style={{ width:14, height:14, color:C.textMuted, opacity:0.5 }} />}
        </h1>
      )}
      <span style={{ fontSize:12, fontWeight:600, color:C.textMuted, background:C.card, padding:'2px 10px', borderRadius:12 }}>{count}</span>
      <span style={{ fontSize:11, fontWeight:700, color:C.amber, background:C.amber+'15', border:`1px solid ${C.amber}35`, padding:'3px 10px', borderRadius:12, letterSpacing:'0.04em' }}>UGE {weekNo}</span>
      {!isMobile && <div style={{ marginLeft:'auto' }}><LiveClock /></div>}
    </header>
  )
}

/* ━━━ Inline Add Row (list view) ━━━ */
/* ━━━ Section Manager — add new section button ━━━ */
function SectionManager({ sections, onAdd }: { listKey: string; sections: { id: string; name: string }[]; onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (adding) inputRef.current?.focus() }, [adding])
  return (
    <div style={{ marginBottom:10 }}>
      {adding ? (
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) { onAdd(name); setName(''); setAdding(false) } }} style={{ display:'flex', gap:8 }}>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)} placeholder="Navn på sektion..." onBlur={() => { if (!name.trim()) setAdding(false) }} style={{ ...inputStyle, fontSize:12, flex:1 }} />
          <button type="submit" disabled={!name.trim()} style={{ padding:'8px 14px', borderRadius:8, border:'none', background:C.red, color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer', textTransform:'uppercase', opacity:name.trim()?1:0.35 }}>Opret</button>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} style={{
          display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:6, border:`1px solid ${C.border}`, background:'transparent',
          color:C.textMuted, fontSize:11, fontWeight:600, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em', transition:'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.red+'60'; e.currentTarget.style.color = C.red }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted }}>
          <Plus style={{ width:12, height:12 }} /> Ny sektion {sections.length > 0 && `(${sections.length})`}
        </button>
      )}
    </div>
  )
}

/* ━━━ Sectioned List — renders tasks grouped by section with drop targets ━━━ */
function SectionedList({ groups, color, employees, onToggle, onDelete, onClickTask, onDropTodo, onDeleteSection, onRenameSection, onSetSectionColor }: {
  listKey: string
  groups: { sectionId: string | null; name: string; color?: string | null; items: Todo[] }[]
  color: string
  employees: Map<string, Employee>
  onToggle: (t: Todo) => void
  onDelete: (t: Todo) => void
  onClickTask: (t: Todo) => void
  onDropTodo: (todoId: string, targetSectionId: string | null) => void | Promise<any>
  onDeleteSection: (sectionId: string) => void | Promise<any>
  onRenameSection: (sectionId: string, name: string) => void
  onSetSectionColor: (sectionId: string, color: string) => void
}) {
  return (
    <>
      {groups.map(g => (
        <SectionBlock
          key={g.sectionId || 'none'}
          name={g.name}
          color={g.color || color}
          items={g.items}
          isDefault={!g.sectionId}
          employees={employees}
          onToggle={onToggle}
          onDelete={onDelete}
          onClickTask={onClickTask}
          onDropTodo={id => onDropTodo(id, g.sectionId)}
          onDeleteSection={g.sectionId ? () => onDeleteSection(g.sectionId!) : undefined}
          onRenameSection={g.sectionId ? (name: string) => onRenameSection(g.sectionId!, name) : undefined}
          onSetColor={g.sectionId ? (col: string) => onSetSectionColor(g.sectionId!, col) : undefined}
        />
      ))}
    </>
  )
}

function SectionBlock({ name, color, items, isDefault, employees, onToggle, onDelete, onClickTask, onDropTodo, onDeleteSection, onRenameSection, onSetColor }: {
  name: string; color: string; items: Todo[]; isDefault: boolean
  employees: Map<string, Employee>
  onToggle: (t: Todo) => void; onDelete: (t: Todo) => void; onClickTask: (t: Todo) => void
  onDropTodo: (id: string) => void | Promise<any>
  onDeleteSection?: () => void | Promise<any>
  onRenameSection?: (name: string) => void
  onSetColor?: (color: string) => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [pickingColor, setPickingColor] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  const COLORS = [C.blue, C.pink, C.green, C.amber, C.purple, C.cyan, C.red]
  // Hide empty default section
  if (isDefault && items.length === 0) return null

  const commitRename = () => {
    if (draft.trim() && draft.trim() !== name && onRenameSection) onRenameSection(draft.trim())
    setEditing(false)
  }

  return (
    <div
      onDragOver={e => { if (e.dataTransfer.types.includes('application/x-todo-id')) { e.preventDefault(); setDragOver(true) } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async e => {
        e.preventDefault(); setDragOver(false)
        const id = e.dataTransfer.getData('application/x-todo-id')
        if (id) await onDropTodo(id)
      }}
      style={{
        marginBottom:16, padding: dragOver ? 8 : 0, borderRadius:10,
        border: dragOver ? `2px dashed ${color}` : '2px dashed transparent',
        background: dragOver ? color+'08' : 'transparent',
        transition:'all 0.12s',
      }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 4px 10px', borderBottom:`1px solid ${C.border}`, marginBottom:10 }}>
        <div style={{ width:4, height:14, borderRadius:2, background:color }} />
        {editing && onRenameSection ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setDraft(name); setEditing(false) } }}
            style={{ fontSize:12, fontWeight:700, color:C.text, background:C.input, border:`1px solid ${color}`, borderRadius:6, padding:'3px 8px', outline:'none', minWidth:160, textTransform:'uppercase' }}
          />
        ) : (
          <span
            onClick={() => { if (onRenameSection) { setDraft(name); setEditing(true) } }}
            title={onRenameSection ? 'Klik for at omdøbe' : undefined}
            style={{ fontSize:12, fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.05em', cursor: onRenameSection ? 'pointer' : 'default', display:'inline-flex', alignItems:'center', gap:6 }}
          >
            {name}
            {onRenameSection && <Pencil style={{ width:11, height:11, color:C.textMuted, opacity:0.45 }} />}
          </span>
        )}
        <span style={{ fontSize:10, fontWeight:600, color:C.textMuted, background:C.card, padding:'2px 7px', borderRadius:10 }}>{items.length}</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4, position:'relative' }}>
          {onSetColor && (
            <>
              <button onClick={() => setPickingColor(p => !p)} title="Skift farve"
                style={{ padding:3, border:'none', background:'transparent', cursor:'pointer', opacity:0.5, display:'flex' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>
                <div style={{ width:12, height:12, borderRadius:6, background:color, border:`1px solid ${C.border}` }} />
              </button>
              {pickingColor && (
                <div style={{ position:'absolute', top:20, right:0, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:8, display:'flex', gap:6, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', zIndex:50 }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => { onSetColor(c); setPickingColor(false) }}
                      style={{ width:22, height:22, borderRadius:11, background:c, border: color === c ? `2px solid ${C.text}` : '2px solid transparent', cursor:'pointer' }} />
                  ))}
                </div>
              )}
            </>
          )}
          {onDeleteSection && (
            <button onClick={() => { if (confirm(`Slet sektionen "${name}"? Opgaver i sektionen flyttes op i listen.`)) onDeleteSection() }}
              style={{ padding:3, border:'none', background:'transparent', color:C.textMuted, cursor:'pointer', opacity:0.4 }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = C.red }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = C.textMuted }}>
              <Trash2 style={{ width:12, height:12 }} />
            </button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize:11, color:C.textMuted, padding:'8px 4px', fontStyle:'italic' }}>Træk opgaver hertil</div>
      ) : (
        items.map(t => <TaskCard key={t.id} t={t} emp={t.assigned_to ? employees.get(t.assigned_to) : undefined} onDone={() => onToggle(t)} onDel={() => onDelete(t)} onClick={() => onClickTask(t)} />)
      )}
    </div>
  )
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 12px', borderRadius:8,
      border:`1px dashed ${C.border}`, background:'transparent', color:C.textMuted, fontSize:12, fontWeight:600,
      cursor:'pointer', marginBottom:10, transition:'all 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.red+'60'; e.currentTarget.style.color = C.red }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted }}>
      <Plus style={{ width:14, height:14 }} /> {label}
    </button>
  )
}

/* ━━━ Create List Modal ━━━ */
function CreateListModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, color: string) => void }) {
  const [name, setName] = useState('')
  const COLORS = [C.blue, C.pink, C.green, C.amber, C.purple, C.cyan, C.red]
  const [color, setColor] = useState(COLORS[0])
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1500, padding:20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`, maxWidth:420, width:'100%' }}>
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) onCreate(name.trim(), color) }} style={{ padding:24 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
            <h2 style={{ fontSize:16, fontWeight:700, color:'#fff' }}>NY LISTE</h2>
            <button type="button" onClick={onClose} style={{ padding:6, borderRadius:8, border:'none', background:C.card, color:C.textMuted, cursor:'pointer' }}>
              <X style={{ width:16, height:16 }} />
            </button>
          </div>
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Navn</label>
          <input ref={ref} placeholder="f.eks. Salg 2025" value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom:14 }} />
          <label style={{ display:'block', fontSize:11, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Farve</label>
          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} style={{
                width:32, height:32, borderRadius:16, background:c, border: color === c ? `3px solid ${C.text}` : '3px solid transparent', cursor:'pointer', transition:'all 0.15s',
              }} />
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button type="submit" disabled={!name.trim()} style={{ flex:1, padding:'10px 20px', borderRadius:8, fontSize:12, fontWeight:700, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity:name.trim()?1:0.35, textTransform:'uppercase', letterSpacing:'0.04em' }}>Opret liste</button>
            <button type="button" onClick={onClose} style={{ padding:'10px 20px', borderRadius:8, fontSize:12, fontWeight:600, background:'transparent', color:C.textMuted, border:'none', cursor:'pointer', textTransform:'uppercase' }}>Annullér</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LandingOverlay({ onSelect, onDismiss }: { onSelect:(idx:number)=>void; onDismiss:()=>void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const cols = [
    { icon: <Briefcase style={{ width:32, height:32 }} />, label: 'Thomas', color: C.blue },
    { icon: <User style={{ width:32, height:32 }} />, label: 'Maria', color: C.pink },
    { icon: <User style={{ width:32, height:32 }} />, label: 'Crew', color: C.cyan },
    { icon: <Truck style={{ width:32, height:32 }} />, label: 'ØST/VEST', color: C.cyan },
    { icon: <Phone style={{ width:32, height:32 }} />, label: 'Ringes', color: C.amber },
    { icon: <ShoppingCart style={{ width:32, height:32 }} />, label: 'Indkøb', color: C.green },
  ]

  return (
    <div onClick={onDismiss} style={{
      position:'fixed', inset:0, background:'rgba(12,12,15,0.95)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:3000, gap:40,
      opacity: visible ? 1 : 0, transition:'opacity 0.4s ease',
    }}>
      <h1 style={{ fontSize:32, fontWeight:700, color:'#fff', letterSpacing:'-0.02em', opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(-20px)', transition:'all 0.5s ease 0.1s' }}>
        TeamBattle Todo
      </h1>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:24 }}>
        {cols.map((c, i) => (
          <button key={i} onClick={(e) => { e.stopPropagation(); onSelect(i) }} style={{
            width:100, height:100, borderRadius:50, background:c.color+'15', border:`2px solid ${c.color}50`, color:c.color,
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer',
            opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.3)',
            transition:`all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.2 + i * 0.1}s`,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = c.color+'35'; e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.borderColor = c.color }}
            onMouseLeave={e => { e.currentTarget.style.background = c.color+'15'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = c.color+'50' }}>
            {c.icon}
            <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>{c.label}</span>
          </button>
        ))}
      </div>
      <span style={{ fontSize:12, color:C.textMuted, opacity: visible ? 1 : 0, transition:'opacity 0.5s ease 1s' }}>Klik for at åbne en sektion</span>
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
