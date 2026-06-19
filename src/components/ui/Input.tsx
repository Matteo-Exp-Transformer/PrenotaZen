import React, { useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, dir, style, onWheel, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement | null>(null)

    const combinedRef = useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref != null) {
          ;(ref as React.MutableRefObject<HTMLInputElement | null>).current = node
        }
      },
      [ref],
    )

    // Usa listener nativo con { passive: false } perché l'onWheel di React viene delegato
    // alla radice e i browser moderni ignorano preventDefault() su wheel passivo.
    useEffect(() => {
      if (type !== 'number') return
      const el = innerRef.current
      if (!el) return
      const handler = (e: WheelEvent) => {
        if (document.activeElement === e.currentTarget) {
          e.preventDefault()
        }
      }
      el.addEventListener('wheel', handler, { passive: false })
      return () => el.removeEventListener('wheel', handler)
    }, [type])

    return (
      <input
        type={type}
        ref={combinedRef}
        dir={dir ?? 'ltr'}
        style={{
          direction: 'ltr',
          unicodeBidi: 'isolate',
          ...style,
        }}
        className={cn(
          'block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900',
          'placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
          'transition-colors duration-150',
          className
        )}
        onWheel={onWheel}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
