import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Skilt } from '../lib/types'

export function useSkilte() {
  const [items, setItems] = useState<Skilt[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('skilte')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error && data && mountedRef.current) {
      setItems(data)
      setLoading(false)
    }
  }, [])

  const addSkilt = useCallback(async (fields: { text: string; color?: string }) => {
    const { data, error } = await supabase
      .from('skilte')
      .insert({
        text: fields.text,
        color: fields.color || null,
      })
      .select()
      .single()

    if (!error && data) {
      setItems(prev => [...prev, data])
    }
    return { data, error }
  }, [])

  const updateSkilt = useCallback(async (id: string, updates: Partial<Skilt>) => {
    const { error } = await supabase
      .from('skilte')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    }
    return { error }
  }, [])

  const deleteSkilt = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('skilte')
      .delete()
      .eq('id', id)

    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchItems()

    const channel = supabase
      .channel('skilte-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'skilte' },
        (payload) => {
          if (!mountedRef.current) return
          if (payload.eventType === 'INSERT') {
            setItems(prev => {
              if (prev.some(i => i.id === (payload.new as Skilt).id)) return prev
              return [...prev, payload.new as Skilt]
            })
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev =>
              prev.map(i => i.id === (payload.new as Skilt).id ? payload.new as Skilt : i)
            )
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== (payload.old as any).id))
          }
        }
      )
      .subscribe()

    const interval = setInterval(fetchItems, 60000)

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [fetchItems])

  return { items, loading, addSkilt, updateSkilt, deleteSkilt }
}
