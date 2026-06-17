import React, { useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Contenuto opzionale sotto il titolo nell'header (es. link QR + copia). */
  headerBelow?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  showCloseButton?: boolean
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  headerBelow,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null)

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  }

  useEffect(() => {
    if (!isOpen) return
    const html = document.documentElement
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      html.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, closeOnEscape, onClose])

  // FIX 7 (16-06-26): inquadra il modale intero all'apertura. Niente z-index/struttura portal
  // toccati (LOCK) — solo focus + scroll-into-view sul dialog già renderizzato, per evitare che
  // un contenuto più alto del viewport apra "a metà" (centrato con titolo o footer fuori vista).
  // Sincrono (niente rAF): l'effect scatta già dopo il commit DOM, e un ritardo in più rischia di
  // cadere mentre l'utente ha già iniziato a digitare in un campo del modale, rubandogli il focus.
  // Dipende solo da `isOpen`: una volta per apertura, non a ogni re-render del genitore.
  useEffect(() => {
    if (!isOpen) return
    const dialog = modalRef.current
    if (!dialog) return
    dialog.focus({ preventScroll: true })
    // jsdom (test) non implementa scrollIntoView: guardia per non far esplodere le suite che
    // non lo stubbano esplicitamente — in browser reale è sempre presente.
    if (typeof dialog.scrollIntoView === 'function') {
      dialog.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
  }, [isOpen])

  if (!isOpen) return null

  /** Sopra overlay admin (z-50), sotto ToastContainer (~100000). Scroll esterno se il dialog è più alto del viewport. */
  const shellZ = 'z-[10050]'

  return createPortal(
    <div
      className={`fixed inset-0 ${shellZ} overflow-y-auto overscroll-contain`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="flex min-h-full items-center justify-center p-4 py-8 sm:py-10">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          aria-hidden
          onClick={closeOnOverlayClick ? onClose : undefined}
        />

        {/* Dialog */}
        <div
          ref={modalRef}
          tabIndex={-1}
          className={`relative z-10 my-auto w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-xl
            animate-fade-in max-h-[min(90vh,calc(100dvh-4rem))] overflow-y-auto`}
          role="document"
        >
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 id="modal-title" className="text-title-modal font-semibold text-slate-800">
              {title}
            </h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          {headerBelow ? <div className="mt-2">{headerBelow}</div> : null}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {children}
        </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
