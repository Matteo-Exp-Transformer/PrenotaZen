import React, { useCallback, useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui'

type InsetInputProps = React.ComponentProps<typeof Input>

import {
  BOOKING_PUBLIC_CONTENT_WIDTH,
  BOOKING_PUBLIC_FIELD_BOX,
  BOOKING_PUBLIC_FIELD_BOX_MULTILINE,
  BOOKING_PUBLIC_FIELD_INNER_INPUT,
  BOOKING_PUBLIC_FIELD_INNER_LABEL,
  BOOKING_PUBLIC_FIELD_INNER_LABEL_MULTILINE,
  BOOKING_PUBLIC_FIELD_INNER_TEXTAREA,
} from '@/features/booking/constants/bookingPublicFieldStyles'
import {
  BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
  BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
  shouldDismissBookingPublicAttention,
} from '@/features/booking/utils/bookingPublicFormAttention'

const MULTILINE_MIN_HEIGHT_PX = 24

function syncTextareaHeight(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.max(el.scrollHeight, MULTILINE_MIN_HEIGHT_PX)}px`
}

export type BookingPublicInsetFieldProps = InsetInputProps & {
  label: string
  hasError?: boolean
  /** Lampeggio attenzione finché l'utente non interagisce col controllo. */
  showAttention?: boolean
  onAttentionInteract?: () => void
  /** Testo libero a capo: la casella cresce in altezza (mobile / tablet / desktop). */
  multiline?: boolean
}

export const BookingPublicInsetField: React.FC<BookingPublicInsetFieldProps> = ({
  label,
  hasError = false,
  showAttention = false,
  onAttentionInteract,
  className,
  id,
  multiline = false,
  value,
  onChange,
  onFocus,
  ...inputProps
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stringValue = typeof value === 'string' || typeof value === 'number' ? String(value) : ''

  const adjustTextareaHeight = useCallback(() => {
    syncTextareaHeight(textareaRef.current)
  }, [])

  useLayoutEffect(() => {
    if (!multiline) return
    adjustTextareaHeight()
  }, [multiline, stringValue, adjustTextareaHeight])

  const fieldBoxClass = cn(hasError && 'border-red-500!')

  const inputControlId = id ? `${id}-control` : undefined

  const handleFieldInteract = (e: React.FocusEvent | React.PointerEvent | React.MouseEvent) => {
    if (showAttention && shouldDismissBookingPublicAttention(e)) {
      onAttentionInteract?.()
    }
    if (e.type === 'focus') {
      onFocus?.(e as React.FocusEvent<HTMLInputElement>)
    }
  }

  if (multiline) {
    const {
      type: _type,
      ...textareaProps
    } = inputProps as InsetInputProps

    return (
      <div
        id={id}
        data-booking-public-field-anchor
        className={cn(
          BOOKING_PUBLIC_CONTENT_WIDTH,
          BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
          showAttention && BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
          showAttention && 'rounded-lg',
        )}
      >
        <div className={cn(BOOKING_PUBLIC_FIELD_BOX_MULTILINE, fieldBoxClass)}>
          <label htmlFor={inputControlId} className={BOOKING_PUBLIC_FIELD_INNER_LABEL_MULTILINE}>
            {label}
          </label>
          <textarea
            ref={textareaRef}
            id={inputControlId}
            rows={1}
            value={value}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError && id ? `${id}-error` : undefined}
            className={cn(BOOKING_PUBLIC_FIELD_INNER_TEXTAREA, className)}
            onFocus={(e) => {
              handleFieldInteract(e)
              onFocus?.(e as unknown as React.FocusEvent<HTMLInputElement>)
            }}
            onPointerDown={handleFieldInteract}
            onChange={(e) => {
              onChange?.(e as unknown as React.ChangeEvent<HTMLInputElement>)
              requestAnimationFrame(() => syncTextareaHeight(textareaRef.current))
            }}
            {...(textareaProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      id={id}
      data-booking-public-field-anchor
      className={cn(
        BOOKING_PUBLIC_CONTENT_WIDTH,
        BOOKING_PUBLIC_FIELD_SCROLL_MARGIN,
        showAttention && BOOKING_PUBLIC_FIELD_ATTENTION_CLASS,
        showAttention && 'rounded-lg',
      )}
    >
      <div className={cn(BOOKING_PUBLIC_FIELD_BOX, fieldBoxClass)}>
        <label htmlFor={inputControlId} className={BOOKING_PUBLIC_FIELD_INNER_LABEL}>
          {label}
        </label>
        <Input
          id={inputControlId}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError && id ? `${id}-error` : undefined}
          className={cn(BOOKING_PUBLIC_FIELD_INNER_INPUT, className)}
          value={value}
          onFocus={(e) => {
            handleFieldInteract(e)
            onFocus?.(e)
          }}
          onPointerDown={handleFieldInteract}
          onChange={onChange}
          {...inputProps}
        />
      </div>
    </div>
  )
}

export function BookingPublicInsetFieldShell({
  label,
  htmlFor,
  hasError = false,
  children,
}: {
  label: string
  htmlFor?: string
  hasError?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={BOOKING_PUBLIC_CONTENT_WIDTH}>
      <div className={cn(BOOKING_PUBLIC_FIELD_BOX, hasError && 'border-red-500!')}>
        <label htmlFor={htmlFor} className={BOOKING_PUBLIC_FIELD_INNER_LABEL}>
          {label}
        </label>
        <div className="w-full min-w-0 flex-1 text-left">{children}</div>
      </div>
    </div>
  )
}
