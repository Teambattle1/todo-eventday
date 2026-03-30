import { useMemo } from 'react'
import type { Todo, Employee, ShoppingItem } from '../lib/types'
import { getPriorityOrder, getPriorityColor, isIdeaCategory, getCategoryLabel } from '../lib/utils'
import { useAutoScroll } from '../hooks/useAutoScroll'
import StatsBar from './StatsBar'
import ClockDisplay from './ClockDisplay'
import ConnectionStatus from './ConnectionStatus'
import TodoGroup from './TodoGroup'
import TodoCard from './TodoCard'
import IdeaCard from './IdeaCard'
import ShoppingColumn from './ShoppingColumn'
import { Loader2 } from 'lucide-react'

// Unikke farver til hver idé-kategori
const CATEGORY_COLORS: Record<string, string> = {
  'idea-inspiration': '#a78bfa',
  'idea-activity':    '#f472b6',
  'idea-company':     '#38bdf8',
  'IDEER':            '#fbbf24',
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#60a5fa'
}

interface ShoppingHook {
  items: ShoppingItem[]
  loading: boolean
  addItem: (title: string, note?: string, url?: string) => Promise<any>
  togglePurchased: (id: string, purchased: boolean) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

interface Props {
  todos: Todo[]
  employees: Map<string, Employee>
  loading: boolean
  connected: boolean
  shopping: ShoppingHook
}

export default function Dashboard({ todos, employees, loading, connected, shopping }: Props) {
  const scrollRef = useAutoScroll(true, 0.4)

  const { tasks, ideas } = useMemo(() => {
    const active = todos.filter(t => !t.resolved)
    const tasks: Todo[] = []
    const ideas: Todo[] = []

    for (const t of active) {
      if (isIdeaCategory(t.category)) {
        ideas.push(t)
      } else {
        tasks.push(t)
      }
    }

    tasks.sort((a, b) => {
      const pa = getPriorityOrder(a.priority)
      const pb = getPriorityOrder(b.priority)
      if (pa !== pb) return pa - pb
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return { tasks, ideas }
  }, [todos])

  const taskGroups = useMemo(() => {
    const groups = new Map<string, Todo[]>()
    for (const t of tasks) {
      const key = t.priority || 'Ingen'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }
    return Array.from(groups.entries()).sort((a, b) => {
      return getPriorityOrder(a[0] === 'Ingen' ? null : a[0]) - getPriorityOrder(b[0] === 'Ingen' ? null : b[0])
    })
  }, [tasks])

  const ideaGroups = useMemo(() => {
    const groups = new Map<string, Todo[]>()
    for (const t of ideas) {
      const key = t.category || 'ideas'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(t)
    }
    return Array.from(groups.entries())
  }, [ideas])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--accent)] animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <header className="shrink-0 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="max-w-[1400px] mx-auto px-10 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                TeamBattle ToDo
              </h1>
              <div className="mt-1">
                <StatsBar todos={todos} />
              </div>
            </div>
            <ClockDisplay />
          </div>
        </div>
      </header>

      {/* Scrollable content — 3 kolonner */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-10 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Kolonne 1: Opgaver */}
            <div>
              <div className="flex items-center gap-2 mb-5 pb-2 border-b border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">
                  Opgaver
                </span>
                <span className="text-xs text-[var(--text-muted)]">({tasks.length})</span>
              </div>

              {taskGroups.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <p className="text-sm">Ingen aktive opgaver</p>
                </div>
              ) : (
                taskGroups.map(([priority, items]) => (
                  <TodoGroup
                    key={priority}
                    title={priority}
                    count={items.length}
                    color={getPriorityColor(priority === 'Ingen' ? null : priority)}
                  >
                    {items.map(todo => (
                      <TodoCard
                        key={todo.id}
                        todo={todo}
                        employee={todo.assigned_to ? employees.get(todo.assigned_to) : undefined}
                      />
                    ))}
                  </TodoGroup>
                ))
              )}
            </div>

            {/* Kolonne 2: Indkøb */}
            <div>
              <ShoppingColumn
                items={shopping.items}
                loading={shopping.loading}
                onAdd={shopping.addItem}
                onToggle={shopping.togglePurchased}
                onDelete={shopping.deleteItem}
              />
            </div>

            {/* Kolonne 3: Idéer — auto-collapsed */}
            <div>
              <div className="flex items-center gap-2 mb-5 pb-2 border-b border-[var(--border)]">
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest">
                  Idéer & Inspiration
                </span>
                <span className="text-xs text-[var(--text-muted)]">({ideas.length})</span>
              </div>

              {ideaGroups.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <p className="text-sm">Ingen idéer endnu</p>
                </div>
              ) : (
                ideaGroups.map(([category, items]) => (
                  <TodoGroup
                    key={category}
                    title={getCategoryLabel(category)}
                    count={items.length}
                    color={getCategoryColor(category)}
                    defaultOpen={false}
                  >
                    {items.map(todo => (
                      <IdeaCard
                        key={todo.id}
                        todo={todo}
                        employee={todo.assigned_to ? employees.get(todo.assigned_to) : undefined}
                      />
                    ))}
                  </TodoGroup>
                ))
              )}
            </div>

          </div>
        </div>
      </div>

      <ConnectionStatus connected={connected} />
    </div>
  )
}
