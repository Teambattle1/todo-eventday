import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Location {
  id: string
  name: string
  address: string | null
  lat: number | null
  lon: number | null
}

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([])

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('locations')
        .select('id, name, address, lat, lon')
        .not('lat', 'is', null)
        .order('name')

      if (data) setLocations(data)
    }
    fetch()
  }, [])

  return locations
}
