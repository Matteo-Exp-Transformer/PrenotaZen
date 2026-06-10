/** Raggruppa items menu per chiave categoria, con sorting per sort_order → name. */

interface GroupableItem {
  category: string
  sort_order: number
  name: string
}

/**
 * Raggruppa `items` per `category` key, inizializzando un bucket vuoto per
 * ogni categoria in `categoryKeys` (anche se senza items).
 * Ogni bucket è ordinato per sort_order asc, poi name alfabetico su parità.
 */
export function groupMenuItemsByCategory<T extends GroupableItem>(
  items: T[],
  categoryKeys: string[],
): Record<string, T[]> {
  const grouped = categoryKeys.reduce(
    (acc, key) => {
      acc[key] = []
      return acc
    },
    {} as Record<string, T[]>,
  )

  for (const item of items) {
    if (!grouped[item.category]) {
      grouped[item.category] = []
    }
    grouped[item.category].push(item)
  }

  for (const key of Object.keys(grouped)) {
    grouped[key]?.sort((a, b) => {
      if (a.sort_order === b.sort_order) {
        return a.name.localeCompare(b.name)
      }
      return a.sort_order - b.sort_order
    })
  }

  return grouped
}
