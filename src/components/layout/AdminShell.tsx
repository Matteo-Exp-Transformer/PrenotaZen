import type { FC } from 'react'
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DEFAULT_APP_THEME } from '@/features/booking/constants/appTheme'
import { useRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'
import {
  Home,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ConciergeBell,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminAuth } from '@/features/booking/hooks/useAdminAuth'
import { AdminDashboard } from '@/pages/AdminDashboard'
import { Button } from '@/components/ui'
import { useFeatures } from '@/hooks/useFeatures'
import { UnsavedChangesProvider, useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'
import {
  getAdminSectionPath,
  resolveAdminRouteFromPath,
  resolveAdminSectionFromPath,
  runGuardedAdminLogout,
  type AdminShellSection,
} from './adminShellRouting'

const AdminHomePage = lazy(() =>
  import('@/pages/AdminHomePage').then((m) => ({ default: m.AdminHomePage })),
)
const CrmPage = lazy(() => import('@/pages/CrmPage').then((m) => ({ default: m.CrmPage })))
const ServizioPage = lazy(() =>
  import('@/pages/ServizioPage').then((m) => ({ default: m.ServizioPage })),
)
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
)

const SectionFallback: FC = () => (
  <div className="flex h-32 items-center justify-center">
    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary-600" />
  </div>
)

type SidebarActiveItem = 'home' | 'analytics' | 'servizio' | 'crm' | 'dashboard-tab' | null

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 644px)').matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 644px)')
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function initials(user: { name?: string; email: string }): string {
  if (user.name?.trim()) {
    const parts = user.name.trim().split(/\s+/)
    const a = parts[0]?.[0]
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1]
    return ((a ?? '') + (b ?? '')).toUpperCase() || user.email[0]?.toUpperCase() || '?'
  }
  return user.email.slice(0, 2).toUpperCase()
}

const SIDEBAR_NAV_ITEMS: {
  id: string
  label: string
  icon: typeof Home
  section: AdminShellSection
  featureKey?: 'servizio' | 'crm' | 'analytics'
}[] = [
  {
    id: 'servizio',
    label: 'Servizio',
    icon: ConciergeBell,
    section: 'servizio',
    featureKey: 'servizio',
  },
  {
    id: 'crm',
    label: 'CRM Clienti',
    icon: Users,
    section: 'crm',
    featureKey: 'crm',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    section: 'analytics',
    featureKey: 'analytics',
  },
]

function sidebarItemForSection(section: AdminShellSection): SidebarActiveItem {
  if (section === 'home') return 'home'
  if (section === 'crm') return 'crm'
  if (section === 'servizio') return 'servizio'
  if (section === 'analytics') return 'analytics'
  return null
}

const AdminShellInner: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const isNarrow = useIsNarrow()
  const features = useFeatures()
  const [sidebarMode, setSidebarMode] = useState<'hidden' | 'icons' | 'expanded'>('icons')
  // section e activeSidebarItem sono DERIVATI dall'URL (unica fonte di verità).
  // Tenerli come stato sincronizzato via effetto causava un flash: setSection e
  // navigate (in openSection / exit) non sono atomici, quindi per 1-2 render la
  // sezione montata e l'URL puntavano a sezioni diverse e la sezione vecchia
  // riappariva per un istante. Stesso fix applicato ad AdminDashboard.activeTab.
  const section: AdminShellSection = resolveAdminSectionFromPath(location.pathname, features)
  const activeSidebarItem: SidebarActiveItem = sidebarItemForSection(section)
  const { user, logout } = useAdminAuth()
  const { confirmNavigation } = useUnsavedChangesGuard()
  const asideRef = useRef<HTMLDivElement | null>(null)

  const { data: savedAppTheme = DEFAULT_APP_THEME, isPending: isAppThemePending } =
    useRestaurantSetting('app_theme', { authenticated: true })

  useEffect(() => {
    const resolved = isAppThemePending ? DEFAULT_APP_THEME : savedAppTheme
    document.documentElement.setAttribute('data-admin-theme', resolved)
    // nessun cleanup: il tema deve persistere per tutta la sessione admin
  }, [savedAppTheme, isAppThemePending])

  const isDrawerOpen = sidebarMode === 'expanded'

  // section/activeSidebarItem derivano dall'URL (sopra). Qui resta solo la
  // canonicalizzazione del path (es. route sconosciuta → sezione di default).
  useEffect(() => {
    const resolvedRoute = resolveAdminRouteFromPath(location.pathname, features)
    if (location.pathname !== resolvedRoute.canonicalPath) {
      navigate(resolvedRoute.canonicalPath, { replace: true })
    }
  }, [features, location.pathname, navigate])

  // Click-outside: chiude la sidebar quando si clicca fuori dall'aside
  useEffect(() => {
    if (!isDrawerOpen) return
    const handlePointerDown = (e: PointerEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setSidebarMode('icons')
      }
    }
    // 'capture: true' intercetta prima che altri handler possano fermare la propagazione
    document.addEventListener('pointerdown', handlePointerDown, { capture: true })
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
  }, [isDrawerOpen])

  // Escape chiude la sidebar (torna a icons, non a hidden)
  useEffect(() => {
    if (!isDrawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarMode('icons')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDrawerOpen])

  const toggleSidebar = useCallback(() => {
    setSidebarMode((m) => (m === 'expanded' ? 'icons' : 'expanded'))
  }, [])

  const openSection = useCallback(
    (s: AdminShellSection) => {
      const sectionChange = s !== section
      // section/activeSidebarItem derivano dall'URL: basta navigare, lo stato segue.
      if (sectionChange) {
        const allowReturn = s === 'prenotazioni'
        void confirmNavigation(
          allowReturn ? { allowPrenotazioniDashboard: true } : undefined,
        ).then((ok) => {
          if (!ok) return
          if (isNarrow && sidebarMode === 'expanded') setSidebarMode('icons')
          navigate(getAdminSectionPath(s))
        })
        return
      }
      if (isNarrow && sidebarMode === 'expanded') setSidebarMode('icons')
      navigate(getAdminSectionPath(s))
    },
    [confirmNavigation, isNarrow, navigate, section, sidebarMode],
  )

  const exitBodyOverrideToDashboard = useCallback(() => {
    if (isNarrow && sidebarMode === 'expanded') setSidebarMode('icons')
    navigate(getAdminSectionPath('prenotazioni'))
  }, [isNarrow, navigate, sidebarMode])

  const handleLogout = useCallback(
    () => runGuardedAdminLogout(confirmNavigation, logout),
    [confirmNavigation, logout],
  )

  // Edition Classic: nessuna sidebar, AdminDashboard occupa tutta la pagina
  if (!features.sidebar) {
    return (
      <div className="flex min-h-screen flex-col">
        <AdminDashboard onLogout={handleLogout} />
      </div>
    )
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-(--color-bg)">
      {/* Backdrop scuro: reso quando la sidebar è espansa, a qualsiasi larghezza */}
      {isDrawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-7999 cursor-default border-0 bg-black/40 p-0"
          aria-label="Chiudi menu"
          onClick={() => setSidebarMode('icons')}
        />
      )}

      {/* Icona tonda flottante — visibile solo quando la sidebar è nascosta */}
      {sidebarMode === 'hidden' && (
        <button
          type="button"
          className="fixed left-3 top-3 z-8000 flex h-10 w-10 items-center justify-center rounded-full border border-(--color-border) bg-surface/70 shadow-sm backdrop-blur transition-colors hover:bg-primary-50"
          aria-label="Mostra menu"
          title="Mostra menu"
          onClick={() => setSidebarMode('icons')}
        >
          <ChevronRight className="h-5 w-5 text-primary-900" aria-hidden />
        </button>
      )}

      <aside
        ref={asideRef as unknown as React.Ref<HTMLElement>}
        className={cn(
          // Sempre fixed: la sidebar non sta MAI nel flusso, così non altera mai
          // la larghezza di <main>. Transiziona width (icons↔expanded) e transform
          // (icons↔hidden) per animazioni fluide senza scatti.
          'fixed inset-y-0 left-0 z-8000 flex h-full flex-col border-r border-(--color-border) bg-surface py-4 transition-[width,transform] duration-200 ease-out',
          sidebarMode === 'hidden' && '-translate-x-full',
          sidebarMode === 'icons' && 'w-16 translate-x-0',
          sidebarMode === 'expanded' && 'w-56 translate-x-0 shadow-xl',
        )}
        aria-label="Navigazione principale"
        aria-hidden={sidebarMode === 'hidden'}
        aria-expanded={isDrawerOpen}
      >
        <div className="flex flex-1 flex-col gap-1 px-2">
          {features.home && (
            <div
              className={cn(
                'mb-1 flex',
                isDrawerOpen ? 'items-center justify-between gap-1 px-1' : 'justify-center',
              )}
            >
              <button
                type="button"
                onClick={() => openSection('home')}
                title="Home"
                aria-label="Home"
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  activeSidebarItem === 'home'
                    ? 'bg-primary-600 text-white'
                    : 'text-primary-900 hover:bg-primary-50',
                  !isDrawerOpen && 'w-10 justify-center px-0',
                )}
              >
                <Home
                  className={cn(
                    'h-5 w-5 shrink-0',
                    activeSidebarItem === 'home' ? 'text-white' : 'text-primary-900',
                  )}
                  aria-hidden
                />
                {isDrawerOpen && <span className="truncate">Home</span>}
              </button>
              {isDrawerOpen && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-expanded={isDrawerOpen}
                  aria-label="Comprimi menu"
                  title="Comprimi menu"
                  onClick={toggleSidebar}
                  className="shrink-0 text-primary-900"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </Button>
              )}
            </div>
          )}
          {!features.home && isDrawerOpen && (
            <div className="mb-1 flex justify-end px-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-expanded={isDrawerOpen}
                aria-label="Comprimi menu"
                title="Comprimi menu"
                onClick={toggleSidebar}
                className="shrink-0 text-primary-900"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}

          <div className="my-1 border-t border-(--color-border)" />

          {/* Voci nav */}
          {SIDEBAR_NAV_ITEMS.filter((item) =>
            item.featureKey ? features[item.featureKey] : true,
          ).map(({ id, label, icon: Icon, section: itemSection }) => {
              const active =
                activeSidebarItem === id ||
                (!activeSidebarItem && section === itemSection)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => openSection(itemSection)}
                  title={label}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-600 text-white'
                      : 'text-primary-900 hover:bg-primary-50',
                    !isDrawerOpen && 'mx-auto w-10 justify-center px-0',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      active ? 'text-white' : 'text-primary-900',
                    )}
                    aria-hidden
                  />
                  {isDrawerOpen && <span className="truncate">{label}</span>}
                </button>
              )
            },
          )}

        </div>

        {/* Espandi / Nascondi — sopra profilo, solo mode icons */}
        {sidebarMode === 'icons' && (
          <div className="flex flex-col gap-1 px-2 pb-2">
            <div className="my-1 border-t border-(--color-border)" />
            <div className="flex flex-col items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-expanded={false}
                aria-label="Espandi menu"
                title="Espandi menu"
                onClick={toggleSidebar}
                className="text-primary-900"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Nascondi menu"
                title="Nascondi menu"
                onClick={() => setSidebarMode('hidden')}
                className="text-primary-900"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {/* Footer sidebar: utente + logout */}
        <div className="mt-auto flex flex-col gap-2 border-t border-(--color-border) px-2 pt-3">
          {user && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-xl px-2 py-1.5 text-primary-900',
                !isDrawerOpen && 'justify-center px-0',
              )}
              title={user.email}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-900"
                aria-hidden
              >
                {initials(user)}
              </span>
              {isDrawerOpen && (
                <span className="min-w-0 truncate text-xs font-medium text-(--color-text-muted)">
                  {user.email}
                </span>
              )}
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size={isDrawerOpen ? 'sm' : 'icon'}
            className={cn(
              'w-full text-primary-900',
              isDrawerOpen ? 'justify-start gap-2' : 'justify-center',
            )}
            onClick={() => void handleLogout()}
            title="Esci"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            {isDrawerOpen && <span className="min-w-0 truncate">Esci</span>}
          </Button>
        </div>
      </aside>

      {/* pl-16 presente solo se sidebar visibile (icons/expanded). In hidden
          il contenuto occupa tutta la larghezza disponibile. */}
      <main className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', sidebarMode !== 'hidden' && 'pl-16')}>
        {(section === 'prenotazioni' || section === 'home') && (
          <AdminDashboard
            onLogout={handleLogout}
            bodyOverride={
              section === 'home' && features.home ? (
                <Suspense fallback={<SectionFallback />}>
                  <AdminHomePage
                    onOpenCrm={() => openSection('crm')}
                    onOpenServizio={() => openSection('servizio')}
                  />
                </Suspense>
              ) : undefined
            }
            onBodyOverrideExit={exitBodyOverrideToDashboard}
          />
        )}

        {section !== 'prenotazioni' && section !== 'home' && (
          <div className="flex flex-col">
            {/* Barra X — in flusso normale, spinge il contenuto in basso */}
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => openSection('prenotazioni')}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--color-border) bg-surface text-primary-900 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="Torna alla dashboard"
                title="Torna alla dashboard"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <Suspense fallback={<SectionFallback />}>
              {section === 'crm' && features.crm && <CrmPage />}
              {section === 'servizio' && features.servizio && <ServizioPage />}
              {section === 'analytics' && features.analytics && <AnalyticsPage />}
            </Suspense>
          </div>
        )}
      </main>
    </div>
  )
}

export const AdminShell: FC = () => (
  <UnsavedChangesProvider>
    <AdminShellInner />
  </UnsavedChangesProvider>
)
