import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Module-level shared cache so alle TaskCards deler samme map uden duplikerede queries.
let cached: Map<string, string> | null = null
let inflight: Promise<void> | null = null
const subscribers = new Set<() => void>()

async function loadOnce() {
  if (cached) return
  if (inflight) return inflight
  inflight = (async () => {
    const { data } = await supabase
      .from('locations')
      .select('venue_code, name')
      .not('venue_code', 'is', null)
    const m = new Map<string, string>()
    if (data) {
      for (const r of data as { venue_code: string | null; name: string | null }[]) {
        if (r.venue_code && r.name) m.set(r.venue_code, r.name)
      }
    }
    cached = m
    inflight = null
    subscribers.forEach(fn => fn())
  })()
  return inflight
}

export function useVenueByCode(): Map<string, string> {
  const [, force] = useState(0)
  useEffect(() => {
    if (cached) return
    const sub = () => force(n => n + 1)
    subscribers.add(sub)
    loadOnce()
    return () => { subscribers.delete(sub) }
  }, [])
  return cached || new Map()
}
