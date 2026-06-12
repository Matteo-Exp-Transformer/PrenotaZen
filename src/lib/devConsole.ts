/**
 * DEV CONSOLE — strumento di sviluppo per leggere a colpo d'occhio lo stato di salute
 * e il flusso dati dell'app. SOLO in sviluppo (`import.meta.env.DEV`): in produzione
 * tutto è inerte (le funzioni non fanno nulla, nessun peso per i clienti).
 *
 * Filosofia (allineata a COMUNICAZIONE_UTENTE_SKILL.md): parlare SEMPLICE, dire
 * cosa-succede-a-chi, tradurre gli errori tecnici in frasi umane. Niente gergo crudo
 * (`PGRST301`) verso chi guarda: «permesso negato — controlla il tenant».
 *
 * Due canali, due ritmi diversi (per non intasare la console):
 *  - SALUTE (fotografia): stampata in console F12 ai momenti chiave. Si legge una volta.
 *  - FLUSSO (film): stream di eventi che scorre nel pannello in pagina (DevFlowPanel),
 *    NON in console, così non la affoga.
 *
 * Questo file è il "cervello": raccoglie gli eventi, traduce gli errori, e notifica
 * il pannello. Console e pannello sono solo le due "facce" che leggono da qui.
 */

/**
 * La dev console è attiva quando:
 *  - siamo in sviluppo locale (`import.meta.env.DEV`), OPPURE
 *  - l'app gira su un deploy collegato al DB di TEST (`docnnernvp`), così il pannello flusso
 *    è visibile anche da telefono sul branch env/test pushato su Vercel.
 * In PRODUZIONE (DB `rwuxgvld`) resta sempre disattivata: i clienti non vedono nulla.
 * Decisione Matteo 02-06-26: «attivo anche online ma solo su env/test».
 */
const isTestDeploy = (import.meta.env.VITE_SUPABASE_URL ?? '').includes('docnnernvp')
const isDev = import.meta.env.DEV || isTestDeploy

// ───────────────────────────────────────────────────────────────────────────
// Tipi
// ───────────────────────────────────────────────────────────────────────────

/** Esito di un evento di flusso: come si traduce nella pallina-stato del pannello. */
export type DevFlowLevel = 'ok' | 'info' | 'warn' | 'error'

/** Un evento del flusso dati (una riga nel pannello). */
export interface DevFlowEvent {
  id: number
  at: number // timestamp ms
  level: DevFlowLevel
  /** Frase breve e umana: «prenotazioni 5 giu · 8 trovate». */
  message: string
  /** Dettaglio opzionale, mostrato on-demand nel pannello (es. il nome tecnico della query). */
  detail?: string
}

/** Snapshot di salute (la "fotografia" stampata in console). */
export interface DevHealthSnapshot {
  /** Nome del ristorante/tenant corrente, se noto. */
  tenant?: string | null
  /** L'utente è autenticato come admin? `undefined` = non ancora noto. */
  isAdmin?: boolean
  /** edition del tenant (Classic/Pro/Enterprise), se nota. */
  edition?: string | null
  /** Conteggi utili a colpo d'occhio (es. { prenotazioni: 12, 'menu cat': 8 }). */
  counts?: Record<string, number>
  /** Note libere brevi (es. «PWA attiva»). */
  notes?: string[]
}

type FlowListener = (events: DevFlowEvent[]) => void

// ───────────────────────────────────────────────────────────────────────────
// Stato interno (solo dev)
// ───────────────────────────────────────────────────────────────────────────

const MAX_EVENTS = 200 // teniamo solo gli ultimi N: il pannello è una finestra scorrevole
const flowEvents: DevFlowEvent[] = []
const listeners = new Set<FlowListener>()
let seq = 0
const health: DevHealthSnapshot = {}

function notify() {
  for (const l of listeners) l(flowEvents)
}

// ───────────────────────────────────────────────────────────────────────────
// Traduzione errori → linguaggio semplice
// ───────────────────────────────────────────────────────────────────────────

/**
 * Trasforma un errore tecnico (Supabase/Postgrest/rete) in una frase che si capisce.
 * Allineato allo skill comunicazione: niente codici crudi verso chi legge, ma la causa
 * probabile in parole concrete. Il codice tecnico resta in `detail` per chi vuole scavare.
 */
export function humanizeError(error: unknown): { message: string; detail?: string } {
  if (error == null) return { message: 'errore sconosciuto' }

  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : (() => {
            try {
              return JSON.stringify(error)
            } catch {
              return String(error)
            }
          })()

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : ''

  const lower = `${code} ${raw}`.toLowerCase()

  // Mappa causa-probabile in linguaggio umano. L'ordine conta: dal più specifico.
  if (lower.includes('rls') || lower.includes('row-level') || lower.includes('policy') || code === '42501' || code === 'pgrst301') {
    return { message: 'permesso negato (RLS) — probabile problema di tenant o sessione admin', detail: raw }
  }
  if (lower.includes('jwt') || lower.includes('token') || lower.includes('401') || lower.includes('not authenticated')) {
    return { message: 'sessione scaduta o non valida — rifare il login', detail: raw }
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('econnrefused')) {
    return { message: 'connessione al database non riuscita — rete o Supabase irraggiungibile', detail: raw }
  }
  if (code === 'pgrst116' || lower.includes('no rows') || lower.includes('not found') || lower.includes('404')) {
    return { message: 'dato non trovato — la riga cercata non esiste (o filtro tenant troppo stretto)', detail: raw }
  }
  if (lower.includes('duplicate') || code === '23505') {
    return { message: 'valore duplicato — esiste già un record con questa chiave', detail: raw }
  }
  if (lower.includes('violates') && lower.includes('foreign key')) {
    return { message: 'collegamento mancante — un dato riferito non esiste (foreign key)', detail: raw }
  }
  if (lower.includes('timeout')) {
    return { message: 'il database ci ha messo troppo a rispondere (timeout)', detail: raw }
  }

  // Default: niente match → mostra il messaggio grezzo ma marcalo come non tradotto.
  return { message: raw, detail: code ? `code: ${code}` : undefined }
}

// ───────────────────────────────────────────────────────────────────────────
// API FLUSSO (il "film" che scorre nel pannello)
// ───────────────────────────────────────────────────────────────────────────

/** Aggiunge un evento al flusso. No-op in produzione. */
export function devFlow(level: DevFlowLevel, message: string, detail?: string): void {
  if (!isDev) return
  const event: DevFlowEvent = { id: ++seq, at: Date.now(), level, message, detail }
  flowEvents.push(event)
  if (flowEvents.length > MAX_EVENTS) flowEvents.shift()
  notify()
}

/** Registra un errore nel flusso, già tradotto in linguaggio umano. No-op in produzione. */
export function devFlowError(context: string, error: unknown): void {
  if (!isDev) return
  const { message, detail } = humanizeError(error)
  devFlow('error', `${context} · ${message}`, detail)
}

/** Si iscrive agli aggiornamenti del flusso (lo usa il pannello). Ritorna la funzione di pulizia. */
export function subscribeDevFlow(listener: FlowListener): () => void {
  if (!isDev) return () => {}
  listeners.add(listener)
  listener(flowEvents) // primo invio: stato corrente
  return () => listeners.delete(listener)
}

/** Svuota il flusso (pulsante "pulisci" nel pannello). */
export function clearDevFlow(): void {
  if (!isDev) return
  flowEvents.length = 0
  notify()
}

/** Lo stato peggiore tra gli ultimi eventi → colore della pallina del pannello chiuso. */
export function devFlowWorstLevel(withinMs = 30_000): DevFlowLevel {
  if (!isDev || flowEvents.length === 0) return 'ok'
  const cutoff = Date.now() - withinMs
  let worst: DevFlowLevel = 'ok'
  const rank: Record<DevFlowLevel, number> = { ok: 0, info: 1, warn: 2, error: 3 }
  for (const e of flowEvents) {
    if (e.at < cutoff) continue
    if (rank[e.level] > rank[worst]) worst = e.level
  }
  return worst
}

// ───────────────────────────────────────────────────────────────────────────
// API SALUTE (la "fotografia" in console F12)
// ───────────────────────────────────────────────────────────────────────────

let healthReprintTimer: ReturnType<typeof setTimeout> | null = null

/** Aggiorna uno o più campi della fotografia di salute (merge). No-op in produzione. */
export function setDevHealth(patch: Partial<DevHealthSnapshot>): void {
  if (!isDev) return
  if (patch.counts) health.counts = { ...health.counts, ...patch.counts }
  if (patch.notes) health.notes = patch.notes
  if ('tenant' in patch) health.tenant = patch.tenant
  if ('isAdmin' in patch) health.isAdmin = patch.isAdmin
  if ('edition' in patch) health.edition = patch.edition

  // I conteggi arrivano dalle query, sfasati rispetto alla prima stampa (tenant risolto prima).
  // Schedula UNA ristampa debounced: così la salute completa (con i conteggi) appare una volta,
  // non a ogni singola query. La firma in printDevHealth evita comunque doppioni identici.
  if (patch.counts) {
    if (healthReprintTimer) clearTimeout(healthReprintTimer)
    healthReprintTimer = setTimeout(() => printDevHealth('STATO APP'), 800)
  }
}

// Firma dell'ultima salute stampata: evita di ristampare lo STESSO riquadro a ogni
// re-render / refetch (era la causa del log ripetuto 4-5 volte — fix Matteo 02-06-26).
let lastHealthSignature = ''

/**
 * Stampa la fotografia di salute in console: UN log unico (riga titolo) + i dati utili
 * raggruppati sotto. Stampa solo se lo stato è CAMBIATO rispetto all'ultima volta.
 * No-op in produzione.
 */
export function printDevHealth(title = 'STATO APP'): void {
  if (!isDev) return

  const ok = (v: boolean | undefined) => (v === undefined ? '…' : v ? '✓' : '✗')
  const headline = `🏥 ${health.tenant ?? '(nessun ristorante)'} · ${ok(health.isAdmin)} admin${
    health.edition ? ` · ${health.edition}` : ''
  }`
  const countsLine = health.counts
    ? Object.entries(health.counts)
        .map(([k, v]) => `${v} ${k}`)
        .join('  ·  ')
    : ''

  // Firma = tutto ciò che renderebbe utile una nuova stampa. Se identica → non ristampare.
  const signature = `${headline}|${countsLine}|${(health.notes ?? []).join('·')}`
  if (signature === lastHealthSignature) return
  lastHealthSignature = signature

  // Un solo gruppo: titolo in cima, dati sotto. `groupCollapsed` = compatto, espandibile a click.
  console.groupCollapsed(
    `%c ${title} %c ${headline} `,
    'background:#2f7d32;color:#fff;border-radius:3px 0 0 3px;padding:2px 6px;font-weight:bold',
    'background:#1b3a1c;color:#c8e6c9;border-radius:0 3px 3px 0;padding:2px 8px',
  )
  if (countsLine) console.log('%c' + countsLine, 'color:#33503a;font-weight:bold')
  if (health.notes?.length) console.log('%c' + health.notes.join(' · '), 'color:#8a8a8a')
  console.groupEnd()
}

/** Snapshot corrente (per il pannello che mostra anche la salute in testa). */
export function getDevHealth(): DevHealthSnapshot {
  return { ...health, counts: { ...health.counts } }
}

export const isDevConsoleEnabled = isDev
