/**
 * DEV FLOW PANEL — pannello in pagina che mostra il FLUSSO DATI che scorre
 * (letture/scritture DB, errori tradotti in linguaggio umano) + una riga di salute in testa.
 *
 * SOLO in sviluppo: il componente si auto-disattiva se `import.meta.env.DEV` è falso
 * (ritorna null), quindi in produzione non esiste nel DOM e non pesa.
 *
 * Vive in basso a destra. Richiudibile: chiuso = una pallina colorata (verde/giallo/rosso)
 * che dice lo stato a colpo d'occhio senza occupare spazio; aperto = lista del flusso.
 * NON intasa la console F12 (lì ci va solo la fotografia di salute, vedi devConsole.ts).
 */

import { useEffect, useRef, useState } from 'react'
import {
  subscribeDevFlow,
  clearDevFlow,
  getDevHealth,
  isDevConsoleEnabled,
  type DevFlowEvent,
  type DevFlowLevel,
} from '@/lib/devConsole'

const LEVEL_DOT: Record<DevFlowLevel, string> = {
  ok: '#2f7d32',
  info: '#5b7fb4',
  warn: '#c98a00',
  error: '#c0392b',
}

const LEVEL_ICON: Record<DevFlowLevel, string> = {
  ok: '✓',
  info: '→',
  warn: '⚠',
  error: '✗',
}

function worstOf(events: DevFlowEvent[], withinMs = 30_000): DevFlowLevel {
  const cutoff = Date.now() - withinMs
  const rank: Record<DevFlowLevel, number> = { ok: 0, info: 1, warn: 2, error: 3 }
  let worst: DevFlowLevel = 'ok'
  for (const e of events) {
    if (e.at < cutoff) continue
    if (rank[e.level] > rank[worst]) worst = e.level
  }
  return worst
}

function formatTime(at: number): string {
  const d = new Date(at)
  return d.toLocaleTimeString('it-IT', { hour12: false })
}

export function DevFlowPanel() {
  // Hook chiamati sempre (regole React); il gate dev è sul return finale.
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<DevFlowEvent[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDevConsoleEnabled) return
    return subscribeDevFlow((next) => setEvents([...next]))
  }, [])

  // Auto-scroll all'ultimo evento quando il pannello è aperto.
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [events, open])

  if (!isDevConsoleEnabled) return null

  const worst = worstOf(events)
  const health = getDevHealth()
  const errorCount = events.filter((e) => e.level === 'error').length

  // ── Pannello CHIUSO: solo la pallina-stato ──────────────────────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Apri il flusso dati (dev)"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 999,
          border: '1px solid rgba(0,0,0,0.15)',
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
          cursor: 'pointer',
          font: '12px/1.2 ui-monospace, monospace',
          color: '#333',
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: LEVEL_DOT[worst],
            boxShadow: worst === 'error' ? `0 0 6px ${LEVEL_DOT.error}` : 'none',
          }}
        />
        flusso{errorCount > 0 ? ` · ${errorCount}✗` : ''}
      </button>
    )
  }

  // ── Pannello APERTO: salute in testa + lista flusso ─────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 99999,
        width: 380,
        maxHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        border: '1px solid rgba(0,0,0,0.18)',
        background: 'rgba(255,255,255,0.98)',
        boxShadow: '0 10px 34px rgba(0,0,0,0.25)',
        font: '12px/1.45 ui-monospace, monospace',
        color: '#222',
        overflow: 'hidden',
      }}
    >
      {/* Header: salute a colpo d'occhio + comandi */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          background: '#1b3a1c',
          color: '#c8e6c9',
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 999, background: LEVEL_DOT[worst] }} />
        <strong style={{ flex: 1, color: '#fff', fontSize: 12 }}>
          {health.tenant ?? '(nessun ristorante)'}
          {health.isAdmin === true ? ' · admin' : health.isAdmin === false ? ' · non-admin' : ''}
          {health.edition ? ` · ${health.edition}` : ''}
        </strong>
        <button
          type="button"
          onClick={() => clearDevFlow()}
          title="Pulisci flusso"
          style={devBtnStyle}
        >
          pulisci
        </button>
        <button type="button" onClick={() => setOpen(false)} title="Riduci" style={devBtnStyle}>
          –
        </button>
      </div>

      {/* Conteggi salute (se presenti) */}
      {health.counts && Object.keys(health.counts).length > 0 && (
        <div style={{ padding: '4px 10px', background: '#eef4ee', color: '#33503a', fontSize: 11 }}>
          {Object.entries(health.counts)
            .map(([k, v]) => `${v} ${k}`)
            .join('  ·  ')}
        </div>
      )}

      {/* Lista flusso */}
      <div ref={listRef} style={{ overflowY: 'auto', padding: '6px 8px' }}>
        {events.length === 0 ? (
          <div style={{ color: '#999', padding: '10px 4px' }}>
            Nessun evento ancora. Naviga nell'app: le letture/scritture al database compaiono qui.
          </div>
        ) : (
          events.map((e) => (
            <div
              key={e.id}
              onClick={() => e.detail && setExpandedId(expandedId === e.id ? null : e.id)}
              style={{
                display: 'flex',
                gap: 6,
                padding: '3px 2px',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
                cursor: e.detail ? 'pointer' : 'default',
                alignItems: 'baseline',
              }}
            >
              <span style={{ color: '#aaa', flexShrink: 0 }}>{formatTime(e.at)}</span>
              <span style={{ color: LEVEL_DOT[e.level], flexShrink: 0 }}>{LEVEL_ICON[e.level]}</span>
              <span style={{ flex: 1, wordBreak: 'break-word', color: e.level === 'error' ? '#a93226' : '#333' }}>
                {e.message}
                {expandedId === e.id && e.detail && (
                  <span style={{ display: 'block', marginTop: 2, color: '#888', fontSize: 11 }}>
                    {e.detail}
                  </span>
                )}
                {e.detail && expandedId !== e.id && (
                  <span style={{ color: '#bbb', marginLeft: 4 }}>·dettaglio</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const devBtnStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.3)',
  background: 'transparent',
  color: '#c8e6c9',
  borderRadius: 4,
  padding: '1px 6px',
  cursor: 'pointer',
  font: '11px ui-monospace, monospace',
}
