// @admin-blindatura: menu-magazzino-sync
// M3 Fase 3 — rename/delete categoria: sync QR + form Prenota + override; controtest parziale.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BOOKING_FORM_CONFIG } from '@/features/booking/constants/bookingPublicFormConfig'
import {
  filterMenuCategoriesForPublic,
  filterMenuItemsForPublic,
} from '@/features/booking/constants/menuMagazzinoLimits'

const TENANT = 'tenant-sync-1'

const { mockFrom, mockTryCopyPhoto, mockRemovePhoto } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockTryCopyPhoto: vi.fn().mockResolvedValue(undefined),
  mockRemovePhoto: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    storage: {
      from: () => ({
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
      }),
    },
  },
  handleSupabaseError: (e: unknown) => {
    if (e && typeof e === 'object' && 'message' in e) return (e as { message: string }).message
    return 'Errore Supabase'
  },
}))

vi.mock('@/features/booking/utils/menuQrStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/booking/utils/menuQrStorage')>()
  return {
    ...actual,
    tryCopyQrCategoryPhotoOnRename: mockTryCopyPhoto,
  }
})

vi.mock('@/features/booking/hooks/useCarouselPhotoUpload', () => ({
  removeMenuPhotoPath: mockRemovePhoto,
}))

import {
  syncMenuCategoryKeyDelete,
  CATEGORY_KEY_DELETE_INFO_MESSAGE,
} from '../syncMenuCategoryKeyDelete'
import {
  syncMenuCategoryKeyRename,
  CATEGORY_KEY_RENAME_INFO_MESSAGE,
} from '../syncMenuCategoryKeyRename'

type QrRow = {
  id: string
  tenant_id: string
  short_code: string
  name: string
  category_filter: string[] | null
  category_images: Record<string, string>
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  theme_key: string
  carousel_items: unknown[]
  hidden_menu_item_ids: string[]
}

type QrcodeCategoryRow = {
  id: string
  tenant_id: string
  menu_qr_code_id: string
  category_key: string
  title: string | null
  description: string | null
  icon: string | null
}

type FailureRule =
  | { op: 'menu_qr_codes.update'; qrId?: string; message: string }
  | { op: 'restaurant_settings.upsert'; message: string }

function makeQrRow(overrides: Partial<QrRow> = {}): QrRow {
  return {
    id: 'qr-1',
    tenant_id: TENANT,
    short_code: 'abc123',
    name: 'Menu sala',
    category_filter: ['antipasti', 'primi'],
    category_images: { primi: `https://storage.test/${TENANT}/qr/qr-1/cat/primi.webp` },
    is_active: true,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    theme_key: 'mediterranean_teal',
    carousel_items: [],
    hidden_menu_item_ids: [],
    ...overrides,
  }
}

function makeFormConfigWithHiddenKeys(keys: string[]) {
  return {
    ...DEFAULT_BOOKING_FORM_CONFIG,
    booking_modes: DEFAULT_BOOKING_FORM_CONFIG.booking_modes.map((mode, i) =>
      i === 0
        ? {
            ...mode,
            sub_tabs: [
              {
                id: 'tab-1',
                label: 'Menu',
                display: 'cards' as const,
                hidden_category_keys: keys,
                category_order_keys: keys,
              },
            ],
          }
        : mode,
    ),
  }
}

/** Chain con N `.eq()` poi terminale (maybeSingle o Promise). */
function buildEqChain<T>(eqCountBeforeTerminal: number, terminal: () => T) {
  let eqCalls = 0
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = vi.fn(() => {
    eqCalls++
    return eqCalls >= eqCountBeforeTerminal ? Promise.resolve(terminal()) : chain
  })
  chain.maybeSingle = vi.fn(async () => terminal())
  return chain
}

function installMockDb(
  initial: {
    qrCodes: QrRow[]
    qrcodeCategories: QrcodeCategoryRow[]
    formSetting: { setting_value: unknown } | null
  },
  failures: FailureRule[] = [],
) {
  const state = {
    qrCodes: initial.qrCodes.map((r) => ({
      ...r,
      category_images: { ...r.category_images },
    })),
    qrcodeCategories: initial.qrcodeCategories.map((r) => ({ ...r })),
    formSetting: initial.formSetting ? { ...initial.formSetting } : null,
  }

  let formUpsertPayload: unknown = null
  let overridesDeletedForKey: string | null = null

  mockFrom.mockImplementation((table: string) => {
    if (table === 'menu_qr_codes') {
      return {
        select: vi.fn(() => buildEqChain(1, () => ({ data: state.qrCodes, error: null }))),
        update: vi.fn((patch: Record<string, unknown>) => {
          let targetQrId: string | null = null
          const chain: Record<string, ReturnType<typeof vi.fn>> = {}
          let eqCalls = 0
          chain.eq = vi.fn((col: string, val: string) => {
            eqCalls++
            if (col === 'id') targetQrId = val
            if (eqCalls >= 2) {
              const fail = failures.find(
                (f) => f.op === 'menu_qr_codes.update' && (!f.qrId || f.qrId === targetQrId),
              )
              if (fail) return Promise.resolve({ data: null, error: { message: fail.message } })
              const row = state.qrCodes.find((r) => r.id === targetQrId)
              if (row) {
                if ('category_filter' in patch) {
                  row.category_filter = patch.category_filter as string[] | null
                }
                if ('category_images' in patch) {
                  row.category_images = patch.category_images as Record<string, string>
                }
              }
              return Promise.resolve({ data: null, error: null })
            }
            return chain
          })
          return chain
        }),
      }
    }

    if (table === 'menu_qrcode_categories') {
      return {
        select: vi.fn(() => {
          let tenantFilter: string | null = null
          let qrFilter: string | null = null
          const chain: Record<string, ReturnType<typeof vi.fn>> = {}
          let eqCalls = 0
          chain.eq = vi.fn((col: string, val: string) => {
            eqCalls++
            if (col === 'tenant_id') tenantFilter = val
            if (col === 'menu_qr_code_id') qrFilter = val
            if (eqCalls >= 2) {
              const rows = state.qrcodeCategories.filter(
                (r) => r.tenant_id === tenantFilter && r.menu_qr_code_id === qrFilter,
              )
              return Promise.resolve({ data: rows, error: null })
            }
            return chain
          })
          return chain
        }),
        update: vi.fn((patch: Record<string, unknown>) => {
          let rowId: string | null = null
          const chain: Record<string, ReturnType<typeof vi.fn>> = {}
          let eqCalls = 0
          chain.eq = vi.fn((col: string, val: string) => {
            eqCalls++
            if (col === 'id') rowId = val
            if (eqCalls >= 2) {
              const row = state.qrcodeCategories.find((r) => r.id === rowId)
              if (row) {
                if ('category_key' in patch) row.category_key = patch.category_key as string
                if ('title' in patch) row.title = patch.title as string | null
                if ('description' in patch) row.description = patch.description as string | null
                if ('icon' in patch) row.icon = patch.icon as string | null
              }
              return Promise.resolve({ data: null, error: null })
            }
            return chain
          })
          return chain
        }),
        delete: vi.fn(() => {
          let categoryKey: string | null = null
          const chain: Record<string, ReturnType<typeof vi.fn>> = {}
          let eqCalls = 0
          chain.eq = vi.fn((col: string, val: string) => {
            eqCalls++
            if (col === 'category_key') categoryKey = val
            if (eqCalls >= 2) {
              overridesDeletedForKey = categoryKey
              state.qrcodeCategories = state.qrcodeCategories.filter(
                (r) => r.category_key !== categoryKey,
              )
              return Promise.resolve({ data: null, error: null })
            }
            return chain
          })
          return chain
        }),
      }
    }

    if (table === 'restaurant_settings') {
      const formChain: Record<string, ReturnType<typeof vi.fn>> = {}
      let formEqCalls = 0
      formChain.eq = vi.fn(() => {
        formEqCalls++
        return formChain
      })
      formChain.maybeSingle = vi.fn(async () => ({ data: state.formSetting, error: null }))
      return {
        select: vi.fn(() => formChain),
        upsert: vi.fn((rows: unknown[]) => {
          const fail = failures.find((f) => f.op === 'restaurant_settings.upsert')
          if (fail) return Promise.resolve({ data: null, error: { message: fail.message } })
          formUpsertPayload = rows[0]
          const row = rows[0] as { setting_value: unknown }
          state.formSetting = { setting_value: row.setting_value }
          return Promise.resolve({ data: null, error: null })
        }),
      }
    }

    return {}
  })

  return {
    getState: () => state,
    formUpsertPayload: () => formUpsertPayload,
    overridesDeletedForKey: () => overridesDeletedForKey,
  }
}

describe('@admin-blindatura menu-magazzino-sync — messaggi modale', () => {
  it('rename e delete espongono testo informativo per overlay Categorie Menu', () => {
    expect(CATEGORY_KEY_RENAME_INFO_MESSAGE).toMatch(/Menù QR/i)
    expect(CATEGORY_KEY_DELETE_INFO_MESSAGE).toMatch(/Personalizza form/i)
  })
})

describe('@admin-blindatura menu-magazzino-sync — rename happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allinea category_filter QR, override menu_qrcode_categories e hidden_category_keys form', async () => {
    const db = installMockDb({
      qrCodes: [makeQrRow()],
      qrcodeCategories: [
        {
          id: 'ov-1',
          tenant_id: TENANT,
          menu_qr_code_id: 'qr-1',
          category_key: 'primi',
          title: 'Primi piatti',
          description: null,
          icon: 'lucide_salad',
        },
      ],
      formSetting: { setting_value: makeFormConfigWithHiddenKeys(['primi', 'dolci']) },
    })

    await syncMenuCategoryKeyRename(TENANT, 'primi', 'secondi_piatti')

    const state = db.getState()
    expect(state.qrCodes[0].category_filter).toEqual(['antipasti', 'secondi_piatti'])
    expect(state.qrCodes[0].category_images.secondi_piatti).toBeDefined()
    expect(state.qrCodes[0].category_images.primi).toBeUndefined()
    expect(state.qrcodeCategories[0].category_key).toBe('secondi_piatti')

    const upsert = db.formUpsertPayload() as {
      setting_value: ReturnType<typeof makeFormConfigWithHiddenKeys>
    }
    expect(upsert).not.toBeNull()
    const hidden = upsert.setting_value.booking_modes[0].sub_tabs?.[0].hidden_category_keys
    expect(hidden).toEqual(['secondi_piatti', 'dolci'])
    expect(mockTryCopyPhoto).toHaveBeenCalledWith(TENANT, 'qr-1', 'primi', 'secondi_piatti')
  })

  it('no-op se previousKey === newKey', async () => {
    installMockDb({ qrCodes: [makeQrRow()], qrcodeCategories: [], formSetting: null })
    await syncMenuCategoryKeyRename(TENANT, 'primi', 'primi')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('@admin-blindatura menu-magazzino-sync — delete happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rimuove chiave da QR esplicito, override e hidden_category_keys form', async () => {
    const db = installMockDb({
      qrCodes: [
        makeQrRow({
          category_filter: ['antipasti', 'primi'],
          category_images: {
            primi: `https://storage.test/${TENANT}/qr/qr-1/cat/primi.webp`,
            dolci: `https://storage.test/${TENANT}/qr/qr-1/cat/dolci.webp`,
          },
        }),
      ],
      qrcodeCategories: [
        {
          id: 'ov-1',
          tenant_id: TENANT,
          menu_qr_code_id: 'qr-1',
          category_key: 'primi',
          title: 'Primi',
          description: null,
          icon: null,
        },
      ],
      formSetting: { setting_value: makeFormConfigWithHiddenKeys(['primi']) },
    })

    await syncMenuCategoryKeyDelete(TENANT, 'primi')

    const state = db.getState()
    expect(state.qrCodes[0].category_filter).toEqual(['antipasti'])
    expect(state.qrCodes[0].category_images.primi).toBeUndefined()
    expect(state.qrCodes[0].category_images.dolci).toBeDefined()
    expect(state.qrcodeCategories.some((r) => r.category_key === 'primi')).toBe(false)
    expect(db.overridesDeletedForKey()).toBe('primi')

    const upsert = db.formUpsertPayload() as {
      setting_value: ReturnType<typeof makeFormConfigWithHiddenKeys>
    }
    expect(upsert.setting_value.booking_modes[0].sub_tabs?.[0].hidden_category_keys).toEqual([])
    expect(mockRemovePhoto).toHaveBeenCalled()
  })

  it('category_filter null (legacy tutte) resta invariato al delete', async () => {
    const db = installMockDb({
      qrCodes: [makeQrRow({ category_filter: null, category_images: {} })],
      qrcodeCategories: [],
      formSetting: null,
    })

    await syncMenuCategoryKeyDelete(TENANT, 'primi')

    expect(db.getState().qrCodes[0].category_filter).toBeNull()
  })
})

describe('@admin-blindatura menu-magazzino-sync — controtest parziale (sync non transazionale)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rename: QR già aggiornato ma upsert form fallisce → throw; QR resta con nuova chiave (incoerenza documentata)', async () => {
    const db = installMockDb(
      {
        qrCodes: [makeQrRow()],
        qrcodeCategories: [],
        formSetting: { setting_value: makeFormConfigWithHiddenKeys(['primi']) },
      },
      [{ op: 'restaurant_settings.upsert', message: 'form sync failed' }],
    )

    await expect(syncMenuCategoryKeyRename(TENANT, 'primi', 'secondi_piatti')).rejects.toThrow(
      'form sync failed',
    )

    expect(db.getState().qrCodes[0].category_filter).toEqual(['antipasti', 'secondi_piatti'])
    expect(db.formUpsertPayload()).toBeNull()
  })

  it('rename: secondo QR update fallisce → primo QR allineato, throw prima del form', async () => {
    const db = installMockDb(
      {
        qrCodes: [
          makeQrRow({ id: 'qr-1', category_filter: ['primi'] }),
          makeQrRow({
            id: 'qr-2',
            short_code: 'def456',
            category_filter: ['primi'],
            category_images: {},
          }),
        ],
        qrcodeCategories: [],
        formSetting: null,
      },
      [{ op: 'menu_qr_codes.update', qrId: 'qr-2', message: 'qr-2 update failed' }],
    )

    await expect(syncMenuCategoryKeyRename(TENANT, 'primi', 'secondi_piatti')).rejects.toThrow(
      'qr-2 update failed',
    )

    expect(db.getState().qrCodes[0].category_filter).toEqual(['secondi_piatti'])
    expect(db.getState().qrCodes[1].category_filter).toEqual(['primi'])
    expect(db.formUpsertPayload()).toBeNull()
  })

  it('delete: QR e override ok ma upsert form fallisce → throw; QR già pulito', async () => {
    const db = installMockDb(
      {
        qrCodes: [makeQrRow({ category_filter: ['primi'] })],
        qrcodeCategories: [
          {
            id: 'ov-1',
            tenant_id: TENANT,
            menu_qr_code_id: 'qr-1',
            category_key: 'primi',
            title: null,
            description: null,
            icon: null,
          },
        ],
        formSetting: { setting_value: makeFormConfigWithHiddenKeys(['primi']) },
      },
      [{ op: 'restaurant_settings.upsert', message: 'form delete sync failed' }],
    )

    await expect(syncMenuCategoryKeyDelete(TENANT, 'primi')).rejects.toThrow('form delete sync failed')

    expect(db.getState().qrCodes[0].category_filter).toEqual([])
    expect(db.getState().qrcodeCategories).toHaveLength(0)
    expect(db.formUpsertPayload()).toBeNull()
  })
})

describe('@admin-blindatura menu-magazzino-sync — is_available + rename (nessuna regressione filtri pubblici)', () => {
  it('categoria spenta rinominata: filtro pubblico segue la nuova chiave, resta nascosta', () => {
    const categoriesBefore = [
      { key: 'secondi_piattie', label: 'Secondi piattie', is_available: false },
      { key: 'dolci', label: 'Dolci', is_available: true },
    ]
    const itemsBefore = [
      { id: 's1', name: 'Tagliata', category: 'secondi_piattie', price: 18, is_available: true },
    ]

    const categoriesAfterRename = categoriesBefore.map((c) =>
      c.key === 'secondi_piattie' ? { ...c, key: 'secondi_piatti' } : c,
    )
    const itemsAfterRename = itemsBefore.map((i) =>
      i.category === 'secondi_piattie' ? { ...i, category: 'secondi_piatti' } : i,
    )

    const publicCats = filterMenuCategoriesForPublic(categoriesAfterRename)
    expect(publicCats.map((c) => c.key)).toEqual(['dolci'])

    const publicItems = filterMenuItemsForPublic(itemsAfterRename, categoriesAfterRename)
    expect(publicItems).toHaveLength(0)
  })
})
