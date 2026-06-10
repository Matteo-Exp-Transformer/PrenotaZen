import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { UnsavedNavigationGuardModal } from '@/features/booking/components/settings/SettingsSaveUi'

type UnsavedEntry = {
  label: string
  dirty: boolean
}

export type UnsavedSourceHandlers = {
  saveAll: () => void | Promise<void>
  discardAll: () => void
}

export type UnsavedChangesGuardOptions = {
  /** Consente di tornare alla dashboard prenotazioni (es. da Home overlay o CRM) pur con modifiche aperte. */
  allowPrenotazioniDashboard?: boolean
}

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean
  registerUnsavedSource: (id: string, label: string, dirty: boolean) => void
  registerUnsavedHandlers: (id: string, handlers: UnsavedSourceHandlers | null) => void
  clearUnsavedSource: (id: string) => void
  /** @deprecated Preferire `confirmNavigation`. Restituisce false se ci sono modifiche (mostra modale). */
  guardNavigation: (options?: UnsavedChangesGuardOptions) => boolean
  /** Modale guard: true = procedi, false = resta. */
  confirmNavigation: (options?: UnsavedChangesGuardOptions) => Promise<boolean>
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null)

export const UnsavedChangesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<Record<string, UnsavedEntry>>({})
  const handlersRef = useRef<Record<string, UnsavedSourceHandlers>>({})
  const [guardOpen, setGuardOpen] = useState(false)
  const [guardPending, setGuardPending] = useState(false)
  const guardResolveRef = useRef<((proceed: boolean) => void) | null>(null)
  const guardOptionsRef = useRef<UnsavedChangesGuardOptions | undefined>(undefined)

  const registerUnsavedSource = useCallback((id: string, label: string, dirty: boolean) => {
    setEntries((prev) => {
      if (!dirty) {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }
      return { ...prev, [id]: { label, dirty: true } }
    })
  }, [])

  const registerUnsavedHandlers = useCallback(
    (id: string, handlers: UnsavedSourceHandlers | null) => {
      if (handlers == null) {
        delete handlersRef.current[id]
        return
      }
      handlersRef.current[id] = handlers
    },
    [],
  )

  const clearUnsavedSource = useCallback((id: string) => {
    setEntries((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const dirtyEntries = useMemo(
    () => Object.entries(entries).filter(([, entry]) => entry.dirty),
    [entries],
  )
  const hasUnsavedChanges = dirtyEntries.length > 0
  const dirtyLabels = useMemo(
    () => dirtyEntries.map(([, entry]) => entry.label).filter(Boolean),
    [dirtyEntries],
  )

  const closeGuard = useCallback((proceed: boolean) => {
    setGuardOpen(false)
    setGuardPending(false)
    const resolve = guardResolveRef.current
    guardResolveRef.current = null
    guardOptionsRef.current = undefined
    resolve?.(proceed)
  }, [])

  const confirmNavigation = useCallback(
    (options?: UnsavedChangesGuardOptions): Promise<boolean> => {
      if (!hasUnsavedChanges) return Promise.resolve(true)
      if (options?.allowPrenotazioniDashboard) return Promise.resolve(true)

      return new Promise<boolean>((resolve) => {
        guardResolveRef.current = resolve
        guardOptionsRef.current = options
        setGuardOpen(true)
      })
    },
    [hasUnsavedChanges],
  )

  const guardNavigation = useCallback(
    (options?: UnsavedChangesGuardOptions) => {
      if (!hasUnsavedChanges) return true
      if (options?.allowPrenotazioniDashboard) return true
      void confirmNavigation(options)
      return false
    },
    [confirmNavigation, hasUnsavedChanges],
  )

  const runSaveAllDirty = useCallback(async () => {
    const dirtyIds = dirtyEntries.map(([id]) => id)
    for (const id of dirtyIds) {
      const handlers = handlersRef.current[id]
      if (handlers) {
        await Promise.resolve(handlers.saveAll())
      }
    }
  }, [dirtyEntries])

  const runDiscardAllDirty = useCallback(() => {
    const dirtyIds = dirtyEntries.map(([id]) => id)
    for (const id of dirtyIds) {
      const handlers = handlersRef.current[id]
      handlers?.discardAll()
    }
  }, [dirtyEntries])

  const handleStay = useCallback(() => {
    closeGuard(false)
  }, [closeGuard])

  const handleSaveAndContinue = useCallback(async () => {
    setGuardPending(true)
    try {
      await runSaveAllDirty()
      closeGuard(true)
    } catch {
      setGuardPending(false)
    }
  }, [closeGuard, runSaveAllDirty])

  const handleDiscardAndContinue = useCallback(() => {
    runDiscardAllDirty()
    closeGuard(true)
  }, [closeGuard, runDiscardAllDirty])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const value = useMemo(
    () => ({
      hasUnsavedChanges,
      registerUnsavedSource,
      registerUnsavedHandlers,
      clearUnsavedSource,
      guardNavigation,
      confirmNavigation,
    }),
    [
      hasUnsavedChanges,
      registerUnsavedSource,
      registerUnsavedHandlers,
      clearUnsavedSource,
      guardNavigation,
      confirmNavigation,
    ],
  )

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <UnsavedNavigationGuardModal
        isOpen={guardOpen}
        dirtyLabels={dirtyLabels}
        pending={guardPending}
        onStay={handleStay}
        onSaveAndContinue={() => void handleSaveAndContinue()}
        onDiscardAndContinue={handleDiscardAndContinue}
      />
    </UnsavedChangesContext.Provider>
  )
}

export function useUnsavedChangesGuard() {
  const ctx = useContext(UnsavedChangesContext)
  if (!ctx) {
    throw new Error('useUnsavedChangesGuard must be used inside UnsavedChangesProvider')
  }
  return ctx
}
