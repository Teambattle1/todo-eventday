import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

export type CustomList = { id: string; name: string; color: string; sort_order?: number }
export type ListSection = { id: string; list_key: string; name: string; color?: string | null; sort_order?: number }

/**
 * Custom lists + list sections, persisted in Supabase.
 * Migrates any existing localStorage data on first load so users don't lose work.
 */
export function useLists() {
  const [customLists, setCustomLists] = useState<CustomList[]>([])
  const [sections, setSections] = useState<ListSection[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const migratedRef = useRef(false)

  const fetchAll = useCallback(async () => {
    const [{ data: lists }, { data: sects }] = await Promise.all([
      supabase.from('custom_lists').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('list_sections').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    ])
    if (!mountedRef.current) return
    if (lists) setCustomLists(lists)
    if (sects) setSections(sects)
    setLoading(false)
  }, [])

  // One-time migration from localStorage to Supabase
  const migrateFromLocalStorage = useCallback(async () => {
    if (migratedRef.current) return
    migratedRef.current = true
    try {
      const lsLists = JSON.parse(localStorage.getItem('customLists') || '[]') as CustomList[]
      const lsSections = JSON.parse(localStorage.getItem('listSections') || '{}') as Record<string, { id: string; name: string; color?: string }[]>
      if (lsLists.length) {
        const rows = lsLists.map((l, i) => ({ id: l.id, name: l.name, color: l.color, sort_order: i }))
        await supabase.from('custom_lists').upsert(rows, { onConflict: 'id' })
      }
      const sectionRows: ListSection[] = []
      Object.entries(lsSections).forEach(([listKey, arr]) => {
        arr.forEach((s, i) => sectionRows.push({ id: s.id, list_key: listKey, name: s.name, color: s.color || null, sort_order: i }))
      })
      if (sectionRows.length) {
        await supabase.from('list_sections').upsert(sectionRows, { onConflict: 'id' })
      }
      // Keep localStorage as a cached fallback; don't delete yet
      if (lsLists.length || sectionRows.length) {
        await fetchAll()
      }
    } catch { /* ignore */ }
  }, [fetchAll])

  useEffect(() => {
    mountedRef.current = true
    ;(async () => {
      await fetchAll()
      await migrateFromLocalStorage()
    })()

    const channel = supabase
      .channel('lists-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_lists' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'list_sections' }, fetchAll)
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [fetchAll, migrateFromLocalStorage])

  // Custom list operations
  const addCustomList = useCallback(async (name: string, color: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const row: CustomList = { id, name, color, sort_order: customLists.length }
    setCustomLists(prev => [...prev, row])
    await supabase.from('custom_lists').insert(row)
  }, [customLists.length])

  const renameCustomList = useCallback(async (id: string, name: string) => {
    if (!name.trim()) return
    setCustomLists(prev => prev.map(l => l.id === id ? { ...l, name: name.trim() } : l))
    await supabase.from('custom_lists').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', id)
  }, [])

  const deleteCustomList = useCallback(async (id: string) => {
    setCustomLists(prev => prev.filter(l => l.id !== id))
    // Also cascade delete sections for this list
    setSections(prev => prev.filter(s => s.list_key !== `custom:${id}`))
    await supabase.from('custom_lists').delete().eq('id', id)
    await supabase.from('list_sections').delete().eq('list_key', `custom:${id}`)
  }, [])

  // Section operations
  const addSection = useCallback(async (listKey: string, name: string, color?: string): Promise<string | null> => {
    if (!name.trim()) return null
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const existing = sections.filter(s => s.list_key === listKey).length
    const row: ListSection = { id, list_key: listKey, name: name.trim(), color: color || null, sort_order: existing }
    setSections(prev => [...prev, row])
    await supabase.from('list_sections').insert(row)
    return id
  }, [sections])

  const renameSection = useCallback(async (sectionId: string, name: string) => {
    if (!name.trim()) return
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, name: name.trim() } : s))
    await supabase.from('list_sections').update({ name: name.trim(), updated_at: new Date().toISOString() }).eq('id', sectionId)
  }, [])

  const setSectionColor = useCallback(async (sectionId: string, color: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, color } : s))
    await supabase.from('list_sections').update({ color, updated_at: new Date().toISOString() }).eq('id', sectionId)
  }, [])

  const deleteSection = useCallback(async (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId))
    await supabase.from('list_sections').delete().eq('id', sectionId)
  }, [])

  // Group sections by list_key for easy lookup
  const sectionsByList: Record<string, ListSection[]> = {}
  sections.forEach(s => {
    if (!sectionsByList[s.list_key]) sectionsByList[s.list_key] = []
    sectionsByList[s.list_key].push(s)
  })

  return {
    customLists, sections, sectionsByList, loading,
    addCustomList, renameCustomList, deleteCustomList,
    addSection, renameSection, setSectionColor, deleteSection,
  }
}
