/**
 * Rinfresco di Laurea — selezione casuale di voci dal menù (`menu_items`) del tenant.
 * Non dipende da nomi fissi di categorie o piatti (solo logica speciale «tiramisù» come nel form admin).
 *
 * Data predefinita: FIXED_BOOKING_DATE in bookingSeedShared (override env).
 *
 * Uso:
 *   npm run seed:booking-menu-full
 *
 * Variabili random (opzionali):
 *   RANDOM_MENU_MIN — numero minimo di voci estratte (default 3)
 *   RANDOM_MENU_MAX — numero massimo di voci estratte (default 12, mai oltre le voci disponibili)
 *
 * Credenziali: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY, TENANT_SLUG.
 * Nome prenotazione: env CLIENT_NAME oppure nome persona casuale (lista in bookingSeedShared).
 * Se la lettura anon di menu_items resta vuota (RLS sul progetto remoto), usa anche
 * SUPABASE_SERVICE_ROLE_KEY: lo script la usa per caricare organizations + menu_items e per INSERT PENDING.
 */

import { createClient } from '@supabase/supabase-js'
import {
  FIXED_BOOKING_DATE,
  PLACEHOLDER_SLUGS,
  resolveTenantSlugFromEnv,
  parseTenantSlugFromProjectRoot,
  resolveServiceRoleKey,
  serviceRoleKeyOrigin,
  normalizeTime,
  fetchOrgBySlug,
  fetchMenuItemsForTenant,
  resolveSeedClientName,
} from './bookingSeedShared.mjs'

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Estrae un numero casuale di righe fra RANDOM_MENU_MIN e RANDOM_MENU_MAX (clamp su lunghezza elenco). */
function pickRandomMenuRows(menuRows) {
  if (!menuRows.length) return []

  let rawMin = parseInt(process.env.RANDOM_MENU_MIN || '3', 10)
  let rawMax = parseInt(process.env.RANDOM_MENU_MAX || '12', 10)
  if (Number.isNaN(rawMin) || rawMin < 1) rawMin = 3
  if (Number.isNaN(rawMax) || rawMax < 1) rawMax = 12
  rawMax = Math.max(rawMin, rawMax)

  const effectiveMax = Math.min(menuRows.length, rawMax)
  const effectiveMin = Math.min(rawMin, effectiveMax)
  const count =
    effectiveMin + Math.floor(Math.random() * (effectiveMax - effectiveMin + 1))

  const copy = [...menuRows]
  shuffleInPlace(copy)
  const picked = copy.slice(0, count)

  const hasNonTiramisuBase = picked.some((r) => !r.name.toLowerCase().includes('tiramis'))
  const poolNonTiramisu = menuRows.filter((r) => !r.name.toLowerCase().includes('tiramis'))
  if (!hasNonTiramisuBase && poolNonTiramisu.length > 0) {
    shuffleInPlace(poolNonTiramisu)
    picked.push(poolNonTiramisu[0])
    console.log(
      '[seed-full-menu-booking] Aggiunta una voce non-tiramisù al campione perché serve menu_total_per_person > 0.',
    )
  }

  return picked
}

function buildMenuSelection(menuRows) {
  let tiramisuKg = 0
  let tiramisuTotal = 0
  let tiramisuDone = false
  const items = []

  for (const row of menuRows) {
    const price = Number(row.price)
    const name = row.name
    const isTiramisu = name.toLowerCase().includes('tiramis')

    if (isTiramisu) {
      if (tiramisuDone) continue
      const kg = 1
      const lineTotal = price * kg
      tiramisuKg = kg
      tiramisuTotal = lineTotal
      tiramisuDone = true
      items.push({
        id: row.id,
        name: row.name,
        price,
        category: row.category,
        quantity: kg,
        totalPrice: lineTotal,
      })
      continue
    }

    items.push({
      id: row.id,
      name: row.name,
      price,
      category: row.category,
      quantity: 1,
      totalPrice: price,
    })
  }

  const basePerPerson = items
    .filter((i) => !i.name.toLowerCase().includes('tiramis'))
    .reduce((s, i) => s + (i.totalPrice ?? i.price), 0)

  return {
    menu_selection: {
      items,
      tiramisu_total: tiramisuTotal,
      tiramisu_kg: tiramisuKg,
    },
    menu_total_per_person: basePerPerson,
  }
}

async function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  const serviceKey = resolveServiceRoleKey()

  const slugFromFile = parseTenantSlugFromProjectRoot()
  const tenantSlug = resolveTenantSlugFromEnv()

  console.log('[seed-full-menu-booking] slug risolto:', JSON.stringify(tenantSlug || '(vuoto)'))
  console.log(
    '[seed-full-menu-booking] SUPABASE_SERVICE_ROLE_KEY:',
    serviceKey ? `presente — origine ${serviceRoleKeyOrigin()}` : `assente — ${serviceRoleKeyOrigin()}`,
  )
  if (slugFromFile) {
    console.log('[seed-full-menu-booking] (tenant da .env.local / .env nel repo, ignora TENANT_SLUG ereditato dalla shell)')
  }

  if (PLACEHOLDER_SLUGS.has(tenantSlug)) {
    console.error(`
[seed-full-menu-booking] Stai usando un placeholder (${tenantSlug}), non lo slug vero dell’organizzazione.
Per Al Ritrovo usa: TENANT_SLUG=al-ritrovo

Se hai già aggiornato .env.local ma vedi ancora il placeholder:
  • In PowerShell potresti avere $env:TENANT_SLUG impostato in sessione → Node NON sovrascrive con il file.
  • Risoluzione: chiudi il terminale, aprine uno nuovo, oppure:
      Remove-Item Env:TENANT_SLUG -ErrorAction SilentlyContinue
    poi rilanci npm run seed:booking-menu-full
`)
    process.exit(1)
  }

  if (!supabaseUrl || !anonKey) {
    console.error('Mancano VITE_SUPABASE_URL e/o VITE_SUPABASE_ANON_KEY (o equivalenti SUPABASE_*).')
    process.exit(1)
  }
  if (!tenantSlug) {
    console.error(`
[seed-full-menu-booking] Manca lo slug dell’organizzazione.

Aggiungi in .env.local (stesso folder del progetto) una di queste righe:
  TENANT_SLUG=il-tuo-slug

Il valore è il campo slug in Supabase → Table Editor → organizations,
(o la parte dopo /prenota/ nell’URL pubblico di prenotazione).

Esempio solo per questa shell (PowerShell):
  $env:TENANT_SLUG="nome-slug"; npm run seed:booking-menu-full
`)
    process.exit(1)
  }

  /** Client per SELECT: la service role vede sempre `menu_items` (anon può essere bloccato da RLS sul DB remoto). */
  const supabaseDb =
    serviceKey != null && String(serviceKey).trim() !== ''
      ? createClient(supabaseUrl, serviceKey)
      : createClient(supabaseUrl, anonKey)

  if (serviceKey != null && String(serviceKey).trim() !== '') {
    console.log(
      '[seed-full-menu-booking] Lettura organizations + menu_items con SUPABASE_SERVICE_ROLE_KEY (aggira RLS).',
    )
  }

  const { org, orgErr } = await fetchOrgBySlug(supabaseDb, tenantSlug)

  if (orgErr || !org) {
    console.error('Organizzazione non trovata per slug:', tenantSlug, orgErr?.message || '')
    process.exit(1)
  }

  const { menuRows: allMenuRows, menuErr } = await fetchMenuItemsForTenant(
    supabaseDb,
    org.id,
  )

  if (menuErr) {
    console.error('Errore lettura menu_items:', menuErr.message)
    process.exit(1)
  }

  if (!allMenuRows.length) {
    let diagnostica = ''
    if (serviceKey) {
      const { count: totalAll } = await supabaseDb
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
      const { count: forOrg } = await supabaseDb
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', org.id)
      diagnostica = `
Diagnostica (service role):
  organization.id = ${org.id}
  menu_items in tutta la tabella: ${totalAll ?? 'n/d'}
  menu_items con questo tenant_id: ${forOrg ?? 'n/d'}
`
      if ((totalAll ?? 0) > 0 && (forOrg ?? 0) === 0) {
        const { data: idRows } = await supabaseDb.from('menu_items').select('tenant_id')
        const distinctTenantIds = [...new Set((idRows ?? []).map((r) => r.tenant_id).filter(Boolean))]
        const inList = distinctTenantIds.map((id) => `'${id}'`).join(', ')
        diagnostica += `
I prodotti ci sono ma il campo menu_items.tenant_id non corrisponde a organization.id sopra (spesso dati creati con un altro tenant o copiati a mano).

tenant_id attualmente presenti in menu_items:
  ${distinctTenantIds.length ? distinctTenantIds.map((id) => `- ${id}`).join('\n  ') : '(nessuno — controlla dati corrotti)'}

${
          distinctTenantIds.length
            ? `Se tutte le righe devono essere del locale «${tenantSlug}», incolla in SQL Editor (Supabase → SQL) e avvia UNA volta:

  update public.menu_items
  set tenant_id = '${org.id}'
  where tenant_id in (${inList});

Poi rilancia questo script.`
            : 'Apri Table Editor su menu_items e imposta tenant_id uguale all’organization.id sopra (non è stato possibile suggerire uno UPDATE automatico).'
        }

In alternativa modifica a mano tenant_id per ogni riga in Table Editor.
`
      }
    } else {
      diagnostica = `
Service role non caricata. Nel file .env.local (root del repo) usa il nome esatto:
  SUPABASE_SERVICE_ROLE_KEY=<Dashboard → Settings → API → service_role>
(non usare il prefisso VITE_ per questa chiave).

Se l’hai già messa: salva il file, rilancia da quella stessa cartella; su Windows evita spazi attorno a «=» nella riga.
`
    }

    console.error(`
Nessuna riga in menu_items per tenant_id dell’organizzazione «${tenantSlug}».
${diagnostica}
• Se l’admin è vuoto: crea le voci menù dall’admin.

• Se vedi prodotti in admin ma conteggio 0 qui: solitamente slug/tenant_id non coincidono con le righe in menu_items.
`)
    process.exit(1)
  }

  const sampledRows = pickRandomMenuRows(allMenuRows)
  console.log(
    `[seed-full-menu-booking] estratte ${sampledRows.length} voci su ${allMenuRows.length} disponibili (RANDOM_MENU_MIN/MAX).`,
  )

  const numGuests = Math.max(1, parseInt(process.env.NUM_GUESTS || '12', 10))
  const desiredTime = normalizeTime(process.env.DESIRED_TIME || '20:00')
  const clientName = resolveSeedClientName()
  const clientEmail = (process.env.CLIENT_EMAIL || 'script-menu-test@example.invalid').trim()
  const clientPhone = process.env.CLIENT_PHONE || '3400000000'

  const { menu_selection, menu_total_per_person } = buildMenuSelection(sampledRows)
  const menu_total_booking =
    menu_total_per_person * numGuests + (menu_selection.tiramisu_total || 0)

  const menuDescription = sampledRows
    .map((r) => r.name)
    .slice(0, 25)
    .join(', ')
    .concat(sampledRows.length > 25 ? ` … (+${sampledRows.length - 25} voci)` : '')

  const basePayload = {
    client_name: clientName,
    client_email: clientEmail,
    client_phone: clientPhone,
    desired_date: FIXED_BOOKING_DATE,
    desired_time: desiredTime,
    num_guests: numGuests,
    special_requests: `Generato da scripts/seed-full-menu-booking.mjs — ${sampledRows.length} voci estratte casualmente.`,
    booking_type: 'rinfresco_laurea',
    event_type: 'laurea',
    menu: menuDescription,
    menu_selection,
    menu_total_per_person,
    menu_total_booking,
    preset_menu: null,
    dietary_restrictions: [],
    placement: 'Script QA',
  }

  if (serviceKey) {
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const insertData = {
      tenant_id: org.id,
      ...basePayload,
      booking_source: 'public',
      status: 'pending',
    }

    const { data: row, error: insErr } = await supabaseAdmin
      .from('booking_requests')
      .insert(insertData)
      .select('id,status,desired_date,menu_total_per_person,menu_total_booking')
      .single()

    if (insErr) {
      console.error('Insert fallita:', insErr.message)
      process.exit(1)
    }

    console.log('OK — prenotazione PENDING (service role, come create-booking):', JSON.stringify(row, null, 2))
    console.log(`
Richiesta in sospeso: approvala dall’admin per vederla nel calendario con orari confermati.
`)
    return
  }

  const anonForFn = anonKey
  const res = await fetch(`${supabaseUrl}/functions/v1/create-booking`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonForFn}`,
      apikey: anonForFn,
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
Richiesta PENDING: compare in «Richieste in sospeso» finché non la accetti con orari confermati.
`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
