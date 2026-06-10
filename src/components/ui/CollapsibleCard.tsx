import React, { type CSSProperties, ReactNode, useEffect, useId, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export interface CollapsibleCardCounterData {
  available: number | null
  capacity: number | null
}

export interface CollapsibleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string | ReactNode
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  children: ReactNode
  defaultExpanded?: boolean
  defaultOpen?: boolean
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  counter?: number | CollapsibleCardCounterData
  actions?: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  loading?: boolean
  isLoading?: boolean
  loadingMessage?: string
  loadingContent?: ReactNode
  error?: string | null
  onRetry?: () => void
  errorActionLabel?: string
  emptyMessage?: string
  showEmpty?: boolean
  isEmpty?: boolean
  emptyContent?: ReactNode
  emptyActionLabel?: string
  onEmptyAction?: () => void
  collapseDisabled?: boolean
  id?: string
  /** Sostituisce le classi di default dell’`h3` titolo (es. allineamento tipografico ad altre card menu). */
  titleClassName?: string
  titleStyle?: CSSProperties
}

export const CollapsibleCard = ({
  title,
  subtitle,
  description,
  icon: Icon,
  children,
  defaultExpanded = true,
  defaultOpen,
  expanded,
  onExpandedChange,
  counter,
  actions,
  className = '',
  headerClassName = '',
  contentClassName,
  loading = false,
  isLoading,
  loadingMessage = 'Caricamento...',
  loadingContent,
  error = null,
  onRetry,
  errorActionLabel = 'Riprova',
  emptyMessage = 'Nessun elemento disponibile',
  showEmpty = false,
  isEmpty,
  emptyContent,
  emptyActionLabel = 'Aggiungi elemento',
  onEmptyAction,
  collapseDisabled = false,
  id,
  titleClassName,
  titleStyle,
  style,
  ...restProps
}: CollapsibleCardProps) => {
  // LOCKED: 2025-01-16 - CollapsibleCard.tsx completamente testato
  // Test eseguiti: 57 test, tutti passati (100%)
  // Componenti testati: CollapsibleCard, CardActionButton, state management complesso
  // Funzionalità: Loading/error/empty states, accessibility, keyboard navigation
  // NON MODIFICARE SENZA PERMESSO ESPLICITO
  const generatedId = useId()
  const cardId = id ?? `collapsible-card-${generatedId}`
  const headerId = `${cardId}-header`
  const contentId = `${cardId}-content`

  const resolvedLoading = isLoading ?? loading
  const resolvedEmpty = useMemo(
    () => (isEmpty ?? showEmpty) && !resolvedLoading && !error,
    [isEmpty, showEmpty, resolvedLoading, error]
  )

  const initialExpanded = useMemo(() => {
    if (expanded !== undefined) {
      return expanded
    }

    if (defaultOpen !== undefined) {
      return defaultOpen
    }

    return defaultExpanded
  }, [defaultExpanded, defaultOpen, expanded])

  const [internalExpanded, setInternalExpanded] = useState(initialExpanded)
  const [shouldRenderContent, setShouldRenderContent] = useState(initialExpanded)
  const [isClosing, setIsClosing] = useState(false)

  const isControlled = expanded !== undefined
  const isExpanded = isControlled ? expanded : internalExpanded

  useEffect(() => {
    let closeTimer: number | undefined

    if (isExpanded) {
      setShouldRenderContent(true)
      setIsClosing(false)
    } else if (shouldRenderContent) {
      setIsClosing(true)
      closeTimer = window.setTimeout(() => {
        setShouldRenderContent(false)
        setIsClosing(false)
      }, 220)
    }

    return () => {
      if (closeTimer !== undefined) {
        window.clearTimeout(closeTimer)
      }
    }
  }, [isExpanded, shouldRenderContent])

  const toggleExpanded = () => {
    if (collapseDisabled) {
      return
    }

    const nextValue = !isExpanded

    if (!isControlled) {
      setInternalExpanded(nextValue)
    }

    onExpandedChange?.(nextValue)
  }

  const handleHeaderKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleExpanded()
    }
  }

  /** Evita il focus al click del mouse sul disclosure: senza questo il browser scrolla per portare il header in vista alla chiusura. */
  const handleHeaderMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (collapseDisabled) {
      return
    }
    const target = event.target as HTMLElement
    if (target.closest('button, a, input, select, textarea')) {
      return
    }
    if (event.button === 0) {
      event.preventDefault()
    }
  }

  const renderStateContent = () => {
    if (resolvedLoading) {
      return (
        <div
          className={
            contentClassName ??
            'flex flex-col items-center justify-center gap-3 py-10 px-4 sm:px-6 text-sm text-gray-600'
          }
          role="status"
          aria-live="polite"
        >
          {loadingContent ?? (
            <>
              <div
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-b-transparent border-primary-600/60"
                aria-hidden="true"
              >
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary-600"></div>
              </div>
              <span>{loadingMessage}</span>
            </>
          )}
        </div>
      )
    }

    if (error) {
      return (
        <div
          className={
            contentClassName ??
            'flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-6 sm:px-6'
          }
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-start gap-2 text-sm text-red-800">
            <div
              className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red-500"
              aria-hidden="true"
            ></div>
            <p>{error}</p>
          </div>
          {onRetry && (
            <div>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onRetry()
                }}
                className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <span>{errorActionLabel}</span>
              </button>
            </div>
          )}
        </div>
      )
    }

    if (resolvedEmpty) {
      if (emptyContent) {
        return (
          <div className={contentClassName ?? 'px-4 py-10 sm:px-6'}>
            {emptyContent}
          </div>
        )
      }

      return (
        <div
          className={
            contentClassName ??
            'flex flex-col items-center gap-4 px-4 py-12 text-center text-gray-500 sm:px-6'
          }
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            {Icon && (
              <Icon className="h-7 w-7 text-gray-400" aria-hidden="true" />
            )}
          </div>
          <p className="text-sm sm:text-base">{emptyMessage}</p>
          {onEmptyAction && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onEmptyAction()
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              {emptyActionLabel}
            </button>
          )}
        </div>
      )
    }

    return null
  }

  const stateContent = renderStateContent()
  const shouldWrapChildren = Boolean(contentClassName)

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden ${className}`}
      style={{ overflowAnchor: 'none', ...style }}
      data-expanded={isExpanded}
      role="region"
      aria-labelledby={headerId}
      {...restProps}
    >
      {/* Header */}
      <div
        className={`flex cursor-pointer items-center px-6 py-4 ${
          headerClassName ||
          'bg-gray-50 hover:bg-gray-100 border-b border-gray-200'
        } transition-colors duration-200 active:scale-[0.99] min-h-[44px]`}
        onClick={toggleExpanded}
        onMouseDown={handleHeaderMouseDown}
        role="button"
        tabIndex={0}
        onKeyDown={handleHeaderKeyDown}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        id={headerId}
        data-collapsible-disabled={collapseDisabled}
      >
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="flex-shrink-0 bg-white/80 rounded-lg p-2">
              <Icon className="h-5 w-5 text-gray-600" aria-hidden="true" />
            </div>
          )}
          <div className="flex flex-col justify-center gap-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3
                className={cn(
                  'text-lg font-semibold text-gray-900 break-words',
                  titleClassName,
                )}
                style={titleStyle}
              >
                {title}
              </h3>
            </div>
            {subtitle && (
              <p className="text-sm text-gray-500 break-words">{subtitle}</p>
            )}
            {description && (
              <p className="text-xs text-gray-400 sm:text-sm break-words">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1" />

        {counter !== undefined && (
          <div className="flex items-center justify-center flex-shrink-0">
            {(() => {
              // Check if counter is a capacity object or just a number
              const isCapacityObject = typeof counter === 'object' && 'available' in counter && 'capacity' in counter

              if (isCapacityObject) {
                const { available, capacity } = counter
                const hasFiniteCap =
                  typeof capacity === 'number' &&
                  capacity > 0 &&
                  typeof available === 'number'
                const isExceeded = hasFiniteCap && available < 0

                // If capacity is exceeded, show negative available value (e.g., -18)
                // Otherwise, use percentage-based colors
                const percentage =
                  hasFiniteCap && capacity > 0 ? (available / capacity) * 100 : 0

                // Determine color based on capacity exceeded or availability percentage
                // Use stronger red colors when capacity is exceeded
                const colorClasses = !hasFiniteCap
                  ? 'bg-slate-100 border-slate-300 text-slate-800'
                  : isExceeded
                    ? 'bg-red-200 border-red-600 text-red-950'
                    : percentage > 70
                      ? 'bg-green-100 border-green-400 text-green-800'
                      : percentage >= 30
                        ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
                        : 'bg-red-100 border-red-400 text-red-800'

                const labelColorClasses = !hasFiniteCap
                  ? 'text-slate-600'
                  : isExceeded
                    ? 'text-red-950 font-bold'
                    : percentage > 70
                      ? 'text-green-700'
                      : percentage >= 30
                        ? 'text-yellow-700'
                        : 'text-red-700'

                return (
                  <div
                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border-2 shadow-sm transition-all duration-200 ${colorClasses} flex-shrink-0`}
                    style={isExceeded ? {
                      backgroundColor: '#fecaca',
                      borderColor: '#dc2626',
                      color: '#1f2937'
                    } : undefined}
                    aria-label={
                      !hasFiniteCap
                        ? 'Nessun limite capienza configurato per questa fascia'
                        : isExceeded
                          ? `Capienza superata: ${available} disponibili (eccedenza di ${Math.abs(available)} posti su ${capacity} totali)`
                          : `${available} posti disponibili su ${capacity} totali`
                    }
                  >
                    <span className={`text-sm font-semibold ${isExceeded ? 'text-red-950' : ''}`} style={isExceeded ? { color: '#7f1d1d', fontWeight: 'bold' } : undefined}>
                      {hasFiniteCap ? `${available}/${capacity}` : '—'}
                    </span>
                    <span className={`text-xs font-medium ${labelColorClasses}`} style={isExceeded ? { color: '#7f1d1d', fontWeight: 'bold' } : undefined}>
                      {hasFiniteCap ? 'disponibili' : 'nessun limite'}
                    </span>
                  </div>
                )
              } else {
                // Legacy number counter - keep for backwards compatibility
                return (
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-al-ritrovo-primary text-white flex-shrink-0"
                    aria-label={`${counter} items`}
                  >
                    {counter}
                  </span>
                )
              }
            })()}
          </div>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-2 flex-shrink-0">
          {actions && <div className="flex items-center gap-2">{actions}</div>}
          {!collapseDisabled && (
            <div
              className="transition-transform duration-200"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
              aria-hidden="true"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {shouldRenderContent && (
        <div
          id={contentId}
          className={`border-t border-gray-200 transition-all duration-300 ease-in-out ${
            isClosing ? 'collapsible-content-leave' : 'collapsible-content-enter'
          }`}
          role="region"
          aria-labelledby={headerId}
          aria-hidden={!isExpanded}
          data-state={
            resolvedLoading
              ? 'loading'
              : error
                ? 'error'
                : resolvedEmpty
                  ? 'empty'
                  : 'default'
          }
        >
          {stateContent}

          {!stateContent && (
            <>
              {shouldWrapChildren ? (
                <div className={contentClassName}>{children}</div>
              ) : (
                children
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Predefined action buttons for common operations
export const CardActionButton = ({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}) => {
  const baseClasses =
    'inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors'
  const variantClasses = {
    default: 'text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50',
    primary: 'text-primary-800 bg-primary-100 hover:bg-primary-200 disabled:opacity-50',
    danger: 'text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50',
  }

  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses[variant]} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      disabled={disabled}
      aria-label={label}
    >
      <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
      {label}
    </button>
  )
}

export default CollapsibleCard
