/**
 * Funzioni condivise tra gli script di seed prenotazioni (Node ESM).
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

export const FIXED_BOOKING_DATE = process.env.FIXED_BOOKING_DATE || '2026-05-08'

export const PLACEHOLDER_SLUGS = new Set([
  'nome-del-tuo-slug',
  'il-tuo-slug',
  'your-slug',
  'YOUR_SLUG_HERE',
])

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Stesso ordine di playwright.config.ts: E2E/QA prima, poi slug dev. */
const ENV_FILES = ['.env.local.test', '.env.local', '.env']

const TENANT_SLUG_ENV_KEYS = [
  'E2E_TENANT_SLUG',
  'E2E_PUBLIC_BOOKING_SLUG',
  'MANUAL_TENANT_SLUG',
  'TENANT_SLUG',
  'VITE_TENANT_SLUG',
]

/** Slug predefinito allineato a TESTING_SKILL (smoke pubblici / account tomas@t.com). */
export const DEFAULT_SEED_TENANT_SLUG = 'da-tommaso'

function unquoteEnvValue(raw) {
  let v = raw.trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  return v.trim()
}

export function parseTenantSlugFromProjectRoot() {
  for (const name of ENV_FILES) {
    const p = join(PROJECT_ROOT, name)
    if (!existsSync(p)) continue
    let text = readFileSync(p, 'utf8')
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    for (let line of text.split(/\r?\n/)) {
      line = line.trim()
      if (!line || line.startsWith('#')) continue
      for (const key of TENANT_SLUG_ENV_KEYS) {
        const m = new RegExp(`^(?:export\\s+)?${key}\\s*=\\s*(.*)$`).exec(line)
        if (!m) continue
        const slug = unquoteEnvValue(m[1])
        if (slug) return slug
      }
    }
  }
  return null
}

/**
 * Legge una variabile da .env.local / .env nel repo (tutto dopo il primo "=" sulla riga).
 * Serve per JWT/lunghi secret che `node --env-file` a volte non carica bene su Windows se il nome o il file sono diversi dal comando.
 */
export function parseEnvVarFromProjectRoot(varName) {
  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const lineRe = new RegExp(`^(?:export\\s+)?${escaped}\\s*=\\s*(.*)$`)

  for (const name of ENV_FILES) {
    const p = join(PROJECT_ROOT, name)
    if (!existsSync(p)) continue
    let text = readFileSync(p, 'utf8')
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
    for (let line of text.split(/\r?\n/)) {
      line = line.trim()
      if (!line || line.startsWith('#')) continue
      const m = lineRe.exec(line)
      if (!m) continue
      const out = unquoteEnvValue(m[1])
      if (out) return out
    }
  }
  return null
}

/** Service role: alias Playwright E2E_SUPABASE_SERVICE_KEY, poi SUPABASE_SERVICE_ROLE_KEY. */
export function resolveServiceRoleKey() {
  for (const key of ['E2E_SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const fromShell = (process.env[key] || '').trim()
    if (fromShell) return fromShell
    const fromFile = parseEnvVarFromProjectRoot(key)
    if ((fromFile || '').trim()) return fromFile.trim()
  }
  return ''
}

export function serviceRoleKeyOrigin() {
  for (const key of ['E2E_SUPABASE_SERVICE_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if ((process.env[key] || '').trim()) return `process.env ${key} (--env-file o shell)`
    if (parseEnvVarFromProjectRoot(key)) return `file ${key} (.env.local.test / .env.local)`
  }
  return 'assente'
}

export function resolveTenantSlugFromEnv() {
  for (const key of TENANT_SLUG_ENV_KEYS) {
    const fromShell = (process.env[key] || '').trim()
    if (fromShell) return fromShell
  }
  const slugFromFile = parseTenantSlugFromProjectRoot()
  if (slugFromFile) return slugFromFile
  return DEFAULT_SEED_TENANT_SLUG
}

export function createBookingDateTime(dateStr, timeStr, isStart = true, startTime) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hours, minutes] = timeStr.split(':').map(Number)
  let finalYear = year
  let finalMonth = month
  let finalDay = day
  let finalHours = hours
  let finalMinutes = minutes
  if (!isStart && startTime) {
    const [startHours] = startTime.split(':').map(Number)
    if (hours < startHours || (hours === startHours && startHours >= 22)) {
      const d = new Date(year, month - 1, day)
      d.setDate(d.getDate() + 1)
      finalYear = d.getFullYear()
      finalMonth = d.getMonth() + 1
      finalDay = d.getDate()
    }
  }
  return `${String(finalYear).padStart(4, '0')}-${String(finalMonth).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}T${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}:00+00:00`
}

export function calculateEndTimeFromStart(startTime, hoursToAdd = 3) {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + hoursToAdd * 60
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const endH = Math.floor(wrapped / 60)
  const endM = wrapped % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

export function normalizeTime(t) {
  if (!t) return '20:00'
  return t.split(':').slice(0, 2).join(':')
}

/** Nomi da persona per prenotazioni create dagli script di seed (QA). */
const SEED_QA_PERSON_NAMES = [
  'Giulia Romano',
  'Marco Ferraro',
  'Chiara Conti',
  'Luca Moretti',
  'Francesca Gallo',
  'Andrea Ricci',
  'Sara Lombardi',
  'Matteo Costa',
  'Elisa Fontana',
  'Davide Marchetti',
  'Valentina Serra',
  'Simone Caruso',
  'Martina De Luca',
  'Federico Greco',
  'Elena Rizzo',
  'Alessandro Bruno',
  'Giorgia Vitale',
  'Tommaso Leone',
  'Beatrice Fabbri',
  'Niccolò Pellegrini',
]

/**
 * `client_name` per gli insert seed: se `CLIENT_NAME` è valorizzato in env si usa quello,
 * altrimenti un nome tra persona scelto casualmente dall’elenco.
 */
export function resolveSeedClientName() {
  const fromEnv = (process.env.CLIENT_NAME || '').trim()
  if (fromEnv) return fromEnv
  const i = Math.floor(Math.random() * SEED_QA_PERSON_NAMES.length)
  return SEED_QA_PERSON_NAMES[i]
}

export async function fetchOrgBySlug(supabaseAnon, tenantSlug) {
  const { data: org, error: orgErr } = await supabaseAnon
    .from('organizations')
    .select('id, name')
    .eq('slug', tenantSlug)
    .maybeSingle()
  return { org, orgErr }
}

export async function fetchMenuItemsForTenant(supabaseAnon, tenantId) {
  const { data: menuRows, error: menuErr } = await supabaseAnon
    .from('menu_items')
    .select('id,name,price,category,sort_order')
    .eq('tenant_id', tenantId)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  return { menuRows: menuRows ?? [], menuErr }
}
