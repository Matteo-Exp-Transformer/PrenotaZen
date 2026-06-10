/**
 * Prenotazione «Prenota un tavolo» (senza menù / ingredienti).
 *
 * Data predefinita: vedi FIXED_BOOKING_DATE in bookingSeedShared (override env).
 *
 * Uso:
 *   npm run seed:booking-table
 *
 * Stesse variabili di scripts/seed-full-menu-booking.mjs:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, TENANT_SLUG
 * Opzionale: SUPABASE_SERVICE_ROLE_KEY (solo lettura org + insert PENDING come il form pubblico), NUM_GUESTS, DESIRED_TIME, CLIENT_* (CLIENT_NAME = nome esplicito; altrimenti nome persona casuale da bookingSeedShared).
 */

import { createClient } from '@supabase/supabase-js'
import {
  FIXED_BOOKING_DATE,
  PLACEHOLDER_SLUGS,
  resolveTenantSlugFromEnv,
  parseTenantSlugFromProjectRoot,
  resolveServiceRoleKey,
  normalizeTime,
  fetchOrgBySlug,
  resolveSeedClientName,
} from './bookingSeedShared.mjs'

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceKey = resolveServiceRoleKey()

  const slugFromFile = parseTenantSlugFromProjectRoot()
  const tenantSlug = resolveTenantSlugFromEnv()

  console.log('[seed-table-booking] slug risolto:', JSON.stringify(tenantSlug || '(vuoto)'))
  if (slugFromFile) {
    console.log('[seed-table-booking] (tenant da .env.local / .env nel repo)')
  }

  if (PLACEHOLDER_SLUGS.has(tenantSlug)) {
    console.error(`
[seed-table-booking] Placeholder (${tenantSlug}): imposta TENANT_SLUG allo slug vero dell'organizzazione.
`)
    process.exit(1)
  }

  if (!supabaseUrl || !anonKey) {
    console.error('Mancano VITE_SUPABASE_URL e/o VITE_SUPABASE_ANON_KEY (o SUPABASE_*).')
    process.exit(1)
  }
  if (!tenantSlug) {
    console.error('Manca TENANT_SLUG / VITE_TENANT_SLUG in .env.local')
    process.exit(1)
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey)
  const { org, orgErr } = await fetchOrgBySlug(supabaseAnon, tenantSlug)

  if (orgErr || !org) {
    console.error('Organizzazione non trovata per slug:', tenantSlug, orgErr?.message || '')
    process.exit(1)
  }

  const numGuests = Math.max(1, parseInt(process.env.NUM_GUESTS || '4', 10))
  const desiredTime = normalizeTime(process.env.DESIRED_TIME || '20:00')
  const clientName = resolveSeedClientName()
  const clientEmail = (process.env.CLIENT_EMAIL || 'script-table-test@example.invalid').trim()
  const clientPhone = process.env.CLIENT_PHONE || '3400000000'

  const basePayload = {
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    desired_date: FIXED_BOOKING_DATE,
    desired_time: desiredTime,
    num_guests: numGuests,
    special_requests: 'Generato da scripts/seed-table-booking.mjs — prenotazione solo tavolo.',
    booking_type: 'tavolo',
    event_type: null,
    menu: null,
    menu_selection: null,
    menu_total_per_person: null,
    menu_total_booking: null,
    preset_menu: null,
    dietary_restrictions: [],
    placement: 'Script QA',
  }

  if (serviceKey) {
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const { data: row, error: insErr } = await supabaseAdmin
      .from('booking_requests')
      .insert({
        tenant_id: org.id,
        ...basePayload,
        booking_source: 'public',
        status: 'pending',
      })
      .select('id,status,desired_date,booking_type')
      .single()

    if (insErr) {
      console.error('Insert fallita:', insErr.message)
      process.exit(1)
    }

    console.log('OK — prenotazione solo tavolo PENDING (service role):', JSON.stringify(row, null, 2))
    console.log('Richiesta in sospeso: approvala dall’admin per il calendario.')
    return
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/create-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({
      tenantSlug,
      ...basePayload,
    }),
  })

  const bodyText = await res.text()
  let parsed
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    parsed = bodyText
  }

  if (!res.ok) {
    console.error('create-booking fallita:', res.status, parsed)
    process.exit(1)
  }

  const booking = typeof parsed === 'object' ? parsed.booking ?? parsed : parsed
  console.log('OK — creata tramite Edge Function:', JSON.stringify(booking, null, 2))
  console.log(`
--- Calendario admin ---
Richiesta PENDING: compare tra le richieste in sospeso finché non la accetti.
`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
