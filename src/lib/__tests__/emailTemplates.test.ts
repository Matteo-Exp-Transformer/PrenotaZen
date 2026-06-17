import { describe, expect, it } from 'vitest'
import {
  getBookingAcceptedEmail,
  getBookingRejectedEmail,
  getPromoEmail,
  getCampaignEmail,
  isValidHttpUrl,
  DEFAULT_ACCEPTED_SUBJECT,
  DEFAULT_ACCEPTED_INTRO,
  DEFAULT_ACCEPTED_CLOSING,
  DEFAULT_REJECTED_SUBJECT,
  DEFAULT_REJECTED_INTRO,
  DEFAULT_REJECTED_CLOSING,
  DEFAULT_CAMPAIGN_HEADING,
} from '@/lib/emailTemplates'
import type { BookingRequest } from '@/types/booking'

const FAKE_BOOKING: BookingRequest = {
  id: 'b1',
  tenant_id: 't1',
  client_name: 'Mario Rossi',
  client_email: 'mario@test.com',
  client_phone: '333111000',
  num_guests: 2,
  desired_date: '2026-07-01',
  desired_time: '20:00',
  status: 'accepted',
  notes: null,
  created_at: '2026-07-01T10:00:00Z',
  updated_at: '2026-07-01T10:00:00Z',
  booking_mode: null,
  selected_menu: null,
  confirmed_start: null,
  table_id: null,
  rejected_reason: null,
  archived_at: null,
  confirmed_at: null,
} as unknown as BookingRequest

describe('getBookingAcceptedEmail — default testo cablato', () => {
  it('usa il subject default quando nessun override', () => {
    const { subject } = getBookingAcceptedEmail(FAKE_BOOKING)
    expect(subject).toBe(DEFAULT_ACCEPTED_SUBJECT)
  })

  it('override subject viene usato', () => {
    const { subject } = getBookingAcceptedEmail(FAKE_BOOKING, undefined, undefined, {
      subject: 'Oggetto personalizzato',
    })
    expect(subject).toBe('Oggetto personalizzato')
  })

  it('override intro compare nell HTML', () => {
    const { html } = getBookingAcceptedEmail(FAKE_BOOKING, undefined, undefined, {
      intro: 'Benvenuto nel nostro locale!',
    })
    expect(html).toContain('Benvenuto nel nostro locale!')
    // Il default non deve comparire
    expect(html).not.toContain(DEFAULT_ACCEPTED_INTRO)
  })

  it('mantiene il saluto "Ciao" con il nome cliente', () => {
    const { html } = getBookingAcceptedEmail(FAKE_BOOKING, undefined, undefined, {
      intro: 'Testo custom',
    })
    expect(html).toContain('Mario Rossi')
    expect(html).toContain('Ciao')
  })

  it('subject vuoto nell override → usa il default', () => {
    const { subject } = getBookingAcceptedEmail(FAKE_BOOKING, undefined, undefined, {
      subject: '   ',
    })
    expect(subject).toBe(DEFAULT_ACCEPTED_SUBJECT)
  })
})

describe('getBookingRejectedEmail — default testo cablato', () => {
  it('usa il subject default quando nessun override', () => {
    const { subject } = getBookingRejectedEmail(FAKE_BOOKING)
    expect(subject).toBe(DEFAULT_REJECTED_SUBJECT)
  })

  it('override soggetto + intro vengono usati', () => {
    const { subject, html } = getBookingRejectedEmail(FAKE_BOOKING, undefined, undefined, {
      subject: 'Mi dispiace molto',
      intro: 'Purtroppo non possiamo accoglierti.',
    })
    expect(subject).toBe('Mi dispiace molto')
    expect(html).toContain('Purtroppo non possiamo accoglierti.')
    expect(html).not.toContain(DEFAULT_REJECTED_INTRO)
  })

  it('nessun summaryBlock nel rifiuto (timing=rejected)', () => {
    const { html } = getBookingRejectedEmail(FAKE_BOOKING)
    // summaryBlock non viene generato per rifiuto
    expect(html).not.toContain('PRENOTAZIONE CONFERMATA')
    expect(html).not.toContain('success-badge')
  })
})

describe('getPromoEmail', () => {
  it('include il testo del corpo', () => {
    const { html } = getPromoEmail({
      subject: 'Offerta estate',
      body: 'Sconto 20% questo weekend!',
    })
    expect(html).toContain('Sconto 20% questo weekend!')
  })

  it('include il footer privacy fisso', () => {
    const { html } = getPromoEmail({ subject: 'Promo', body: 'Testo' })
    expect(html).toContain('Hai ricevuto questa email perché sei nostro cliente')
  })

  it('NON contiene riepilogo prenotazione', () => {
    const { html } = getPromoEmail({ subject: 'Promo', body: 'Testo' })
    expect(html).not.toContain('success-badge')
    expect(html).not.toContain('PRENOTAZIONE CONFERMATA')
    // summary-block è specifico del riepilogo booking, non del template promo
    expect(html).not.toContain('summary-block')
  })

  it('include la firma se tenantInfo fornito', () => {
    const { html } = getPromoEmail(
      { subject: 'Promo', body: 'Testo' },
      { name: 'Ristorante Bello', phone: '02-1234567' },
    )
    expect(html).toContain('Ristorante Bello')
    expect(html).toContain('02-1234567')
    expect(html).toContain('Lo staff')
  })

  it('restituisce il subject corretto', () => {
    const { subject } = getPromoEmail({ subject: 'Weekend promo', body: 'Corpo' })
    expect(subject).toBe('Weekend promo')
  })
})

describe('DEFAULT_* costanti esportate', () => {
  it('le costanti default sono stringhe non vuote', () => {
    expect(DEFAULT_ACCEPTED_SUBJECT.length).toBeGreaterThan(0)
    expect(DEFAULT_ACCEPTED_INTRO.length).toBeGreaterThan(0)
    expect(DEFAULT_ACCEPTED_CLOSING.length).toBeGreaterThan(0)
    expect(DEFAULT_REJECTED_SUBJECT.length).toBeGreaterThan(0)
    expect(DEFAULT_REJECTED_INTRO.length).toBeGreaterThan(0)
    expect(DEFAULT_REJECTED_CLOSING.length).toBeGreaterThan(0)
  })
})

describe('isValidHttpUrl', () => {
  it('accetta http e https', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true)
    expect(isValidHttpUrl('http://example.com/path?q=1')).toBe(true)
  })

  it('scarta javascript: e data:', () => {
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isValidHttpUrl('data:text/html,<b>x</b>')).toBe(false)
  })

  it('scarta stringhe non URL', () => {
    expect(isValidHttpUrl('non-un-url')).toBe(false)
    expect(isValidHttpUrl('')).toBe(false)
  })
})

describe('getCampaignEmail', () => {
  it('include il corpo del messaggio nel HTML', () => {
    const { html } = getCampaignEmail({ subject: 'Offerta', body: 'Testo campagna', links: [] })
    expect(html).toContain('Testo campagna')
  })

  it('include il footer privacy fisso', () => {
    const { html } = getCampaignEmail({ subject: 'S', body: 'B', links: [] })
    expect(html).toContain('Hai ricevuto questa email perché sei nostro cliente')
  })

  it('escape HTML nel body (<script> non viene eseguito)', () => {
    const { html } = getCampaignEmail({
      subject: 'S',
      body: '<script>alert("xss")</script>Testo',
      links: [],
    })
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('auto-linkify URL https nel body', () => {
    const { html } = getCampaignEmail({
      subject: 'S',
      body: 'Visita https://example.com per info',
      links: [],
    })
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
  })

  it('auto-linkify URL www nel body', () => {
    const { html } = getCampaignEmail({ subject: 'S', body: 'Vai su www.example.com', links: [] })
    expect(html).toContain('href="https://www.example.com"')
  })

  it('render pulsanti per link validi', () => {
    const { html } = getCampaignEmail({
      subject: 'S',
      body: 'B',
      links: [{ label: 'Visita il sito', url: 'https://example.com' }],
    })
    expect(html).toContain('Visita il sito')
    expect(html).toContain('https://example.com')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('scarta link con URL non http(s)', () => {
    const { html } = getCampaignEmail({
      subject: 'S',
      body: 'B',
      links: [{ label: 'Hack', url: 'javascript:alert(1)' }],
    })
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('Hack')
  })

  it('NON contiene riepilogo prenotazione', () => {
    const { html } = getCampaignEmail({ subject: 'S', body: 'B', links: [] })
    expect(html).not.toContain('success-badge')
    expect(html).not.toContain('PRENOTAZIONE CONFERMATA')
    expect(html).not.toContain('summary-block')
  })

  it('restituisce il subject corretto', () => {
    const { subject } = getCampaignEmail({ subject: 'Promo estate', body: 'B', links: [] })
    expect(subject).toBe('Promo estate')
  })

  it('include la firma se tenantInfo fornito', () => {
    const { html } = getCampaignEmail(
      { subject: 'S', body: 'B', links: [] },
      { name: 'Ristorante Da Mario', phone: '02-0000000' },
    )
    expect(html).toContain('Ristorante Da Mario')
    expect(html).toContain('Lo staff')
  })

  it('usa heading quando fornito', () => {
    const { html } = getCampaignEmail({ subject: 'S', body: 'B', links: [], heading: 'Offerta speciale' })
    expect(html).toContain('Offerta speciale')
    expect(html).not.toContain(DEFAULT_CAMPAIGN_HEADING)
  })

  it('fallback a DEFAULT_CAMPAIGN_HEADING quando heading assente', () => {
    const { html } = getCampaignEmail({ subject: 'S', body: 'B', links: [] })
    expect(html).toContain(DEFAULT_CAMPAIGN_HEADING)
  })

  it('fallback a DEFAULT_CAMPAIGN_HEADING quando heading è stringa vuota', () => {
    const { html } = getCampaignEmail({ subject: 'S', body: 'B', links: [], heading: '   ' })
    expect(html).toContain(DEFAULT_CAMPAIGN_HEADING)
  })

  it('escape del heading (<script> non viene eseguito)', () => {
    const { html } = getCampaignEmail({
      subject: 'S',
      body: 'B',
      links: [],
      heading: '<script>alert("xss")</script>Titolo',
    })
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})
