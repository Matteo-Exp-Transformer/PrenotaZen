import type { FC } from 'react'
import { useState } from 'react'
import { ConciergeBell, Loader2, Clock, UserPlus, Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useHomeStats } from '@/features/booking/hooks/useHomeStats'
import { useBookingStats } from '@/features/booking/hooks/useBookingQueries'
import { WalkInModal } from '@/features/booking/components/home/WalkInModal'
import { ShiftBriefingModal } from '@/features/booking/components/home/ShiftBriefingModal'
import { useRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'
import { NotifyNavShinyLayers } from '@/components/ui'
import { useFeatures } from '@/hooks/useFeatures'

export interface AdminHomePageProps {
  onOpenCrm: () => void
  onOpenServizio: () => void
}

interface QuickNavButtonProps {
  icon: typeof ConciergeBell
  label: string
  description: string
  onClick: () => void
}

const QuickNavButton: FC<QuickNavButtonProps> = ({
  icon: Icon,
  label,
  description,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group flex items-center gap-3 rounded-xl border border-(--color-border) bg-surface p-4 text-left shadow-sm transition-colors',
      'hover:border-primary-300 hover:bg-primary-50',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
    )}
  >
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 transition-colors group-hover:bg-primary-200"
    >
      <Icon className="h-5 w-5" />
    </span>
    <span className="flex min-w-0 flex-col">
      <span className="text-label truncate font-semibold text-primary-900">{label}</span>
      <span className="text-micro truncate text-(--color-text-muted)">{description}</span>
    </span>
  </button>
)

interface StatCardProps {
  label: string
  value: number
  isLoading?: boolean
  /** Mostra effetto shiny+pulse quando true */
  highlight?: boolean
}

const StatCard: FC<StatCardProps> = ({ label, value, isLoading, highlight }) => (
  <div
    className={cn(
      'relative overflow-hidden rounded-xl border border-(--color-border) bg-surface p-4 shadow-sm md:p-5',
      highlight && 'admin-nav-notify-pulse-wrap',
    )}
  >
    {highlight && <NotifyNavShinyLayers />}
    <p className="text-label relative z-10 font-medium uppercase tracking-wide text-(--color-text-muted)">
      {label}
    </p>
    <div className="relative z-10 mt-2 flex min-h-8 items-baseline gap-1 md:min-h-9">
      {isLoading ? (
        <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary-600" aria-hidden />
      ) : (
        <span className="text-stat-big tabular-nums text-primary-900">
          {value}
        </span>
      )}
    </div>
  </div>
)

export const AdminHomePage: FC<AdminHomePageProps> = ({
  onOpenCrm: _onOpenCrm,
  onOpenServizio,
}) => {
  const features = useFeatures()
  const { stats: homeStats, upcoming, isLoading, error } = useHomeStats()
  const { data: globalStats } = useBookingStats()
  const { data: businessHoursRaw } = useRestaurantSetting('business_hours')

  const [walkInOpen, setWalkInOpen] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(false)

  // Count globale pending (stesso valore del tab header "Prenotazioni")
  const pendingGlobal = globalStats?.pending ?? 0

  return (
    <div className="min-h-0 flex-1 bg-(--color-bg) px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <h1 className="text-title-page font-bold text-primary-900">Home</h1>
          <p className="text-body mt-1 text-(--color-text-muted)">
            Riepilogo della giornata e accesso rapido alle sezioni principali.
          </p>
        </header>

        {/* Quick-nav: Servizio (pro), Walk-in, Briefing */}
        <nav
          aria-label="Scorciatoie sezioni dashboard"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.servizio && (
            <QuickNavButton
              icon={ConciergeBell}
              label="Servizio"
              description="Gestione tavoli e sale"
              onClick={onOpenServizio}
            />
          )}
          <QuickNavButton
            icon={UserPlus}
            label="Aggiungi walk-in"
            description="Cliente senza prenotazione"
            onClick={() => setWalkInOpen(true)}
          />
          <QuickNavButton
            icon={Printer}
            label="Briefing turno"
            description="Stampa o scarica PDF"
            onClick={() => setBriefingOpen(true)}
          />
        </nav>

        {/* Stat card — restano 3 colonne (non 4 come Classic): qui ci sono
            esattamente 3 statistiche, una 4ª colonna resterebbe vuota su desktop */}
        <section
          aria-label="Statistiche di oggi"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4"
        >
          <StatCard
            label="Prenotazioni oggi"
            value={homeStats.totalToday}
            isLoading={isLoading}
          />
          <StatCard
            label="Coperti confermati"
            value={homeStats.confirmedCoversToday}
            isLoading={isLoading}
          />
          <StatCard
            label="In attesa di conferma"
            value={pendingGlobal}
            isLoading={isLoading}
            highlight={pendingGlobal > 0}
          />
        </section>

        {/* Prossime 3 ore — nascosta se lista vuota (nessun messaggio placeholder) */}
        {(error || isLoading || upcoming.length > 0) && (
          <section className="space-y-3" aria-label="Prossime 3 ore">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-primary-700" aria-hidden />
              <h2 className="text-title-section font-semibold text-primary-900">
                Prossime 3 ore
              </h2>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <p className="font-semibold">Impossibile caricare le prossime prenotazioni.</p>
                <p className="mt-1">{error.message}</p>
              </div>
            ) : isLoading ? (
              <div
                className="flex h-24 items-center justify-center rounded-xl border border-(--color-border) bg-surface shadow-sm"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-hidden />
                <span className="sr-only">Caricamento prossime prenotazioni</span>
              </div>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-(--color-border) bg-surface px-4 py-3 shadow-sm"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-label truncate font-semibold text-primary-900">
                        {b.client_name}
                      </span>
                      <span className="text-micro text-(--color-text-muted)">
                        {b.num_guests} {b.num_guests === 1 ? 'coperto' : 'coperti'}
                      </span>
                    </div>
                    <span className="text-label shrink-0 rounded-lg bg-primary-50 px-3 py-1 font-semibold tabular-nums text-primary-900">
                      {b.start_time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <WalkInModal isOpen={walkInOpen} onClose={() => setWalkInOpen(false)} />
      <ShiftBriefingModal
        isOpen={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        businessHoursRaw={businessHoursRaw}
      />
    </div>
  )
}
