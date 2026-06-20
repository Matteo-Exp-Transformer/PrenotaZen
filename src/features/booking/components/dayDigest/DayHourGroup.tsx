import React from 'react'
import { cn } from '@/lib/utils'

interface DayHourGroupProps {
  /** Es. "13:00" */
  hourLabel: string
  children: React.ReactNode
  withDivider?: boolean
}

export function DayHourGroup({ hourLabel, children, withDivider = false }: DayHourGroupProps) {
  return (
    <div
      className={cn(
        'min-w-0',
        withDivider && 'border-t border-gray-200/80 pt-4 md:pt-5',
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="shrink-0">
          <span className="inline-flex rounded-md bg-primary-50 px-2.5 py-1 text-sm font-bold leading-none tabular-nums text-primary-900 sm:text-[0.9375rem]">
            {hourLabel}
          </span>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 min-[576px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {children}
        </div>
      </div>
    </div>
  )
}
