import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { ShoppingItem } from '../lib/types'

export function useShopping() {
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('todo_shopping')
      .select('*')
      .order('purchased', { ascending: true })
      .order('urgent', { ascending: false })
      .order('created_at', { ascending: false })

    if (!error && data && mountedRef.current) {
      setItems(data)
      setLoading(false)
    }
  }, [])

  const addItem = useCallback(async (title: string, note?: string, url?: string, due_date?: string, urgent?: boolean) => {
    const { data, error } = await supabase
      .from('todo_shopping')
      .insert({ title, note: note || null, url: url || null, due_date: due_date || null, urgent: urgent || false })
      .select()
      .single()

    if (!error && data) {
      setItems(prev => [data, ...prev])
    }
    return { data, error }
  }, [])

  const togglePurchased = useCallback(async (id: string, purchased: boolean) => {
    const { error } = await supabase
      .from('todo_shopping')
      .update({ purchased, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setItems(prev =>
        prev.map(item => item.id === id ? { ...item, purchased } : item)
      )
    }
  }, [])

  const deleteItem = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('todo_shopping')
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
      .channel('shopping-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todo_shopping' },
        (payload) => {
          if (!mountedRef.current) return
          if (payload.eventType === 'INSERT') {
            setItems(prev => {
              if (prev.some(i => i.id === (payload.new as ShoppingItem).id)) return prev
              return [payload.new as ShoppingItem, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev =>
              prev.map(i => i.id === (payload.new as ShoppingItem).id ? payload.new as ShoppingItem : i)
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

  return { items, loading, addItem, togglePurchased, deleteItem }
}
