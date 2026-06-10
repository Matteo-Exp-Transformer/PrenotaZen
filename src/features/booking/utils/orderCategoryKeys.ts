/** Ordine categorie ingredienti per Pagina Prenota (sub-tab Personalizza form). */

export type CategorySortOrderMap = ReadonlyMap<string, number> | Readonly<Record<string, number>>

function getDbSortOrder(map: CategorySortOrderMap, key: string): number {
  if (map instanceof Map) return map.get(key) ?? 999
  return (map as Readonly<Record<string, number>>)[key] ?? 999
}

function compareByDbSortThenKey(
  a: string,
  b: string,
  dbSortOrderMap: CategorySortOrderMap,
): number {
  const diff = getDbSortOrder(dbSortOrderMap, a) - getDbSortOrder(dbSortOrderMap, b)
  return diff !== 0 ? diff : a.localeCompare(b, 'it')
}

/**
 * Ordina `keys`: prima la sequenza esplicita in `orderKeys` (solo chiavi presenti in `keys`),
 * poi le chiavi mancanti per `sort_order` DB. Senza `orderKeys` → solo sort DB.
 */
export function orderCategoryKeys(
  keys: readonly string[],
  orderKeys: readonly string[] | undefined,
  dbSortOrderMap: CategorySortOrderMap,
): string[] {
  if (!orderKeys?.length) {
    return [...keys].sort((a, b) => compareByDbSortThenKey(a, b, dbSortOrderMap))
  }

  const keySet = new Set(keys)
  const ordered: string[] = []
  const seen = new Set<string>()

  for (const key of orderKeys) {
    if (keySet.has(key) && !seen.has(key)) {
      ordered.push(key)
      seen.add(key)
    }
  }

  const remaining = keys.filter((key) => !seen.has(key))
  remaining.sort((a, b) => compareByDbSortThenKey(a, b, dbSortOrderMap))
  return [...ordered, ...remaining]
}

export function buildCategorySortOrderMap(
  categories: readonly { key: string; sort_order: number }[],
): Map<string, number> {
  return new Map(categories.map((cat) => [cat.key, cat.sort_order]))
}

/** Coppie [key, label] nell'ordine risolto per le chiavi fornite. */
export function buildOrderedCategoryEntries(
  categories: readonly { key: string; label: string; sort_order: number }[],
  keys: readonly string[],
  orderKeys: readonly string[] | undefined,
): readonly (readonly [string, string])[] {
  const labelByKey = new Map(categories.map((cat) => [cat.key, cat.label]))
  const sortOrderMap = buildCategorySortOrderMap(categories)
  const orderedKeys = orderCategoryKeys(keys, orderKeys, sortOrderMap)
  return orderedKeys.map((key) => [key, labelByKey.get(key) ?? key] as const)
}
