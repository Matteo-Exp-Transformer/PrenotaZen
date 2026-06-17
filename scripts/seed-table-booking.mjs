/**
 * Prenotazione «Prenota un tavolo» (senza menù / ingredienti).
 *
 * Data predefinita: vedi FIXED_BOOKING_DATE in bookingSeedShared (override env).
 *
 * Uso:
 *   npm run seed:booking-table
 *
 * Env: .env.local.test (come Playwright) — E2E_TENANT_SLUG / MANUAL_TENANT_SLUG (default da-tommaso),
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, E2E_SUPABASE_SERVICE_KEY o SUPABASE_SERVICE_ROLE_KEY.
 * Opzionale: NUM_GUESTS, DESIRED_TIME, CLIENT_* (CLIENT_NAME = nome esplicito; altrimenti nome persona casuale da bookingSeedShared).
 */

import { createClient } from '@supabase/supabase-js'
import { createCliLogger, sanitizeBookingLog } from './_cliLog.mjs'
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

const { log, ok, fail } = createCliLogger('seed-table-booking')

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceKey = resolveServiceRoleKey()

  const slugFromFile = parseTenantSlugFromProjectRoot()
  const tenantSlug = resolveTenantSlugFromEnv()

  log('slug risolto', { slug: tenantSlug || '(vuoto)' })
  if (slugFromFile) {
    log('tenant da .env.local.test / .env.local (E2E_TENANT_SLUG)')
  }

  if (PLACEHOLDER_SLUGS.has(tenantSlug)) {
    fail(
      `Placeholder (${tenantSlug}): imposta E2E_TENANT_SLUG in .env.local.test allo slug vero dell'organizzazione.`,
      1,
    )
  }

  if (!supabaseUrl || !anonKey) {
    fail('Mancano VITE_SUPABASE_URL e/o VITE_SUPABASE_ANON_KEY in .env.local.test (o SUPABASE_*).', 1)
  }

  const supabaseAnon = createClient(supabaseUrl, anonKey)
  const { org, orgErr } = await fetchOrgBySlug(supabaseAnon, tenantSlug)

  if (orgErr || !org) {
    fail('Organizzazione non trovata per slug', { slug: tenantSlug, err: orgErr }, 1)
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
      fail('Insert fallita', insErr, 1)
    }

    ok('prenotazione solo tavolo PENDING (service role)', { booking: sanitizeBookingLog(row) })
    log('Richiesta in sospeso: approvala dall’admin per il calendario.')
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
    fail('create-booking fallita', { status: res.status, body: parsed }, 1)
  }

  const booking = typeof parsed === 'object' ? parsed.booking ?? parsed : parsed
  ok('creata tramite Edge Function', { booking: sanitizeBookingLog(booking) })
  log('Richiesta PENDING: compare tra le richieste in sospeso finché non la accetti.')
}

main().catch((e) => {
  fail('Errore imprevisto', e, 1)
})
