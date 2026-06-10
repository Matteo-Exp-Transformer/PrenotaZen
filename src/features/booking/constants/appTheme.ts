/** Tema dashboard admin (persistito in `restaurant_settings.app_theme`). Aggiungere nuovi id qui e in `restaurantSettingRegistry`. */
export const APP_THEME_IDS = [
  'midnight-blue',
  'theme-2',
  'theme-3',
  'soft-graphite-mint',
  'pearl-blue-minimal',
  'warm-sand-pro',
] as const

export type AppThemeId = (typeof APP_THEME_IDS)[number]

export const DEFAULT_APP_THEME: AppThemeId = 'midnight-blue'

export function isAppThemeId(value: unknown): value is AppThemeId {
  if (typeof value !== 'string') return false
  const s = value.trim().toLowerCase()
  return (APP_THEME_IDS as readonly string[]).includes(s)
}

function previewHref(filename: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  return `${base}theme-previews/${filename}`
}

export type AppThemeOption = {
  id: AppThemeId
  label: string
  /** Miniatura griglia impostazioni (JPEG in `public/theme-previews/`) */
  previewSrc: string
  /** Immagine ingrandita nel modal (stesso tema, risoluzione maggiore) */
  previewModalSrc: string
}

export const APP_THEME_OPTIONS: AppThemeOption[] = [
  {
    id: 'midnight-blue',
    label: 'Midnight Blue',
    previewSrc: previewHref('midnight-blue-card.jpg'),
    previewModalSrc: previewHref('midnight-blue-modal.jpg'),
  },
  {
    id: 'theme-2',
    label: 'Terracotta & Sand',
    previewSrc: previewHref('theme-2-card.jpg'),
    previewModalSrc: previewHref('theme-2-modal.jpg'),
  },
  {
    id: 'theme-3',
    label: 'Sage & Stone',
    previewSrc: previewHref('theme-3-card.jpg'),
    previewModalSrc: previewHref('theme-3-modal.jpg'),
  },
  {
    id: 'soft-graphite-mint',
    label: 'Soft Graphite & Mint',
    previewSrc: previewHref('soft-graphite-mint-card.jpg'),
    previewModalSrc: previewHref('soft-graphite-mint-modal.jpg'),
  },
  {
    id: 'pearl-blue-minimal',
    label: 'Pearl Blue Minimal',
    previewSrc: previewHref('pearl-blue-minimal-card.jpg'),
    previewModalSrc: previewHref('pearl-blue-minimal-modal.jpg'),
  },
  {
    id: 'warm-sand-pro',
    label: 'Warm Sand Pro',
    previewSrc: previewHref('warm-sand-pro-card.jpg'),
    previewModalSrc: previewHref('warm-sand-pro-modal.jpg'),
  },
]

export function parseAppThemeFromDb(raw: unknown): AppThemeId {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (isAppThemeId(s)) return s
  return DEFAULT_APP_THEME
}
