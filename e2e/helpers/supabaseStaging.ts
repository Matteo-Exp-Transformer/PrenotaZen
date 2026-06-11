/**
 * Helper REST Supabase staging per seed/cleanup E2E (service role).
 * Usare SOLO con progetto TEST (docnnernvp) — mai PROD.
 */

import fs from 'fs'

export const E2E_BOOKING_PREFIX = 'E2E-FU043-'
export const E2E_MENU_PREFIX = 'E2E-M3-'

function ensureStagingEnvLoaded() {
  if (process.env.VITE_SUPABASE_URL && serviceKey()) return
  if (fs.existsSync('.env.local.test')) {
    process.loadEnvFile('.env.local.test')
  }
}

type RestHeaders = Record<string, string>

function stagingUrl(): string {
  return process.env.VITE_SUPABASE_URL ?? ''
}

function serviceKey(): string {
  return process.env.E2E_SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
}

function requireStagingConfig() {
  ensureStagingEnvLoaded()
  if (!stagingUrl() || !serviceKey()) {
    throw new Error('VITE_SUPABASE_URL e E2E_SUPABASE_SERVICE_KEY richiesti in .env.local.test')
  }
  if (!stagingUrl().includes('docnnernvp')) {
    throw new Error('E2E staging bloccato: VITE_SUPABASE_URL non punta al progetto TEST docnnernvp')
  }
}

function restHeaders(extra?: RestHeaders): RestHeaders {
  const key = serviceKey()
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  requireStagingConfig()
  const resp = await fetch(`${stagingUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...restHeaders(),
      ...(init?.headers as RestHeaders | undefined),
    },
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Supabase REST ${init?.method ?? 'GET'} ${path} → ${resp.status}: ${body}`)
  }
  if (resp.status === 204) return undefined as T
  const text = await resp.text()
  return (text ? JSON.parse(text) : undefined) as T
}

type MenuCategoryE2eInput = {
  tenantId: string
  key: string
  label: string
  description?: string | null
  isAvailable?: boolean
  sortOrder?: number
}

export type MenuCategoryE2eRow = {
  id: string
  key: string
  label: string
  is_available: boolean | null
}

type MenuItemE2eInput = {
  tenantId: string
  categoryKey: string
  name: string
  price?: number
  description?: string | null
  isAvailable?: boolean
  sortOrder?: number
  bookingTypes?: string[]
}

export type MenuItemE2eRow = {
  id: string
  name: string
  category: string
  is_available: boolean | null
}

type MenuQrE2eInput = {
  tenantId: string
  shortCode: string
  name: string
  categoryFilter: string[]
  hiddenMenuItemIds?: string[]
}

export type MenuQrE2eRow = {
  id: string
  short_code: string
  category_filter: string[] | null
  hidden_menu_item_ids: string[] | null
  is_active: boolean
}

export type RestaurantSettingSnapshot = {
  exists: boolean
  value: unknown
}

export async function upsertMenuCategory(input: MenuCategoryE2eInput): Promise<MenuCategoryE2eRow> {
  const existing = await rest<MenuCategoryE2eRow[]>(
    `menu_categories?tenant_id=eq.${input.tenantId}&key=eq.${encodeURIComponent(input.key)}&select=id,key,label,is_available&limit=1`,
  )
  const row = {
    tenant_id: input.tenantId,
    key: input.key,
    label: input.label,
    description: input.description ?? null,
    is_available: input.isAvailable ?? true,
    sort_order: input.sortOrder ?? 9000,
    updated_at: new Date().toISOString(),
  }

  if (existing[0]?.id) {
    const updated = await rest<MenuCategoryE2eRow[]>(
      `menu_categories?id=eq.${existing[0].id}`,
      {
        method: 'PATCH',
        headers: restHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(row),
      },
    )
    return updated[0]
  }

  const created = await rest<MenuCategoryE2eRow[]>('menu_categories', {
    method: 'POST',
    headers: restHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  })
  return created[0]
}

export async function upsertMenuItem(input: MenuItemE2eInput): Promise<MenuItemE2eRow> {
  const existing = await rest<MenuItemE2eRow[]>(
    `menu_items?tenant_id=eq.${input.tenantId}&category=eq.${encodeURIComponent(input.categoryKey)}&name=eq.${encodeURIComponent(input.name)}&select=id,name,category,is_available&limit=1`,
  )
  const row = {
    tenant_id: input.tenantId,
    name: input.name,
    category: input.categoryKey,
    price: input.price ?? 9.5,
    description: input.description ?? 'Prodotto E2E per blindatura Menu',
    is_available: input.isAvailable ?? true,
    sort_order: input.sortOrder ?? 9000,
    booking_types: input.bookingTypes ?? ['rinfresco_laurea', 'menu_prezzo_fisso'],
    updated_at: new Date().toISOString(),
  }

  if (existing[0]?.id) {
    const updated = await rest<MenuItemE2eRow[]>(`menu_items?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: restHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    })
    return updated[0]
  }

  const created = await rest<MenuItemE2eRow[]>('menu_items', {
    method: 'POST',
    headers: restHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  })
  return created[0]
}

export async function setMenuCategoryAvailability(
  tenantId: string,
  categoryId: string,
  isAvailable: boolean,
): Promise<void> {
  await rest(`menu_categories?id=eq.${categoryId}&tenant_id=eq.${tenantId}`, {
    method: 'PATCH',
    headers: restHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ is_available: isAvailable, updated_at: new Date().toISOString() }),
  })
}

export async function setMenuItemAvailability(
  tenantId: string,
  itemId: string,
  isAvailable: boolean,
): Promise<void> {
  await rest(`menu_items?id=eq.${itemId}&tenant_id=eq.${tenantId}`, {
    method: 'PATCH',
    headers: restHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ is_available: isAvailable, updated_at: new Date().toISOString() }),
  })
}

export async function getMenuCategoryAvailability(categoryId: string): Promise<boolean | null> {
  const rows = await rest<Array<{ is_available: boolean | null }>>(
    `menu_categories?id=eq.${categoryId}&select=is_available&limit=1`,
  )
  return rows[0]?.is_available ?? null
}

export async function getMenuItemAvailability(itemId: string): Promise<boolean | null> {
  const rows = await rest<Array<{ is_available: boolean | null }>>(
    `menu_items?id=eq.${itemId}&select=is_available&limit=1`,
  )
  return rows[0]?.is_available ?? null
}

export async function upsertMenuQrCode(input: MenuQrE2eInput): Promise<MenuQrE2eRow> {
  const existing = await rest<MenuQrE2eRow[]>(
    `menu_qr_codes?tenant_id=eq.${input.tenantId}&short_code=eq.${encodeURIComponent(input.shortCode)}&select=id,short_code,category_filter,hidden_menu_item_ids,is_active&limit=1`,
  )
  const row = {
    tenant_id: input.tenantId,
    short_code: input.shortCode,
    name: input.name,
    category_filter: input.categoryFilter,
    hidden_menu_item_ids: input.hiddenMenuItemIds ?? [],
    is_active: true,
    sort_order: 9000,
    theme_key: 'mediterranean_teal',
    carousel_items: [],
    category_images: {},
    updated_at: new Date().toISOString(),
  }

  if (existing[0]?.id) {
    const updated = await rest<MenuQrE2eRow[]>(`menu_qr_codes?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: restHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
    })
    return updated[0]
  }

  const created = await rest<MenuQrE2eRow[]>('menu_qr_codes', {
    method: 'POST',
    headers: restHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  })
  return created[0]
}

export async function deleteMenuE2eData(
  tenantId: string,
  categoryKey: string,
  shortCode: string,
): Promise<void> {
  await rest(
    `menu_qr_codes?tenant_id=eq.${tenantId}&short_code=eq.${encodeURIComponent(shortCode)}`,
    {
      method: 'DELETE',
      headers: restHeaders({ Prefer: 'return=minimal' }),
    },
  )
  await rest(
    `menu_items?tenant_id=eq.${tenantId}&category=eq.${encodeURIComponent(categoryKey)}`,
    {
      method: 'DELETE',
      headers: restHeaders({ Prefer: 'return=minimal' }),
    },
  )
  await rest(
    `menu_categories?tenant_id=eq.${tenantId}&key=eq.${encodeURIComponent(categoryKey)}`,
    {
      method: 'DELETE',
      headers: restHeaders({ Prefer: 'return=minimal' }),
    },
  )
}

export async function getRestaurantSettingSnapshot(
  tenantId: string,
  settingKey: string,
): Promise<RestaurantSettingSnapshot> {
  const rows = await rest<Array<{ setting_value: unknown }>>(
    `restaurant_settings?tenant_id=eq.${tenantId}&setting_key=eq.${encodeURIComponent(settingKey)}&select=setting_value&limit=1`,
  )
  if (!rows[0]) return { exists: false, value: null }
  return { exists: true, value: rows[0].setting_value }
}

export async function upsertRestaurantSettingValue(
  tenantId: string,
  settingKey: string,
  value: unknown,
): Promise<void> {
  const existing = await rest<Array<{ id: string }>>(
    `restaurant_settings?tenant_id=eq.${tenantId}&setting_key=eq.${encodeURIComponent(settingKey)}&select=id&limit=1`,
  )
  const row = {
    tenant_id: tenantId,
    setting_key: settingKey,
    setting_value: value,
    updated_at: new Date().toISOString(),
  }
  if (existing[0]?.id) {
    await rest(`restaurant_settings?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: restHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(row),
    })
    return
  }
  await rest('restaurant_settings', {
    method: 'POST',
    headers: restHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  })
}

export async function restoreRestaurantSettingSnapshot(
  tenantId: string,
  settingKey: string,
  snapshot: RestaurantSettingSnapshot,
): Promise<void> {
  if (snapshot.exists) {
    await upsertRestaurantSettingValue(tenantId, settingKey, snapshot.value)
    return
  }
  await rest(
    `restaurant_settings?tenant_id=eq.${tenantId}&setting_key=eq.${encodeURIComponent(settingKey)}`,
    {
      method: 'DELETE',
      headers: restHeaders({ Prefer: 'return=minimal' }),
    },
  )
}

export async function getTenantIdBySlug(slug: string): Promise<string> {
  const rows = await rest<Array<{ id: string }>>(
    `organizations?slug=eq.${encodeURIComponent(slug)}&select=id&limit=1`,
  )
  const id = rows[0]?.id
  if (!id) throw new Error(`Tenant non trovato per slug: ${slug}`)
  return id
}

export type ServiceSlotRow = {
  id: string
  name: string
  start_time: string
  end_time: string
  max_guests: number | null
}

export async function getServiceSlots(tenantId: string): Promise<ServiceSlotRow[]> {
  return rest<ServiceSlotRow[]>(
    `service_slots?tenant_id=eq.${tenantId}&select=id,name,start_time,end_time,max_guests&order=display_order`,
  )
}

export async function getSlotGuestCapacities(tenantId: string): Promise<Record<string, number | null>> {
  const rows = await rest<Array<{ setting_value: Record<string, number | null> }>>(
    `restaurant_settings?tenant_id=eq.${tenantId}&setting_key=eq.slot_guest_capacities&select=setting_value`,
  )
  return rows[0]?.setting_value ?? {}
}

export async function upsertSlotGuestCapacities(
  tenantId: string,
  capacities: Record<string, number | null>,
): Promise<void> {
  const existing = await rest<Array<{ id: string }>>(
    `restaurant_settings?tenant_id=eq.${tenantId}&setting_key=eq.slot_guest_capacities&select=id&limit=1`,
  )
  if (existing[0]?.id) {
    await rest(`restaurant_settings?id=eq.${existing[0].id}`, {
      method: 'PATCH',
      headers: restHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ setting_value: capacities }),
    })
    return
  }
  await rest('restaurant_settings', {
    method: 'POST',
    headers: restHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      tenant_id: tenantId,
      setting_key: 'slot_guest_capacities',
      setting_value: capacities,
    }),
  })
}

export type SeedBookingInput = {
  tenantId: string
  clientName: string
  status: 'pending' | 'accepted'
  desiredDate: string
  desiredTime: string
  numGuests: number
  confirmedStart?: string
  confirmedEnd?: string
}

export async function insertBooking(input: SeedBookingInput): Promise<string> {
  const row = {
    tenant_id: input.tenantId,
    client_name: input.clientName,
    client_email: `${input.clientName.replace(/\s+/g, '.').toLowerCase()}@e2e.test`,
    status: input.status,
    desired_date: input.desiredDate,
    desired_time: input.desiredTime,
    num_guests: input.numGuests,
    booking_source: 'public',
    source: 'public_form',
    confirmed_start: input.confirmedStart ?? null,
    confirmed_end: input.confirmedEnd ?? null,
  }
  const created = await rest<Array<{ id: string }>>('booking_requests', {
    method: 'POST',
    headers: restHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  })
  const id = created[0]?.id
  if (!id) throw new Error('insertBooking: nessun id restituito')
  return id
}

export async function deleteBookingsByPrefix(tenantId: string, prefix = E2E_BOOKING_PREFIX): Promise<void> {
  await rest(
    `booking_requests?tenant_id=eq.${tenantId}&client_name=like.${encodeURIComponent(prefix)}*`,
    {
      method: 'DELETE',
      headers: restHeaders({ Prefer: 'return=minimal' }),
    },
  )
}

export async function getBookingStatus(bookingId: string): Promise<string | null> {
  const rows = await rest<Array<{ status: string }>>(
    `booking_requests?id=eq.${bookingId}&select=status&limit=1`,
  )
  return rows[0]?.status ?? null
}

export function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Data ISO locale a N giorni da oggi (per prenotazioni «future» in E2E). */
export function offsetIsoDate(daysFromToday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isoStartEnd(date: string, timeHHmm: string): { start: string; end: string } {
  const [h, min] = timeHHmm.split(':').map(Number)
  const endH = h + 3
  const endTime = `${String(endH).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  return {
    start: `${date}T${timeHHmm}:00+00:00`,
    end: `${date}T${endTime}:00+00:00`,
  }
}
