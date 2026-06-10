/**
 * BookingPhotoStrip
 * Striscia verticale sinistra nella pagina Prenota.
 * Mostra tutte le foto di `public/asset/strip/` impilate verticalmente,
 * con la foto selezionata dall'admin (`selectedPhotoId`) mostrata per prima.
 * Effetto parallax leggero (0.4×): le foto scorrono più lentamente della pagina.
 *
 * LARGHEZZA: controllata dalla griglia padre in BookingRequestPage
 *   - mobile:  20vw  (~78px su 390px)
 *   - ≥900px:  25vw  (~360px su 1440px)
 *
 * CAMPO DB: `public_booking_strip_photo` in `restaurant_settings` (strip-01…strip-06).
 * Nessuna foto selezionata → mostra tutte in ordine, partendo da strip-01.
 *
 * Per aggiungere foto: aggiungere l'ID in BOOKING_STRIP_PHOTO_IDS
 * in bookingPageBackground.ts e mettere il file in public/asset/strip/.
 */

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  BOOKING_STRIP_PHOTO_IDS,
  bookingStripPhotoPublicHref,
  type BookingStripPhotoId,
} from '@/features/booking/constants/bookingPageBackground'

interface BookingPhotoStripProps {
  /** ID foto selezionata dall'admin (da DB). Se null: prima foto. */
  selectedPhotoId?: BookingStripPhotoId | null
  /** BASE_URL Vite: passare `import.meta.env.BASE_URL` dal componente parent. */
  viteBase: string
  className?: string
}

/** Velocità parallax: 0 = ferme, 1 = con la pagina, 0.4 = lente */
const PARALLAX_SPEED = 0.4

export const BookingPhotoStrip: React.FC<BookingPhotoStripProps> = ({
  selectedPhotoId,
  viteBase,
  className,
}) => {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const onScroll = () => setOffset(window.scrollY * PARALLAX_SPEED)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Ordina le foto mettendo la selezionata per prima, poi le altre in ordine
  const orderedIds = selectedPhotoId
    ? [selectedPhotoId, ...BOOKING_STRIP_PHOTO_IDS.filter((id) => id !== selectedPhotoId)]
    : [...BOOKING_STRIP_PHOTO_IDS]

  return (
    <div
      className={cn('sticky top-0 h-screen overflow-hidden', className)}
    >
      <div
        className="flex flex-col will-change-transform"
        style={{ transform: `translateY(-${offset}px)` }}
      >
        {/*
          Sequenza originale (6 foto × 120vh = 720vh).
          Con parallax 0.4×: scrollando 5000px il translateY è −2000px,
          quindi il contenuto interno deve superare 5000 + 2000 = 7000px.
          Su mobile 667px: 720vh ≈ 4800px — non sufficiente per form con 10 categorie.
          Ripetiamo il ciclo completo 3 volte in totale → 18 foto × 120vh = 2160vh ≈ 14400px su 667px.
          Questo copre qualsiasi form realistico senza rischi di gap neri.
        */}
        {orderedIds.map((id, i) => (
          <img
            key={id}
            src={bookingStripPhotoPublicHref(id, viteBase)}
            alt=""
            aria-hidden
            loading={i === 0 ? 'eager' : 'lazy'}
            className="w-full object-cover block"
            style={{ height: '120vh', minHeight: '120vh' }}
          />
        ))}
        {/* Ripetizione 2 e 3 del ciclo completo */}
        {[1, 2].flatMap((cycle) =>
          orderedIds.map((id) => (
            <img
              key={`r${cycle}-${id}`}
              src={bookingStripPhotoPublicHref(id, viteBase)}
              alt=""
              aria-hidden
              loading="lazy"
              className="w-full object-cover block"
              style={{ height: '120vh', minHeight: '120vh' }}
            />
          ))
        )}
      </div>
    </div>
  )
}
