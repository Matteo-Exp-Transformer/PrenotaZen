import React from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline'
  | 'neutral'

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary-50 text-primary-700 border-primary-200',
  primary: 'bg-primary-600 text-white border-transparent',
  success: 'bg-(--color-status-accepted)/15 text-(--color-status-accepted) border-transparent',
  warning: 'bg-(--color-status-pending)/15 text-(--color-status-pending) border-transparent',
  danger: 'bg-red-50 text-red-700 border-transparent',
  outline: 'bg-transparent text-primary-700 border-(--color-border)',
  neutral: 'bg-(--color-surface-2) text-(--color-text-muted) border-(--color-border)',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-micro font-semibold leading-none',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
