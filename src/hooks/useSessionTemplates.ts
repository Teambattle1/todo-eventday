import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export interface SessionTemplate {
  id: string
  activity_id: string
  title: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  name: string
  color: string
}

export function useSessionTemplates() {
  const [templates, setTemplates] = useState<SessionTemplate[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  const fetchAll = useCallback(async () => {
    const [tRes, aRes] = await Promise.all([
      supabase.from('session_todo_templates').select('*').order('sort_order').order('created_at'),
      supabase.from('activities').select('id, name, color').order('id'),
    ])
    if (mountedRef.current) {
      if (!tRes.error && tRes.data) setTemplates(tRes.data)
      if (!aRes.error && aRes.data) setActivities(aRes.data)
      setLoading(false)
    }
  }, [])

  const addTemplate = useCallback(async (activityId: string, title: string) => {
    const maxSort = templates.filter(t => t.activity_id === activityId).reduce((m, t) => Math.max(m, t.sort_order), 0)
    const { data, error } = await supabase
      .from('session_todo_templates')
      .insert({ activity_id: activityId, title, sort_order: maxSort + 1 })
      .select()
      .single()
    if (!error && data) setTemplates(prev => [...prev, data])
    return { data, error }
  }, [templates])

  const updateTemplate = useCallback(async (id: string, updates: Partial<SessionTemplate>) => {
    const { error } = await supabase
      .from('session_todo_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (!error) setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    return { error }
  }, [])

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('session_todo_templates')
      .delete()
      .eq('id', id)
    if (!error) setTemplates(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchAll()

    const channel = supabase
      .channel('session-templates-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_todo_templates' }, () => {
        if (mountedRef.current) fetchAll()
      })
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [fetchAll])

  // Group templates by activity
  const templatesByActivity = new Map<string, SessionTemplate[]>()
  activities.forEach(a => templatesByActivity.set(a.id, []))
  templates.forEach(t => {
    const list = templatesByActivity.get(t.activity_id)
    if (list) list.push(t)
    else templatesByActivity.set(t.activity_id, [t])
  })

  return { templates, activities, templatesByActivity, loading, addTemplate, updateTemplate, deleteTemplate }
}
