import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { SessionJob } from '../lib/types'

const FIELDS = 'id, short_code, client_name, client_contact_name, client_contact_phone, event_date, event_end, location_name, location_city, status, guests_count, activities, notes, task_notes, created_at'

export function useSessionJobs() {
  const [items, setItems] = useState<SessionJob[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('task_jobs')
      .select(FIELDS)
      .is('deleted_at', null)
      .order('event_date', { ascending: false, nullsFirst: false })

    if (!error && data && mountedRef.current) {
      setItems(data)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchItems()

    const channel = supabase
      .channel('session-jobs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_jobs' },
        (payload) => {
          if (!mountedRef.current) return
          if (payload.eventType === 'INSERT') {
            const row = payload.new as SessionJob
            setItems(prev => {
              if (prev.some(i => i.id === row.id)) return prev
              return [row, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as any
            if (row.deleted_at) {
              setItems(prev => prev.filter(i => i.id !== row.id))
            } else {
              setItems(prev =>
                prev.map(i => i.id === row.id ? { ...i, ...row } : i)
              )
            }
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

  return { items, loading }
}
