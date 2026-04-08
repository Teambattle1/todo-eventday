export interface Todo {
  id: string
  title: string
  description: string | null
  assigned_to: string | null
  created_by: string | null
  location: string | null
  alarm_at: string | null
  created_at: string
  updated_at: string
  resolved: boolean
  is_error: boolean
  priority: string | null
  due_date: string | null
  remind_on_next_login: boolean
  lat: number | null
  lon: number | null
  geo_address: string | null
  category: string | null
  images: string[] | null
}

export interface Employee {
  id: string
  navn: string
  location: string | null
  email: string | null
}

export interface ParsedDescription {
  type: 'json' | 'html' | 'text'
  text: string
  url?: string
  image?: string
  images?: string[]
  tags?: string[]
}

export interface ShoppingItem {
  id: string
  title: string
  note: string | null
  quantity: number
  url: string | null
  priority: string
  purchased: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  due_date: string | null
  urgent: boolean
  assigned_to: string | null
  lat: number | null
  lon: number | null
  geo_address: string | null
  images: string[] | null
}

export interface TransportItem {
  id: string
  title: string
  direction: 'east_to_west' | 'west_to_east'
  note: string | null
  assigned_to: string | null
  completed: boolean
  created_at: string
  updated_at: string
}

export interface PhoneCall {
  id: string
  navn: string
  nummer: string
  firma: string | null
  note: string | null
  assigned_to: string | null
  completed: boolean
  urgent: boolean
  due_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
