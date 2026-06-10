import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import {
  getMenuQrCategoryIconOption,
  resolveMenuQrCategoryIconKey,
} from '@/features/public-menu/categoryIcons'

type MenuQrCategoryIconGlyphProps = {
  iconKey?: string | null
  categoryKey?: string
  className?: string
  size?: number
  style?: CSSProperties
}

/** Render unico per icone categoria QR: Phosphor (`weight="regular"`) o Lucide. */
export function MenuQrCategoryIconGlyph({
  iconKey,
  categoryKey,
  className,
  size,
  style,
}: MenuQrCategoryIconGlyphProps) {
  const key = resolveMenuQrCategoryIconKey(iconKey, categoryKey)
  const opt = getMenuQrCategoryIconOption(key)

  if (opt.family === 'phosphor') {
    const Icon = opt.Icon
    return <Icon size={size} className={cn(className)} style={style} weight="regular" aria-hidden />
  }

  const Icon = opt.Icon
  return (
    <Icon
      size={size}
      className={cn(className)}
      style={style}
      strokeWidth={1.75}
      aria-hidden
    />
  )
}
