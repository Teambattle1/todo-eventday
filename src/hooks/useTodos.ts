import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Todo } from '../lib/types'

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const mountedRef = useRef(true)

  const fetchTodos = useCallback(async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data && mountedRef.current) {
      setTodos(data)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchTodos()

    // Realtime subscription
    const channel = supabase
      .channel('todos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        (payload) => {
          if (!mountedRef.current) return

          if (payload.eventType === 'INSERT') {
            setTodos(prev => [payload.new as Todo, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setTodos(prev =>
              prev.map(t => t.id === (payload.new as Todo).id ? payload.new as Todo : t)
            )
          } else if (payload.eventType === 'DELETE') {
            setTodos(prev => prev.filter(t => t.id !== (payload.old as any).id))
          }
        }
      )
      .subscribe((status) => {
        if (mountedRef.current) {
          setConnected(status === 'SUBSCRIBED')
        }
      })

    // Polling fallback hvert 60. sekund
    const interval = setInterval(fetchTodos, 60000)

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchTodos])

  return { todos, loading, connected }
}
