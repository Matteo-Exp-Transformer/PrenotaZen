import React from 'react'
import { cn } from '@/lib/utils'
import { mergeWheelHandlers, suppressNumberInputWheel } from '@/lib/suppressNumberInputWheel'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, dir, style, onWheel, ...props }, ref) => {
    const handleWheel =
      type === 'number'
        ? mergeWheelHandlers(suppressNumberInputWheel, onWheel)
        : onWheel

    return (
      <input
        type={type}
        ref={ref}
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
        onWheel={handleWheel}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
