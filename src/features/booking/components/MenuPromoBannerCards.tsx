import React from 'react'
import { cn } from '@/lib/utils'

const MENU_CARD_MAX_WIDTH_PX = 746

export type MenuPromoBannerCardsProps = {
  messages: string[]
  className?: string
}

/**
 * Card promo stile form pubblico (allineate al label sopra al menu a tendina in MenuSelection).
 */
export const MenuPromoBannerCards: React.FC<MenuPromoBannerCardsProps> = ({
  messages,
  className,
}) => {
  const filtered = messages.map((m) => m.trim()).filter(Boolean)
  if (filtered.length === 0) {
    return null
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(1px)',
    padding: '8px 16px',
    borderRadius: '12px',
    display: 'block',
    fontWeight: '700',
    maxWidth: `min(${MENU_CARD_MAX_WIDTH_PX}px, calc(100% - 16px))`,
    marginLeft: 'auto',
    marginRight: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }

  return (
    <div
      className={cn('flex w-full flex-col items-center gap-2', className)}
      role="region"
      aria-label="Promozioni menù"
    >
      {filtered.map((text, i) => (
        <div
          key={`menu-promo-${i}-${text.slice(0, 40)}`}
          className="block text-base md:text-lg text-warm-wood w-full text-center"
          style={cardStyle}
        >
          {text}
        </div>
      ))}
    </div>
  )
}
