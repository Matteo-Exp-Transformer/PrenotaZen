import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveFieldStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

type FieldConfig = {
  value: string
  baseline: string
  normalize?: (value: string) => string
}

type UseDebouncedSettingsAutosaveOptions<K extends string> = {
  enabled: boolean
  tenantId: string | null | undefined
  debounceMs?: number
  minIntervalMs?: number
  fields: Record<K, FieldConfig>
  onSave: (keys: K[]) => Promise<void>
}

const DEFAULT_DEBOUNCE_MS = 1750
const DEFAULT_MIN_INTERVAL_MS = 2000
const SAVED_INDICATOR_MS = 2500

function valuesEqual(a: string, b: string, normalize?: (v: string) => string): boolean {
  const na = normalize ? normalize(a) : a
  const nb = normalize ? normalize(b) : b
  return na === nb
}

export function useDebouncedSettingsAutosave<K extends string>({
  enabled,
  tenantId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  fields,
  onSave,
}: UseDebouncedSettingsAutosaveOptions<K>) {
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields

  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const [fieldStatus, setFieldStatus] = useState<Record<K, AutosaveFieldStatus>>(() => {
    const initial = {} as Record<K, AutosaveFieldStatus>
    for (const key of Object.keys(fields) as K[]) {
      initial[key] = 'idle'
    }
    return initial
  })

  const pendingKeysRef = useRef(new Set<K>())
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimersRef = useRef(new Map<K, ReturnType<typeof setTimeout>>())
  const lastSaveAtRef = useRef(0)
  const inFlightRef = useRef(false)
  const queuedAfterFlightRef = useRef(false)

  const setStatus = useCallback((key: K, status: AutosaveFieldStatus) => {
    setFieldStatus((prev) => ({ ...prev, [key]: status }))
  }, [])

  const clearSavedTimer = useCallback((key: K) => {
    const t = savedTimersRef.current.get(key)
    if (t) {
      clearTimeout(t)
      savedTimersRef.current.delete(key)
    }
  }, [])

  const scheduleSavedFade = useCallback(
    (key: K) => {
      clearSavedTimer(key)
      savedTimersRef.current.set(
        key,
        setTimeout(() => {
          setStatus(key, 'idle')
          savedTimersRef.current.delete(key)
        }, SAVED_INDICATOR_MS),
      )
    },
    [clearSavedTimer, setStatus],
  )

  const cancelPending = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    pendingKeysRef.current.clear()
    for (const key of Object.keys(fieldsRef.current) as K[]) {
      clearSavedTimer(key)
      setStatus(key, 'idle')
    }
  }, [clearSavedTimer, setStatus])

  const collectDirtyKeys = useCallback((): K[] => {
    const dirty: K[] = []
    for (const key of Object.keys(fieldsRef.current) as K[]) {
      const { value, baseline, normalize } = fieldsRef.current[key]
      if (!valuesEqual(value, baseline, normalize)) {
        dirty.push(key)
      }
    }
    return dirty
  }, [])

  const runSave = useCallback(async () => {
    if (!enabled || !tenantId) return

    const keysToSave = collectDirtyKeys()
    pendingKeysRef.current.clear()
    if (keysToSave.length === 0) return

    const now = Date.now()
    const elapsed = now - lastSaveAtRef.current
    if (elapsed < minIntervalMs) {
      const wait = minIntervalMs - elapsed
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        void runSave()
      }, wait)
      for (const key of keysToSave) {
        pendingKeysRef.current.add(key)
        setStatus(key, 'pending')
      }
      return
    }

    if (inFlightRef.current) {
      queuedAfterFlightRef.current = true
      for (const key of keysToSave) {
        pendingKeysRef.current.add(key)
      }
      return
    }

    inFlightRef.current = true
    for (const key of keysToSave) {
      clearSavedTimer(key)
      setStatus(key, 'saving')
    }

    try {
      await onSaveRef.current(keysToSave)
      lastSaveAtRef.current = Date.now()
      for (const key of keysToSave) {
        setStatus(key, 'saved')
        scheduleSavedFade(key)
      }
    } catch {
      for (const key of keysToSave) {
        setStatus(key, 'error')
      }
    } finally {
      inFlightRef.current = false
      if (queuedAfterFlightRef.current) {
        queuedAfterFlightRef.current = false
        const stillDirty = collectDirtyKeys()
        if (stillDirty.length > 0) {
          for (const key of stillDirty) pendingKeysRef.current.add(key)
          debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null
            void runSave()
          }, minIntervalMs)
        }
      }
    }
  }, [
    collectDirtyKeys,
    clearSavedTimer,
    enabled,
    minIntervalMs,
    scheduleSavedFade,
    setStatus,
    tenantId,
  ])

  const scheduleDebouncedSave = useCallback(() => {
    if (!enabled || !tenantId) return
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      void runSave()
    }, debounceMs)
  }, [debounceMs, enabled, runSave, tenantId])

  const notifyFieldChange = useCallback(
    (key: K) => {
      if (!enabled || !tenantId) return
      const field = fieldsRef.current[key]
      if (!field) return
      if (valuesEqual(field.value, field.baseline, field.normalize)) {
        clearSavedTimer(key)
        setStatus(key, 'idle')
        pendingKeysRef.current.delete(key)
        return
      }
      pendingKeysRef.current.add(key)
      setStatus(key, 'pending')
      scheduleDebouncedSave()
    },
    [clearSavedTimer, enabled, scheduleDebouncedSave, setStatus, tenantId],
  )

  const flushField = useCallback(
    (key: K) => {
      if (!enabled || !tenantId) return
      const field = fieldsRef.current[key]
      if (!field || valuesEqual(field.value, field.baseline, field.normalize)) {
        clearSavedTimer(key)
        setStatus(key, 'idle')
        return
      }
      pendingKeysRef.current.add(key)
      setStatus(key, 'pending')
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      void runSave()
    },
    [clearSavedTimer, enabled, runSave, setStatus, tenantId],
  )

  useEffect(() => {
    if (!enabled) cancelPending()
  }, [enabled, cancelPending])

  useEffect(() => {
    cancelPending()
  }, [tenantId, cancelPending])

  useEffect(
    () => () => {
      cancelPending()
      for (const t of savedTimersRef.current.values()) clearTimeout(t)
      savedTimersRef.current.clear()
    },
    [cancelPending],
  )

  return {
    fieldStatus,
    notifyFieldChange,
    flushField,
    cancelPending,
  }
}
