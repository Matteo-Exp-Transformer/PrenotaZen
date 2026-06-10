import {
  BeerBottle,
  BowlFood,
  Cake,
  Coffee,
  CookingPot,
  Fish,
  Flame,
  ForkKnife,
  Leaf,
  Martini,
  Hamburger,
  Pizza,
  type Icon as PhosphorIconType,
} from '@phosphor-icons/react'
import {
  ChefHat,
  Cookie,
  Croissant,
  IceCreamCone,
  Milk,
  Salad,
  Sandwich,
  Shrimp,
  type LucideIcon,
} from 'lucide-react'

/** Default universale per categorie senza foto e senza mapping noto. */
export const MENU_QR_DEFAULT_CATEGORY_ICON_KEY = 'lucide_salad' as const

export type MenuQrPhosphorIconKey =
  | 'fork_knife'
  | 'bowl_food'
  | 'cooking_pot'
  | 'flame'
  | 'cake'
  | 'martini'
  | 'fish'
  | 'steak'
  | 'leaf'
  | 'coffee'
  | 'beer'
  | 'pizza_slice'

export type MenuQrLucideIconKey =
  | 'lucide_chef_hat'
  | 'lucide_salad'
  | 'lucide_shrimp'
  | 'lucide_sandwich'
  | 'lucide_croissant'
  | 'lucide_ice_cream'
  | 'lucide_cookie'
  | 'lucide_tea'

/** Chiavi Lucide rimosse dal picker (01-06-26) — fallback visivo se ancora in DB. */
const REMOVED_LUCIDE_ICON_FALLBACK: Record<string, MenuQrCategoryIconKey> = {
  lucide_soup: 'cooking_pot',
  lucide_egg_fried: 'fork_knife',
}

export type MenuQrCategoryIconKey = MenuQrPhosphorIconKey | MenuQrLucideIconKey

export type MenuQrCategoryIconOption =
  | {
      value: MenuQrPhosphorIconKey
      label: string
      family: 'phosphor'
      Icon: PhosphorIconType
    }
  | {
      value: MenuQrLucideIconKey
      label: string
      family: 'lucide'
      Icon: LucideIcon
    }

/** Mappa key categoria menu → chiave icona preset (solo Phosphor per prefill automatico). */
export const MENU_QR_CATEGORY_ICON_BY_CATEGORY_KEY: Record<string, MenuQrPhosphorIconKey> = {
  antipasti: 'fork_knife',
  pizza: 'pizza_slice',
  primi: 'cooking_pot',
  secondi: 'steak',
  fritti: 'flame',
  bevande: 'coffee',
  vini: 'martini',
  birre: 'beer',
  dolci: 'cake',
  dessert: 'cake',
  formaggi: 'bowl_food',
  contorni: 'leaf',
  panini: 'fork_knife',
  insalate: 'leaf',
  zuppe: 'cooking_pot',
  pesce: 'fish',
  pesci: 'fish',
  carni: 'steak',
  carne: 'steak',
  caffe: 'coffee',
  caffè: 'coffee',
}

export const MENU_QR_PHOSPHOR_ICON_OPTIONS: MenuQrCategoryIconOption[] = [
  { value: 'fork_knife', label: 'Posate', family: 'phosphor', Icon: ForkKnife },
  { value: 'bowl_food', label: 'Ciotola', family: 'phosphor', Icon: BowlFood },
  { value: 'cooking_pot', label: 'Pentola', family: 'phosphor', Icon: CookingPot },
  { value: 'flame', label: 'Fiamma', family: 'phosphor', Icon: Flame },
  { value: 'cake', label: 'Dolce', family: 'phosphor', Icon: Cake },
  { value: 'martini', label: 'Calice', family: 'phosphor', Icon: Martini },
  { value: 'fish', label: 'Pesce', family: 'phosphor', Icon: Fish },
  { value: 'steak', label: 'Bistecca', family: 'phosphor', Icon: Hamburger },
  { value: 'leaf', label: 'Verdura', family: 'phosphor', Icon: Leaf },
  { value: 'coffee', label: 'Caffè', family: 'phosphor', Icon: Coffee },
  { value: 'beer', label: 'Birra', family: 'phosphor', Icon: BeerBottle },
  { value: 'pizza_slice', label: 'Pizza', family: 'phosphor', Icon: Pizza },
]

/** Lucide: `Tea` non esportato in lucide-react del progetto → `Milk` (bevanda calda ≠ caffè Phosphor). */
export const MENU_QR_LUCIDE_ICON_OPTIONS: MenuQrCategoryIconOption[] = [
  { value: 'lucide_chef_hat', label: 'Chef / cucina', family: 'lucide', Icon: ChefHat },
  { value: 'lucide_salad', label: 'Insalata', family: 'lucide', Icon: Salad },
  { value: 'lucide_shrimp', label: 'Gamberi / mare', family: 'lucide', Icon: Shrimp },
  { value: 'lucide_sandwich', label: 'Panino', family: 'lucide', Icon: Sandwich },
  { value: 'lucide_croissant', label: 'Brioche / colazione', family: 'lucide', Icon: Croissant },
  { value: 'lucide_ice_cream', label: 'Gelato', family: 'lucide', Icon: IceCreamCone },
  { value: 'lucide_cookie', label: 'Biscotti', family: 'lucide', Icon: Cookie },
  { value: 'lucide_tea', label: 'Tè', family: 'lucide', Icon: Milk },
]

export const MENU_QR_CATEGORY_ICON_OPTIONS: MenuQrCategoryIconOption[] = [
  ...MENU_QR_PHOSPHOR_ICON_OPTIONS,
  ...MENU_QR_LUCIDE_ICON_OPTIONS,
]

const MENU_QR_CATEGORY_ICON_OPTION_BY_VALUE = Object.fromEntries(
  MENU_QR_CATEGORY_ICON_OPTIONS.map((opt) => [opt.value, opt]),
) as Record<MenuQrCategoryIconKey, MenuQrCategoryIconOption>

const PHOSPHOR_ICON_BY_KEY = Object.fromEntries(
  MENU_QR_PHOSPHOR_ICON_OPTIONS.map((opt) => [opt.value, opt.Icon]),
) as Record<MenuQrPhosphorIconKey, PhosphorIconType>

/** @deprecated Usare `MenuQrCategoryIconGlyph` — solo icone Phosphor. */
export const CATEGORY_ICON: Record<string, PhosphorIconType> = Object.fromEntries(
  Object.entries(MENU_QR_CATEGORY_ICON_BY_CATEGORY_KEY).map(([key, iconKey]) => [
    key,
    PHOSPHOR_ICON_BY_KEY[iconKey],
  ]),
)

/** Chiavi icona legacy Prenota (pre-unificazione catalogo QR) → `MenuQrCategoryIconKey`. */
export const BOOKING_LEGACY_ICON_TO_MENU_QR_KEY: Record<string, MenuQrCategoryIconKey> = {
  utensils: 'fork_knife',
  'chef-hat': 'lucide_chef_hat',
  wine: 'martini',
  coffee: 'coffee',
  pizza: 'pizza_slice',
  hamburger: 'steak',
  'bowl-steam': 'cooking_pot',
  cake: 'cake',
  martini: 'martini',
  leaf: 'leaf',
  cloche: 'bowl_food',
  star: MENU_QR_DEFAULT_CATEGORY_ICON_KEY,
}

export function isMenuQrCategoryIconKey(key: string): key is MenuQrCategoryIconKey {
  return key in MENU_QR_CATEGORY_ICON_OPTION_BY_VALUE
}

/** Migrate-on-read: legacy booking / valori già nel catalogo QR. */
export function resolveBookingStoredIconKey(
  iconKey: string | null | undefined,
  fallback: MenuQrCategoryIconKey = MENU_QR_DEFAULT_CATEGORY_ICON_KEY,
): MenuQrCategoryIconKey {
  if (iconKey && isMenuQrCategoryIconKey(iconKey)) return iconKey
  if (iconKey && iconKey in BOOKING_LEGACY_ICON_TO_MENU_QR_KEY) {
    return BOOKING_LEGACY_ICON_TO_MENU_QR_KEY[iconKey]
  }
  return fallback
}

export function getMenuQrCategoryIconOption(
  key: MenuQrCategoryIconKey,
): MenuQrCategoryIconOption {
  return MENU_QR_CATEGORY_ICON_OPTION_BY_VALUE[key]
}

/** @deprecated Usare `MenuQrCategoryIconGlyph` per Phosphor + Lucide. */
export function resolveMenuQrCategoryIcon(
  iconKey: string | null | undefined,
  categoryKey?: string,
): PhosphorIconType {
  const resolved = resolveMenuQrCategoryIconKey(iconKey, categoryKey)
  const opt = getMenuQrCategoryIconOption(resolved)
  if (opt.family === 'lucide') {
    return PHOSPHOR_ICON_BY_KEY.fork_knife
  }
  return opt.Icon
}

export function defaultIconKeyForCategory(categoryKey: string): MenuQrPhosphorIconKey | null {
  return MENU_QR_CATEGORY_ICON_BY_CATEGORY_KEY[categoryKey.toLowerCase()] ?? null
}

export function resolveMenuQrCategoryIconKey(
  iconKey: string | null | undefined,
  categoryKey?: string,
): MenuQrCategoryIconKey {
  if (iconKey && isMenuQrCategoryIconKey(iconKey)) return iconKey
  if (iconKey && iconKey in REMOVED_LUCIDE_ICON_FALLBACK) {
    return REMOVED_LUCIDE_ICON_FALLBACK[iconKey]
  }
  return defaultIconKeyForCategory(categoryKey ?? '') ?? MENU_QR_DEFAULT_CATEGORY_ICON_KEY
}
