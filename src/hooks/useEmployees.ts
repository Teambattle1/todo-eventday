import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Employee } from '../lib/types'

export function useEmployees() {
  const [employees, setEmployees] = useState<Map<string, Employee>>(new Map())

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('employees')
        .select('id, navn, location, email')

      if (data) {
        const map = new Map<string, Employee>()
        for (const e of data) {
          map.set(e.id, e)
        }
        setEmployees(map)
      }
    }
    fetch()
  }, [])

  return employees
}
