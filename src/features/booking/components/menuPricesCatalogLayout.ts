import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/** Larghezza massima card ingredienti (allineato a MenuSelection). */
export const MENU_CARD_MAX_WIDTH_PX = 746

export const MENU_CATEGORY_LABEL_TITLE_CLASS =
  'min-w-0 flex-1 text-sm font-semibold leading-snug text-primary-900 sm:text-base'

export const MENU_INGREDIENT_NAME_CLASS =
  'min-w-0 flex-1 text-sm font-semibold leading-snug text-primary-900'

export const MENU_INGREDIENT_PRICE_CLASS =
  'shrink-0 text-sm font-semibold tabular-nums text-warm-wood'

export const MENU_INGREDIENT_DESC_CLASS =
  'w-full min-w-0 text-xs leading-snug text-(--color-text-muted)'

export const MENU_CATEGORY_LABEL_TITLE_STYLE: CSSProperties = {
  fontWeight: 700,
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
}

export const MENU_CARD_INNER_SHELL_CLASS =
  'rounded-2xl border-2 border-black/20 bg-white/85 backdrop-blur-[1px] menu-card-mobile transition-all duration-200'

/** Shell card categoria nell’overlay «Categorie ingredienti» (thumb + titolo + azioni). */
export const MENU_CATEGORY_LABEL_CARD_SHELL_CLASS =
  'menu-prices-category-label-card'

export const MENU_CATEGORY_COLLAPSIBLE_CLASS = cn(
  'menu-prices-category-collapsible h-fit overflow-hidden shadow-md transition-shadow duration-200 hover:shadow-lg',
  MENU_CARD_INNER_SHELL_CLASS,
)

export const MENU_CATEGORY_COLLAPSIBLE_HEADER_CLASS =
  'border-black/15 bg-white/85 hover:bg-white/95'

/** Contenitore panoramica ingredienti / selezione preset. */
export const MENU_INGREDIENT_OVERVIEW_SHELL_CLASS =
  'relative w-full rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-lg md:p-6'

export const MENU_INGREDIENT_OVERVIEW_GRID_CLASS =
  'grid grid-cols-1 gap-4 min-[1050px]:grid-cols-2 xl:grid-cols-3'
