import { useEffect, useState, useMemo, useRef } from 'react'
import type { Todo, ShoppingItem } from '../lib/types'
import { haversineDistance } from '../lib/utils'

const RADIUS_METERS = 500

interface GeoPosition {
  lat: number
  lon: number
  accuracy: number
}

export interface NearbyItem {
  type: 'todo' | 'shopping'
  id: string
  title: string
  distance: number
}

export function useGeofence(todos: Todo[], shopping: ShoppingItem[] = []) {
  const [position, setPosition] = useState<GeoPosition | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [watching, setWatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation ikke understøttet')
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setWatching(true)
        setError(null)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true)
          setError('GPS-adgang nægtet')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('GPS ikke tilgængelig')
        } else if (err.code === err.TIMEOUT) {
          setError('GPS timeout')
        }
        setWatching(false)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 15000,
      }
    )

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  const nearbyItems = useMemo(() => {
    if (!position) return []
    const items: NearbyItem[] = []

    for (const t of todos) {
      if (t.resolved || t.lat == null || t.lon == null) continue
      const d = haversineDistance(position.lat, position.lon, t.lat, t.lon)
      if (d <= RADIUS_METERS) items.push({ type: 'todo', id: t.id, title: t.title, distance: d })
    }

    for (const s of shopping) {
      if (s.purchased || s.lat == null || s.lon == null) continue
      const d = haversineDistance(position.lat, position.lon, s.lat, s.lon)
      if (d <= RADIUS_METERS) items.push({ type: 'shopping', id: s.id, title: s.title, distance: d })
    }

    return items.sort((a, b) => a.distance - b.distance)
  }, [todos, shopping, position])

  return { position, nearbyItems, watching, permissionDenied, error }
}
