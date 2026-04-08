import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { PhoneCall } from '../lib/types'

export function usePhoneCalls() {
  const [items, setItems] = useState<PhoneCall[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('phone_calls')
      .select('*')
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false })

    if (!error && data && mountedRef.current) {
      setItems(data)
      setLoading(false)
    }
  }, [])

  const addCall = useCallback(async (fields: { navn: string; nummer: string; firma?: string; note?: string; assigned_to?: string; urgent?: boolean; due_date?: string }) => {
    const { data, error } = await supabase
      .from('phone_calls')
      .insert({
        navn: fields.navn,
        nummer: fields.nummer,
        firma: fields.firma || null,
        note: fields.note || null,
        assigned_to: fields.assigned_to || null,
        urgent: fields.urgent || false,
        due_date: fields.due_date || null,
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
      .from('phone_calls')
      .update({ completed, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setItems(prev =>
        prev.map(item => item.id === id ? { ...item, completed } : item)
      )
    }
  }, [])

  const updateCall = useCallback(async (id: string, updates: Partial<PhoneCall>) => {
    const { error } = await supabase
      .from('phone_calls')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (!error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
    }
    return { error }
  }, [])

  const deleteCall = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('phone_calls')
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
      .channel('phone-calls-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'phone_calls' },
        (payload) => {
          if (!mountedRef.current) return
          if (payload.eventType === 'INSERT') {
            setItems(prev => {
              if (prev.some(i => i.id === (payload.new as PhoneCall).id)) return prev
              return [payload.new as PhoneCall, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev =>
              prev.map(i => i.id === (payload.new as PhoneCall).id ? payload.new as PhoneCall : i)
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

  return { items, loading, addCall, updateCall, toggleCompleted, deleteCall }
}
