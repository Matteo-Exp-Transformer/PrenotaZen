import React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900',
        'placeholder:text-slate-400 resize-none',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400',
        'disabled:cursor-not-allowed disabled:bg-slate-50',
        'transition-colors duration-150',
        className
      )}
      {...props}
    />
  )
)

Textarea.displayName = 'Textarea'

export { Textarea }
