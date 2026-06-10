import React, { useEffect, useRef, useState } from 'react'
import { useBlocker, useLocation, useNavigate } from 'react-router-dom'
import { useBookingStats } from '@/features/booking/hooks/useBookingQueries'
import { PendingRequestsTab } from '@/features/booking/components/PendingRequestsTab'
import {
  ArchiveFiltersCard,
  ArchiveTab,
  type ArchiveFilter,
  type SortOrder,
} from '@/features/booking/components/ArchiveTab'
import { BookingCalendarTab } from '@/features/booking/components/BookingCalendarTab'
import { AdminBookingForm } from '@/features/booking/components/AdminBookingForm'
import {
  MenuPricesHeroToolbar,
  MenuPricesTab,
  type MenuPricesTabHandle,
} from '@/features/booking/components/MenuPricesTab'
import {
  Calendar,
  Clock,
  Archive,
  Plus,
  User,
  LogOut,
  ChevronDown,
  ChevronUp,
  UtensilsCrossed,
  Store,
  ExternalLink,
} from 'lucide-react'
import { useTenantContext } from '@/contexts/TenantContext'
import { useAdminAuth } from '@/features/booking/hooks/useAdminAuth'
import { useRestaurantName } from '@/hooks/useRestaurantName'
import { DEFAULT_APP_THEME } from '@/features/booking/constants/appTheme'
import { useRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'
import {
  RestaurantSettingsIntro,
  RestaurantSettingsTab,
} from '@/features/booking/components/RestaurantSettingsTab'
import { NotifyNavShinyLayers } from '@/components/ui'
import { cn } from '@/lib/utils'
import { adminBlueCtaSurfaceClass } from '@/lib/adminBlueCtaClass'
import { useFeatures } from '@/hooks/useFeatures'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'
import {
  getAdminDashboardTabPath,
  resolveAdminDashboardTabFromPath,
  type AdminDashboardTab,
} from '@/components/layout/adminShellRouting'

type Tab = AdminDashboardTab
const ADMIN_HEADER_FALLBACK_NAME = 'Sistema Gestionale Prenotazioni'

/* ─── NavItem ─── */
interface NavItemProps {
  icon: React.ElementType
  label: string
  active?: boolean
  badge?: number
  /** Solo tab Prenotazioni (header): shiny + pulse attorno al bottone quando badge ≥ 1. */
  notifyHighlight?: boolean
  onClick: () => void
  mobileLabel?: string
}

const NavItem: React.FC<NavItemProps> = ({
  icon: Icon,
  label,
  active,
  badge,
  notifyHighlight,
  onClick,
  mobileLabel,
}) => {
  const hasBadge = badge != null && badge > 0
  const showNotifyDecor = Boolean(notifyHighlight && hasBadge)

  const inner = (
    <>
      <Icon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-white' : 'text-primary-900')} />
      <span className="hidden min-w-0 truncate text-center sm:inline">{label}</span>
      <span className="min-w-0 truncate text-center sm:hidden">{mobileLabel ?? label.split(' ')[0]}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex flex-shrink-0 items-center justify-center min-w-[20px] h-5 text-xs font-bold px-1.5 rounded-full border border-primary-200 bg-primary-100 text-primary-900">
          {badge}
        </span>
      )}
    </>
  )

  if (active) {
    const activeBtn = (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'admin-nav-item admin-nav-tab-active relative w-full min-h-11 flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-3 py-2.5 text-sm font-semibold text-white cursor-pointer',
          'border-solid shadow-none',
          showNotifyDecor && 'overflow-hidden',
        )}
      >
        {showNotifyDecor && <NotifyNavShinyLayers />}
        <span className="relative z-10 flex min-w-0 w-full items-center justify-center gap-1.5 sm:gap-2">
          {inner}
        </span>
      </button>
    )
    if (showNotifyDecor) {
      return (
        <div className="admin-nav-notify-pulse-wrap admin-nav-notify-pulse-wrap--header-ring min-w-0 max-w-full w-full rounded-xl">
          {activeBtn}
        </div>
      )
    }
    return activeBtn
  }

  const inactiveBtn = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'admin-nav-item relative w-full min-h-11 flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl border px-2 sm:px-3 py-2.5 text-sm font-medium text-primary-900 transition-all duration-150 cursor-pointer',
        showNotifyDecor && 'overflow-hidden admin-nav-notify-shiny-on-inactive',
      )}
    >
      {showNotifyDecor && <NotifyNavShinyLayers />}
      {showNotifyDecor ? (
        <span className="relative z-10 flex min-w-0 w-full items-center justify-center gap-1.5 sm:gap-2">
          {inner}
        </span>
      ) : (
        inner
      )}
    </button>
  )

  if (showNotifyDecor) {
    return (
      <div className="admin-nav-notify-pulse-wrap admin-nav-notify-pulse-wrap--header-ring min-w-0 max-w-full w-full rounded-xl">
        {inactiveBtn}
      </div>
    )
  }
  return inactiveBtn
}

/* ─── StatCard ─── */
const StatCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center shadow-sm">
    <p className="text-2xl font-black text-primary-900">{value}</p>
    <p className="text-xs font-medium text-[var(--color-text-muted)] mt-0.5">{label}</p>
  </div>
)

export type AdminDashboardProps = {
  /** Se passato, sostituisce il corpo dei tab con il contenuto fornito (es. AdminHomePage). Restano visibili solo banner ristorante e nav a 5 voci (niente sotto-righe per tab). */
  bodyOverride?: React.ReactNode
  /** Chiamato quando si clicca un NavItem mentre bodyOverride è attivo — segnala ad AdminShell di uscire dalla Home. */
  onBodyOverrideExit?: () => void
  /** Logout centralizzato dalla shell: passa dal guard modifiche non salvate. */
  onLogout?: () => void | Promise<void>
}

/* ─── Dashboard ─── */
export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  bodyOverride,
  onBodyOverrideExit,
  onLogout,
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  // activeTab è DERIVATO dall'URL (unica fonte di verità). Tenere uno stato
  // separato sincronizzato via effetto causava un flash: setActiveTab e
  // navigate non sono atomici (handleTabClick è async, ripreso dopo await),
  // quindi per 1-2 render stato e URL puntavano a tab diverse e il corpo
  // mostrava prima la tab nuova, poi la vecchia, poi di nuovo la nuova.
  const activeTab: Tab = resolveAdminDashboardTabFromPath(location.pathname) ?? 'calendar'
  const [calendarTargetDate, setCalendarTargetDate] = useState<string | null>(null)
  const [showNewBookingPanel, setShowNewBookingPanel] = useState(false)
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('all')
  const [archiveSortOrder, setArchiveSortOrder] = useState<SortOrder>('booking_date')
  const menuPricesTabRef = useRef<MenuPricesTabHandle>(null)
  const features = useFeatures()
  const { confirmNavigation, hasUnsavedChanges } = useUnsavedChangesGuard()
  const dashboardRootRef = useRef<HTMLDivElement>(null)
  const { data: stats } = useBookingStats()

  const dashboardTabHistoryBlocker = useBlocker(({ currentLocation, historyAction, nextLocation }) => {
    if (historyAction !== 'POP' || !hasUnsavedChanges) return false

    const currentTab = resolveAdminDashboardTabFromPath(currentLocation.pathname)
    const nextTab = resolveAdminDashboardTabFromPath(nextLocation.pathname)
    return Boolean(currentTab && nextTab && currentTab !== nextTab)
  })

  useEffect(() => {
    if (dashboardTabHistoryBlocker.state !== 'blocked') return

    void confirmNavigation().then((ok) => {
      if (ok) {
        dashboardTabHistoryBlocker.proceed()
        return
      }
      dashboardTabHistoryBlocker.reset()
    })
  }, [confirmNavigation, dashboardTabHistoryBlocker])

  useEffect(() => {
    if (activeTab !== 'pending') setShowNewBookingPanel(false)
  }, [activeTab])

  const { user, logout } = useAdminAuth()
  const { tenantSlug } = useTenantContext()
  const restaurantName = useRestaurantName()
  const appIconSrc = `${import.meta.env.BASE_URL}icons/Icona-per-adminPage-no-bg.png`
  const { data: savedAppTheme = DEFAULT_APP_THEME, isPending: isAppThemePending } =
    useRestaurantSetting('app_theme')

  useEffect(() => {
    const resolved = isAppThemePending ? DEFAULT_APP_THEME : savedAppTheme
    document.documentElement.setAttribute('data-admin-theme', resolved)
    // nessun cleanup: il tema deve persistere per tutta la sessione admin
  }, [savedAppTheme, isAppThemePending])

  const handleViewInCalendar = async (date: string) => {
    if (!(await confirmNavigation())) return
    setCalendarTargetDate(date)
    navigate(getAdminDashboardTabPath('calendar'))
  }

  const scrollToTop = () => {
    /** In layout Pro lo scroll è sul `<main>` di AdminShell, non sulla window. */
    const shellMain = dashboardRootRef.current?.closest('main')
    if (shellMain) {
      shellMain.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const footerQuickNavBtnClass = (isActive: boolean) =>
    cn(
      'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
      isActive
        ? 'border-2 border-primary-600 bg-primary-600 text-white'
        : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-primary-900 hover:bg-[var(--color-surface-2)]',
    )

  const footerPendingNotify = stats != null && stats.pending != null && stats.pending > 0

  const handleTabClick = async (tab: Tab) => {
    const tabChange = tab !== activeTab
    const navigationChange = tabChange || Boolean(bodyOverride)
    if (navigationChange && !(await confirmNavigation())) return
    if (bodyOverride) {
      onBodyOverrideExit?.()
      navigate(getAdminDashboardTabPath(tab))
      return
    }
    navigate(getAdminDashboardTabPath(tab))
  }

  const handleOpenPublicForm = () => {
    if (!tenantSlug) return
    window.open(`/prenota/${tenantSlug}`, '_blank', 'noopener,noreferrer')
  }

  const handleLogout = onLogout ?? logout

  /** Con bodyOverride (Home Pro) non mostrare statistiche Calendario, filtri Archivio, toolbar Menu, intro Impostazioni, blocco Nuova prenotazione. */
  const showTabSecondaryChrome = !bodyOverride

  return (
    <div ref={dashboardRootRef} className="flex min-h-0 flex-1 flex-col bg-[var(--color-bg)]">

      {/* Header */}
      <header className="relative z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)] shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pt-4 md:gap-5 md:px-6 md:pt-6">

          {/* Top bar con nome ristorante */}
          <div className="relative flex h-[92px] items-center justify-center overflow-hidden rounded-xl border border-primary-700/25 bg-primary-600 px-4 shadow-md sm:h-[106px] md:px-6">
            <div className="absolute right-2 top-1/2 z-2 flex h-14 w-14 shrink-0 -translate-y-1/2 items-center justify-center overflow-hidden rounded-xl bg-transparent p-0 sm:h-[100px] sm:w-[100px] md:right-3">
              <img
                src={appIconSrc}
                alt="Icona app"
                className="h-full w-full min-h-0 min-w-0 shrink-0 rounded-lg object-contain"
              />
            </div>
            <div className="w-full px-4 md:px-28 text-center pointer-events-none">
              <h1
                className="relative -left-16 mx-auto max-w-[calc(100%-4.5rem)] max-[645px]:left-0 max-[645px]:mx-auto max-[645px]:max-w-[min(100%,calc(100vw-5rem))] sm:max-w-[calc(100%-9rem)] md:max-w-[calc(100%-11rem)] overflow-hidden line-clamp-2 wrap-anywhere text-[22px] font-semibold italic font-serif tracking-wide text-white drop-shadow-sm leading-tight sm:text-2xl md:text-[28px] lg:text-[30px]"
              >
                {restaurantName || ADMIN_HEADER_FALLBACK_NAME}
              </h1>
            </div>
          </div>

          {/* Nav tab sempre visibile; sotto-righe tab (statistiche, filtri, …) nascoste con form nuova prenotazione aperto */}
          <div className="space-y-4 pb-4">
            <nav className="grid grid-cols-3 items-start gap-2 sm:grid-cols-5">
              <NavItem
                icon={Calendar}
                label="Calendario"
                active={activeTab === 'calendar'}
                onClick={() => handleTabClick('calendar')}
              />
              <NavItem
                icon={Clock}
                label="Prenotazioni"
                active={activeTab === 'pending'}
                badge={stats?.pending}
                notifyHighlight
                onClick={() => handleTabClick('pending')}
              />
              <NavItem
                icon={Archive}
                label="Archivio"
                active={activeTab === 'archive'}
                onClick={() => handleTabClick('archive')}
              />
              <NavItem
                icon={UtensilsCrossed}
                label="Menu"
                active={activeTab === 'menu'}
                onClick={() => handleTabClick('menu')}
              />
              <NavItem
                icon={Store}
                label="Impostazioni"
                mobileLabel="Impost."
                active={activeTab === 'settings-restaurant'}
                onClick={() => handleTabClick('settings-restaurant')}
              />
            </nav>

            {!showNewBookingPanel && (
              <>
                {activeTab === 'calendar' && showTabSecondaryChrome && (
                  <div className="grid grid-cols-2 min-[470px]:grid-cols-4 gap-2 md:gap-3">
                    <StatCard label="Oggi" value={stats?.totalDay || 0} />
                    <StatCard label="Settimana" value={stats?.totalWeek || 0} />
                    <StatCard label="Mese" value={stats?.totalMonth || 0} />
                    <StatCard label="Rifiutate" value={stats?.rejected || 0} />
                  </div>
                )}

                {activeTab === 'archive' && showTabSecondaryChrome && (
                  <ArchiveFiltersCard
                    filter={archiveFilter}
                    sortOrder={archiveSortOrder}
                    onFilterChange={setArchiveFilter}
                    onSortOrderChange={setArchiveSortOrder}
                  />
                )}

                {activeTab === 'menu' && showTabSecondaryChrome && (
                  <MenuPricesHeroToolbar
                    onAddProduct={() => menuPricesTabRef.current?.startAddProduct()}
                    onAddCategory={() => menuPricesTabRef.current?.startAddCategory()}
                    onPresetMenus={() => menuPricesTabRef.current?.openPresetMenus()}
                    onQrCodes={() => menuPricesTabRef.current?.openQrCodes()}
                    showQrCodes={features.qrMenu}
                  />
                )}

                {activeTab === 'settings-restaurant' && showTabSecondaryChrome && (
                  <RestaurantSettingsIntro />
                )}
              </>
            )}

            {activeTab === 'pending' && showTabSecondaryChrome && (
              <div className="space-y-3">
                <div className="mx-auto w-full max-w-md">
                  <NavItem
                    icon={ExternalLink}
                    label="Form Pubblico"
                    mobileLabel="Form"
                    onClick={handleOpenPublicForm}
                  />
                </div>
                <div className="w-full overflow-hidden rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] shadow-md min-h-0">
                <button
                  type="button"
                  onClick={() => setShowNewBookingPanel((p) => !p)}
                  className="admin-new-booking-collapse-trigger flex w-full items-center justify-between gap-3 rounded-t-xl px-4 py-[1.333rem] text-white transition-[background-image,transform] duration-200 md:gap-4 md:px-6 md:py-[1.667rem]"
                >
                  <div
                    className="flex min-w-0 flex-1 items-baseline justify-start gap-2.5 font-semibold tracking-tight text-white leading-[1.35]"
                    style={{ fontSize: 'calc(clamp(1.125rem, 0.9rem + 1.1vw, 1.625rem) * 2 / 3)' }}
                  >
                    <Plus
                      aria-hidden
                      className="w-[1.05em] h-[1.05em] shrink-0 translate-y-[0.06em] text-white/95"
                    />
                    <span className="min-w-0 truncate drop-shadow-sm">Inserisci Nuova Prenotazione</span>
                  </div>
                  <ChevronDown
                    aria-hidden
                    className={`h-5 w-5 shrink-0 text-white/90 transition-transform md:h-6 md:w-6 ${showNewBookingPanel ? 'rotate-180' : ''}`}
                  />
                </button>
                {showNewBookingPanel && (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5">
                    <AdminBookingForm />
                  </div>
                )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          'flex-1 w-full space-y-4 pb-12 md:pb-16',
          activeTab === 'archive' ? 'pt-3 md:pt-4' : 'pt-6',
          showNewBookingPanel && !bodyOverride && 'hidden',
        )}
      >
        {bodyOverride ?? (
          <div
            className={cn(
              'mx-auto w-full',
              activeTab === 'calendar'
                ? 'max-w-none px-1 md:px-1.5'
                : 'max-w-7xl px-4 md:px-6',
              activeTab === 'archive'
                ? 'pb-6 pt-3 md:pb-7 md:pt-4'
                : activeTab === 'settings-restaurant'
                  ? 'pb-5 pt-2 md:pb-6 md:pt-3'
                  : 'py-5 md:py-7',
              activeTab !== 'menu' && activeTab !== 'pending' && 'min-h-[500px]',
            )}
          >
            {activeTab === 'calendar' && <BookingCalendarTab initialDate={calendarTargetDate} />}
            {activeTab === 'pending' && <PendingRequestsTab />}
            {activeTab === 'archive' && (
              <ArchiveTab
                onViewInCalendar={handleViewInCalendar}
                filter={archiveFilter}
                sortOrder={archiveSortOrder}
              />
            )}
            {activeTab === 'menu' && (
              <MenuPricesTab ref={menuPricesTabRef} omitHeroSection />
            )}
            {activeTab === 'settings-restaurant' && <RestaurantSettingsTab />}
          </div>
        )}
      </main>

      <footer className="flex min-h-[62px] items-center border-t border-[var(--color-border)] bg-[var(--color-bg)] py-3">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="flex min-w-0 w-full flex-col items-stretch gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2 md:gap-3 md:px-6">
            <div className="flex min-w-0 shrink-0 items-center gap-2 sm:max-w-[min(40%,18rem)]">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100">
                <User className="h-3.5 w-3.5 text-primary-600" />
              </div>
              <span className="truncate text-xs font-medium text-[var(--color-text-muted)]">{user?.email}</span>
            </div>

            <nav
              className="flex flex-1 flex-wrap items-center justify-center gap-2"
              aria-label="Scorciatoie sezioni dashboard"
            >
              <button
                type="button"
                onClick={() => handleTabClick('calendar')}
                className={footerQuickNavBtnClass(activeTab === 'calendar')}
                aria-label="Calendario"
                title="Calendario"
              >
                <Calendar
                  className={cn('h-4 w-4 shrink-0', activeTab === 'calendar' ? 'text-white' : 'text-slate-800')}
                  aria-hidden
                />
              </button>
              {footerPendingNotify ? (
                <div className="admin-nav-notify-pulse-wrap shrink-0 self-center rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleTabClick('pending')}
                    className={cn(
                      footerQuickNavBtnClass(activeTab === 'pending'),
                      'footer-nav-notify-btn overflow-hidden',
                      activeTab !== 'pending' && 'footer-nav-notify-shiny-on-light',
                    )}
                    aria-label="Prenotazioni"
                    title="Prenotazioni"
                  >
                    <NotifyNavShinyLayers />
                    <span className="relative z-10 flex h-full w-full items-center justify-center">
                      <Clock
                        className={cn(
                          'h-4 w-4 shrink-0',
                          activeTab === 'pending' ? 'text-white' : 'text-slate-800',
                        )}
                        aria-hidden
                      />
                      <span className="pointer-events-none absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-primary-200 bg-primary-100 px-0.5 text-[10px] font-bold text-primary-900">
                        {stats.pending > 99 ? '99+' : stats.pending}
                      </span>
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTabClick('pending')}
                  className={footerQuickNavBtnClass(activeTab === 'pending')}
                  aria-label="Prenotazioni"
                  title="Prenotazioni"
                >
                  <Clock
                    className={cn(
                      'h-4 w-4 shrink-0',
                      activeTab === 'pending' ? 'text-white' : 'text-slate-800',
                    )}
                    aria-hidden
                  />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleTabClick('archive')}
                className={footerQuickNavBtnClass(activeTab === 'archive')}
                aria-label="Archivio"
                title="Archivio"
              >
                <Archive
                  className={cn('h-4 w-4 shrink-0', activeTab === 'archive' ? 'text-white' : 'text-slate-800')}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={() => handleTabClick('menu')}
                className={footerQuickNavBtnClass(activeTab === 'menu')}
                aria-label="Menu"
                title="Menu"
              >
                <UtensilsCrossed
                  className={cn('h-4 w-4 shrink-0', activeTab === 'menu' ? 'text-white' : 'text-slate-800')}
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={() => handleTabClick('settings-restaurant')}
                className={footerQuickNavBtnClass(activeTab === 'settings-restaurant')}
                aria-label="Impostazioni"
                title="Impostazioni"
              >
                <Store
                  className={cn(
                    'h-4 w-4 shrink-0',
                    activeTab === 'settings-restaurant' ? 'text-white' : 'text-slate-800',
                  )}
                  aria-hidden
                />
              </button>
            </nav>

            <div className="flex shrink-0 items-center justify-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={scrollToTop}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-slate-700 shadow-sm transition-colors hover:bg-[var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                aria-label="Torna in alto"
                title="Torna in alto"
              >
                <ChevronUp className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className={cn('flex shrink-0 items-center gap-2', adminBlueCtaSurfaceClass)}
              >
                <LogOut className="h-3.5 w-3.5 text-white" />
                <span className="text-white">Log-out</span>
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
