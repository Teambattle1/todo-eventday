import type { ParsedDescription } from './types'

// Prioritetsfarver
export const PRIORITY_CONFIG: Record<string, { color: string; label: string; order: number }> = {
  HASTER:       { color: '#ef4444', label: 'HASTER',       order: 0 },
  Vigtigt:      { color: '#f59e0b', label: 'Vigtigt',      order: 1 },
  'Prioritet 1': { color: '#ef4444', label: 'Prioritet 1', order: 2 },
  'Prioritet 2': { color: '#eab308', label: 'Prioritet 2', order: 3 },
  'Prioritet 3': { color: '#22c55e', label: 'Prioritet 3', order: 4 },
  Normal:       { color: '#3b82f6', label: 'Haster ikke', order: 5 },
  medium:       { color: '#94a3b8', label: 'Medium',       order: 6 },
  let:          { color: '#34d399', label: 'Let',           order: 7 },
  'Ved lejlighed': { color: '#6b7280', label: 'Ved lejlighed', order: 8 },
}

export function getPriorityColor(priority: string | null): string {
  if (!priority) return '#525252'
  return PRIORITY_CONFIG[priority]?.color ?? '#525252'
}

export function getPriorityOrder(priority: string | null): number {
  if (!priority) return 99
  return PRIORITY_CONFIG[priority]?.order ?? 50
}

export function getPriorityLabel(priority: string | null): string {
  if (!priority) return 'Ingen'
  return PRIORITY_CONFIG[priority]?.label ?? priority
}

// Dekod HTML entities i titler
export function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

// Strip HTML tags
export function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

// Parse description-feltet (kan være JSON eller HTML)
export function parseDescription(desc: string | null): ParsedDescription {
  if (!desc) return { type: 'text', text: '' }

  // Prøv JSON først
  try {
    const parsed = JSON.parse(desc)
    if (typeof parsed === 'object' && parsed !== null) {
      const text = parsed.shortDescription || parsed.description || parsed.longDescription || ''
      const image = parsed.image || (parsed.images && parsed.images[0]) || null
      return {
        type: 'json',
        text: typeof text === 'string' ? text : '',
        url: parsed.url || parsed.link || undefined,
        image: image || undefined,
        images: parsed.images || undefined,
        tags: parsed.tags || undefined,
      }
    }
  } catch {
    // Ikke JSON, fortsæt
  }

  // HTML check
  if (desc.includes('<') && desc.includes('>')) {
    return { type: 'html', text: stripHtml(desc) }
  }

  return { type: 'text', text: desc }
}

// Tjek om en dato er overskredet
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(dueDate) < today
}

// Kategorinavne til visning
export function getCategoryLabel(category: string | null): string {
  switch (category) {
    case 'idea-inspiration': return 'Inspiration'
    case 'idea-activity': return 'Aktivitetsidéer'
    case 'idea-company': return 'Firmaer'
    case 'IDEER': return 'Idéer fra Crew'
    case 'CODE': return 'CODE'
    case 'REPAIR': return 'Repareres'
    default: return 'Opgaver'
  }
}

export function isIdeaCategory(category: string | null): boolean {
  if (!category) return false
  return category.startsWith('idea-') || category === 'IDEER'
}

// Initialer fra navn
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Haversine distance i meter mellem to GPS-koordinater
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000 // Jordens radius i meter
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Deterministisk farve fra string
export function hashColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
    '#f59e0b', '#ef4444', '#ec4899', '#6366f1',
    '#14b8a6', '#f97316',
  ]
  return colors[Math.abs(hash) % colors.length]
}
