// @prenota-blindatura: flusso-dati
// Copre: invariante ordinamento categorie con chiavi STALE/ORFANE e DUPLICATE
//        (LOCK Rename/Delete chiave categoria — lato lettura pubblica) + valori
//        magici di sort (999 fallback DB, 1000+index per categorie extra).
//
// Caccia: category_order_keys salvato in DB può contenere chiavi non più nel preset
// (orfane) o duplicate. La lettura pubblica (orderCategoryKeys / buildOrderedCategoryEntries)
// deve SEMPRE produrre solo le chiavi vive, deduplicate, senza crash. Questo blinda il
// fatto che la pagina Prenota non mostra categorie fantasma anche se il DB è "sporco".

import { describe, it, expect } from 'vitest'
import {
  orderCategoryKeys,
  buildOrderedCategoryEntries,
  buildCategorySortOrderMap,
} from '../orderCategoryKeys'

const DB_ORDER = new Map([
  ['antipasti', 10],
  ['primi', 20],
  ['secondi', 30],
  ['dolci', 40],
])

describe('orderCategoryKeys — chiavi orfane in orderKeys', () => {
  it('chiave orfana in testa a orderKeys non sfasa le chiavi vive', () => {
    // orderKeys salvato contiene "orfana" (non più nel catalogo/preset)
    const result = orderCategoryKeys(
      ['dolci', 'primi'],
      ['orfana', 'dolci', 'primi'],
      DB_ORDER,
    )
    // l'orfana viene ignorata, l'ordine richiesto delle chiavi vive è rispettato
    expect(result).toEqual(['dolci', 'primi'])
  })

  it('solo chiavi orfane in orderKeys → fallback completo a sort DB', () => {
    const result = orderCategoryKeys(['secondi', 'antipasti'], ['fantasma1', 'fantasma2'], DB_ORDER)
    expect(result).toEqual(['antipasti', 'secondi'])
  })

  it('mix: alcune orfane, alcune vive → vive nell ordine richiesto, resto per DB', () => {
    const result = orderCategoryKeys(
      ['antipasti', 'primi', 'secondi', 'dolci'],
      ['dolci', 'fantasma', 'antipasti'],
      DB_ORDER,
    )
    expect(result).toEqual(['dolci', 'antipasti', 'primi', 'secondi'])
  })
})

describe('orderCategoryKeys — duplicati in orderKeys', () => {
  it('chiavi duplicate in orderKeys compaiono una sola volta', () => {
    const result = orderCategoryKeys(
      ['antipasti', 'primi', 'dolci'],
      ['dolci', 'dolci', 'primi', 'dolci'],
      DB_ORDER,
    )
    expect(result).toEqual(['dolci', 'primi', 'antipasti'])
  })

  it('orderKeys dedup, ma duplicati in `keys` (input) NON sono deduplicati', () => {
    // NOTA contratto: orderCategoryKeys deduplica solo le chiavi che passano per orderKeys
    // (via `seen`). Eventuali duplicati nell'input `keys` restano nel blocco "remaining".
    // In produzione `keys` arriva sempre da un Set (MenuSelection), quindi non si verifica.
    const deduped = orderCategoryKeys(['primi', 'dolci'], ['dolci'], DB_ORDER)
    expect(deduped).toEqual(['dolci', 'primi'])

    const withDupInput = orderCategoryKeys(['primi', 'primi', 'dolci'], ['dolci'], DB_ORDER)
    expect(withDupInput).toEqual(['dolci', 'primi', 'primi'])
  })
})

describe('orderCategoryKeys — valori magici sort_order', () => {
  it('chiave senza sort_order DB usa 999 (in coda, ma prima di chiavi più alte)', () => {
    const order = new Map([['primi', 20]])
    // "extra" non è nel map → 999, va dopo primi
    const result = orderCategoryKeys(['extra', 'primi'], undefined, order)
    expect(result).toEqual(['primi', 'extra'])
  })

  it('categorie extra con sort_order 1000+index restano dopo il catalogo, in ordine stabile', () => {
    const categories = [
      { key: 'antipasti', label: 'Antipasti', sort_order: 10 },
      { key: 'primi', label: 'Primi', sort_order: 20 },
      { key: 'extraA', label: 'extraA', sort_order: 1000 },
      { key: 'extraB', label: 'extraB', sort_order: 1001 },
    ]
    const entries = buildOrderedCategoryEntries(
      categories,
      ['extraB', 'antipasti', 'extraA', 'primi'],
      undefined,
    )
    expect(entries.map(([k]) => k)).toEqual(['antipasti', 'primi', 'extraA', 'extraB'])
  })
})

describe('reorder frecce admin — swap sull ordine PULITO (bug #1 riordino con chiavi stale)', () => {
  // Blinda il fix in BookingFormConfigPanel.resolveCategoryOrderForMove: lo swap delle frecce
  // su/giù deve operare sulle stesse chiavi mostrate all'admin (output di orderCategoryKeys:
  // orfane filtrate, duplicati rimossi). Prima del fix usava il category_order_keys grezzo,
  // disallineando l'index della riga visualizzata dall'array swappato quando c'erano chiavi stale
  // → la freccia spostava la categoria sbagliata o sembrava inerte.

  // Replica la meccanica del componente: ordine visualizzato + swap a un indice visualizzato.
  function reorderAt(
    presetKeys: readonly string[],
    savedRaw: readonly string[] | undefined,
    index: number,
    dir: 'up' | 'down',
  ): string[] {
    const visible = orderCategoryKeys(presetKeys, savedRaw, DB_ORDER)
    const order = [...visible] // FIX: si swappa sull'ordine pulito, non sul grezzo
    const j = dir === 'up' ? index - 1 : index + 1
    if (j < 0 || j >= order.length) return order
    ;[order[index], order[j]] = [order[j], order[index]]
    return order
  }

  it('saved con orfana in testa: muovere la 1a riga visualizzata in giù sposta la categoria GIUSTA', () => {
    // saved grezzo: ['orfana','dolci','primi'] · preset vivo: ['dolci','primi']
    // riga visualizzata index 0 = 'dolci'. Giù deve dare ['primi','dolci'], non un no-op.
    const result = reorderAt(['dolci', 'primi'], ['orfana', 'dolci', 'primi'], 0, 'down')
    expect(result).toEqual(['primi', 'dolci'])
  })

  it('lo swap non reintroduce mai chiavi orfane o duplicate nell ordine salvato', () => {
    const result = reorderAt(['antipasti', 'primi', 'dolci'], ['fantasma', 'dolci', 'dolci', 'primi'], 0, 'down')
    expect(result).not.toContain('fantasma')
    expect(new Set(result).size).toBe(result.length) // nessun duplicato
    expect([...result].sort()).toEqual(['antipasti', 'dolci', 'primi'])
  })
})

describe('buildOrderedCategoryEntries — coerenza label/chiave con dati sporchi', () => {
  it('chiave senza label nel catalogo usa la chiave come label (no crash)', () => {
    const categories = [{ key: 'primi', label: 'Primi', sort_order: 20 }]
    const entries = buildOrderedCategoryEntries(categories, ['primi', 'misteriosa'], ['misteriosa', 'primi'])
    expect(entries).toEqual([
      ['misteriosa', 'misteriosa'],
      ['primi', 'Primi'],
    ])
  })

  it('buildCategorySortOrderMap riflette il catalogo DB', () => {
    const map = buildCategorySortOrderMap([
      { key: 'primi', sort_order: 20 },
      { key: 'dolci', sort_order: 40 },
    ])
    expect(map.get('primi')).toBe(20)
    expect(map.get('dolci')).toBe(40)
    expect(map.get('assente')).toBeUndefined()
  })
})
