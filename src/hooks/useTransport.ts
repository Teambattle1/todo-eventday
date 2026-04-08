import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { TransportItem } from '../lib/types'

export function useTransport() {
  const [items, setItems] = useState<TransportItem[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('transport_items')
      .select('*')
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false })

    if (!error && data && mountedRef.current) {
      setItems(data)
      setLoading(false)
    }
  }, [])

  const addItem = useCallback(async (fields: { title: string; direction: 'east_to_west' | 'west_to_east'; note?: string; assigned_to?: string }) => {
    const { data, error } = await supabase
      .from('transport_items')
      .insert({
        title: fields.title,
        direction: fields.direction,
        note: fields.note || null,
        assigned_to: fields.assigned_to || null,
      })
      .select()
      .single()

    if (!error && data) {
      setItems(prev => [data, ...prev])
    }
    return { data, error }
  }, [])

  const toggleCompleted = useCallback(async (id: string, completed: boolean) => {
    const { error } = await supabase
      .from('transport_items')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setItems(prev => prev.map(item => item.id === id ? { ...item, completed } : item))
    }
  }, [])

  const updateItem = useCallback(async (id: string, updates: Partial<TransportItem>) => {
    const { error } = await supabase
      .from('transport_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    }
    return { error }
  }, [])

  const deleteItem = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('transport_items')
      .delete()
      .eq('id', id)

    if (!error) {
      setItems(prev => prev.filter(item => item.id !== id))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchItems()

    const channel = supabase
      .channel('transport-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transport_items' },
        (payload) => {
          if (!mountedRef.current) return
          if (payload.eventType === 'INSERT') {
            setItems(prev => {
              if (prev.some(i => i.id === (payload.new as TransportItem).id)) return prev
              return [payload.new as TransportItem, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => i.id === (payload.new as TransportItem).id ? payload.new as TransportItem : i))
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

  return { items, loading, addItem, updateItem, toggleCompleted, deleteItem }
}
