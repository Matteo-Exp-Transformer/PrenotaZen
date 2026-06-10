import React, { useState } from 'react'
import { cn } from '@/lib/utils'

export interface BookingCrossShineSubmitButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

/** Pulsante submit verde con effetto cross-shine (hover desktop + burst al tap). */
export const BookingCrossShineSubmitButton: React.FC<BookingCrossShineSubmitButtonProps> = ({
  className,
  disabled,
  children,
  onPointerDown,
  type = 'submit',
  ...props
}) => {
  const [touchCrossBurst, setTouchCrossBurst] = useState(0)

  return (
    <button
      type={type}
      disabled={disabled}
      onPointerDown={(e) => {
        onPointerDown?.(e)
        if (disabled) return
        if (
          typeof window !== 'undefined' &&
          (e.pointerType === 'touch' || window.matchMedia('(hover: none)').matches)
        ) {
          setTouchCrossBurst((v) => v + 1)
        }
      }}
      className={cn(
        'booking-cross-shine-btn group relative overflow-hidden uppercase tracking-wide font-bold text-white rounded-full bg-green-600 hover:bg-green-700 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
        className,
      )}
      {...props}
    >
      <div
        className="booking-cross-shine-mount pointer-events-none absolute inset-0 z-[7] overflow-hidden rounded-[inherit]"
        aria-hidden
      >
        <div className="booking-cross-shine-beam booking-cross-shine-beam-desktop" />
        {touchCrossBurst > 0 ? (
          <div key={touchCrossBurst} className="booking-cross-shine-beam booking-cross-shine-touch-burst" />
        ) : null}
      </div>
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-r from-transparent via-emerald-200/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">{children}</div>
    </button>
  )
}
