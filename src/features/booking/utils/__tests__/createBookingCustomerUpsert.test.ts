import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Testa la logica di upsert customers introdotta in create-booking (fix B01).
 *
 * La Edge Function gira in Deno e non è importabile direttamente in Vitest.
 * Questi test replicano la stessa logica con un client Supabase mockato,
 * verificando i contratti che la Edge Function deve rispettare:
 *   1. nuova email → INSERT in customers con source='synced'
 *   2. email già presente → UPDATE updated_at, nessun INSERT duplicato
 *   3. email vuota → nessuna operazione su customers
 */

// ---- Implementazione della logica da testare (speculare a create-booking) ----

type MockClient = {
  from: ReturnType<typeof vi.fn>
}

async function upsertCustomer(
  supabaseAdmin: MockClient,
  orgId: string,
  clientName: string,
  clientEmail: string,
  clientPhone: string | null
) {
  const normalizedEmail = clientEmail.toLowerCase().trim()
  if (!normalizedEmail) return

  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('tenant_id', orgId)
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin
      .from('customers')
      .update({ updated_at: expect.any(String) })
      .eq('id', existing.id)
  } else {
    await supabaseAdmin.from('customers').insert({
      tenant_id: orgId,
      name: clientName,
      email: normalizedEmail,
      phone: clientPhone,
      source: 'synced',
    })
  }
}

// ---- Helper ----

function buildSelectChain(result: { data: unknown; error: null }) {
  const chain: Record<string, unknown> = {}
  chain['select'] = vi.fn(() => chain)
  chain['eq'] = vi.fn(() => chain)
  chain['maybeSingle'] = vi.fn().mockResolvedValue(result)
  return chain
}

function buildMutationChain() {
  const chain: Record<string, unknown> = {}
  chain['insert'] = vi.fn().mockResolvedValue({ data: {}, error: null })
  chain['update'] = vi.fn(() => chain)
  chain['eq'] = vi.fn(() => chain)
  return chain
}

// ---- Test suite ----

describe('create-booking: upsert customers (B01)', () => {
  const ORG_ID = 'org-uuid-123'
  let fromMock: ReturnType<typeof vi.fn>
  let selectChain: ReturnType<typeof buildSelectChain>
  let mutationChain: ReturnType<typeof buildMutationChain>

  beforeEach(() => {
    selectChain = buildSelectChain({ data: null, error: null })
    mutationChain = buildMutationChain()
    fromMock = vi.fn((table: string) => {
      if (table === 'customers') return { ...selectChain, ...mutationChain }
      return {}
    })
  })

  it('crea un nuovo cliente quando email non esiste', async () => {
    await upsertCustomer(
      { from: fromMock },
      ORG_ID,
      'Mario Rossi',
      'mario@example.com',
      null
    )

    expect(mutationChain.insert).toHaveBeenCalledWith({
      tenant_id: ORG_ID,
      name: 'Mario Rossi',
      email: 'mario@example.com',
      phone: null,
      source: 'synced',
    })
  })

  it('normalizza email (trim + lowercase) prima di cercare o inserire', async () => {
    await upsertCustomer(
      { from: fromMock },
      ORG_ID,
      'Mario Rossi',
      '  MARIO@EXAMPLE.COM  ',
      null
    )

    const insertCall = (mutationChain.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertCall.email).toBe('mario@example.com')
  })

  it('non crea duplicato se il cliente esiste già — aggiorna solo updated_at', async () => {
    selectChain = buildSelectChain({ data: { id: 'customer-uuid-999' }, error: null })
    fromMock = vi.fn((table: string) => {
      if (table === 'customers') return { ...selectChain, ...mutationChain }
      return {}
    })

    await upsertCustomer(
      { from: fromMock },
      ORG_ID,
      'Mario Rossi',
      'mario@example.com',
      null
    )

    expect(mutationChain.insert).not.toHaveBeenCalled()
    expect(mutationChain.update).toHaveBeenCalled()
    const eqCall = (mutationChain.eq as ReturnType<typeof vi.fn>).mock.calls
    expect(eqCall.some((c: unknown[]) => c[0] === 'id' && c[1] === 'customer-uuid-999')).toBe(true)
  })

  it('non tocca customers se email è vuota', async () => {
    await upsertCustomer({ from: fromMock }, ORG_ID, 'Mario Rossi', '', null)

    expect(fromMock).not.toHaveBeenCalled()
  })
})
