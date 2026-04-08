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

  const addTodo = useCallback(async (todo: Partial<Todo>) => {
    const { data, error } = await supabase
      .from('todos')
      .insert({
        title: todo.title,
        description: todo.description || null,
        assigned_to: todo.assigned_to || null,
        priority: todo.priority || 'Normal',
        due_date: todo.due_date || null,
        category: todo.category || null,
        section_id: todo.section_id || null,
        location: todo.location || null,
        resolved: false,
        is_error: false,
      })
      .select()
      .single()

    if (!error && data) {
      setTodos(prev => [data, ...prev])
    }
    return { data, error }
  }, [])

  const updateTodo = useCallback(async (id: string, updates: Partial<Todo>) => {
    const { error } = await supabase
      .from('todos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    }
    return { error }
  }, [])

  const deleteTodo = useCallback(async (id: string) => {
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (!error) {
      setTodos(prev => prev.filter(t => t.id !== id))
    }
    return { error }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchTodos()

    const channel = supabase
      .channel('todos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, (payload) => {
        if (!mountedRef.current) return
        if (payload.eventType === 'INSERT') {
          setTodos(prev => {
            if (prev.some(t => t.id === (payload.new as Todo).id)) return prev
            return [payload.new as Todo, ...prev]
          })
        } else if (payload.eventType === 'UPDATE') {
          setTodos(prev => prev.map(t => t.id === (payload.new as Todo).id ? payload.new as Todo : t))
        } else if (payload.eventType === 'DELETE') {
          setTodos(prev => prev.filter(t => t.id !== (payload.old as any).id))
        }
      })
      .subscribe((status) => {
        if (mountedRef.current) setConnected(status === 'SUBSCRIBED')
      })

    const interval = setInterval(fetchTodos, 60000)

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchTodos])

  return { todos, loading, connected, addTodo, updateTodo, deleteTodo, refetch: fetchTodos }
}
