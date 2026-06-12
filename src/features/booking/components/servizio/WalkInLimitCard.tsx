import type { FC, FormEvent } from 'react'
import { useEffect, useMemo, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Input, Label } from '@/components/ui'
import {
  useRestaurantSetting,
  useUpsertRestaurantSetting,
} from '@/features/booking/hooks/useRestaurantSetting'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'

const UNSAVED_SOURCE_ID = 'servizio-walk-in-limit'

export const WalkInLimitCard: FC = () => {
  const upsert = useUpsertRestaurantSetting()
  const [value, setValue] = useState<number | ''>('')
  const [savedValue, setSavedValue] = useState<number | ''>('')

  const {
    data: loadedValue,
    isPending,
    isSuccess,
    error,
  } = useRestaurantSetting('walk_in_max_guests', { authenticated: true })

  const {
    registerUnsavedSource,
    registerUnsavedHandlers,
    clearUnsavedSource,
  } = useUnsavedChangesGuard()

  useEffect(() => {
    if (!isSuccess) return
    const next = loadedValue ?? ''
    setValue(next)
    setSavedValue(next)
  }, [isSuccess, loadedValue])

  const isDirty = useMemo(() => value !== savedValue, [savedValue, value])

  const discardDraft = useCallback(() => {
    setValue(savedValue)
  }, [savedValue])

  const saveDraft = useCallback(() => {
    if (value === '') return
    upsert.mutate([{ key: 'walk_in_max_guests', value }], {
      onSuccess: () => setSavedValue(value),
    })
  }, [upsert, value])

  useEffect(() => {
    if (!isDirty) {
      clearUnsavedSource(UNSAVED_SOURCE_ID)
      return
    }
    registerUnsavedSource(UNSAVED_SOURCE_ID, 'Limite coperti walk-in', true)
    return () => clearUnsavedSource(UNSAVED_SOURCE_ID)
  }, [clearUnsavedSource, isDirty, registerUnsavedSource])

  useEffect(() => {
    if (!isDirty) {
      registerUnsavedHandlers(UNSAVED_SOURCE_ID, null)
      return
    }
    registerUnsavedHandlers(UNSAVED_SOURCE_ID, {
      saveAll: saveDraft,
      discardAll: discardDraft,
    })
    return () => registerUnsavedHandlers(UNSAVED_SOURCE_ID, null)
  }, [discardDraft, isDirty, registerUnsavedHandlers, saveDraft])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveDraft()
  }

  if (error) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
        Impossibile caricare il limite walk-in. {(error as Error).message}
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-(--color-border) bg-surface px-5 py-5 shadow-sm md:px-6 md:py-6">
      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-md flex-col items-center gap-3 text-center">
        <h2 className="text-title-card font-semibold text-primary-900">Limite coperti walk-in</h2>
        <p className="text-body text-(--color-text-muted)">
          Numero massimo di coperti per una singola prenotazione walk-in dalla Home.
        </p>
        {isPending && !isSuccess ? (
          <div className="flex items-center gap-2 py-2 text-sm text-(--color-text-muted)">
            <Loader2 className="h-4 w-4 animate-spin text-primary-600" aria-hidden />
            Caricamento…
          </div>
        ) : (
          <>
            <div className="w-full space-y-2">
              <Label htmlFor="servizio_walk_in_max_guests" className="sr-only">
                Limite coperti walk-in
              </Label>
              <Input
                id="servizio_walk_in_max_guests"
                type="number"
                min={0}
                max={500}
                value={value}
                disabled={upsert.isPending}
                placeholder=""
                className="text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    setValue('')
                    return
                  }
                  const n = parseInt(raw, 10)
                  if (!Number.isNaN(n)) setValue(n)
                }}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={upsert.isPending || value === '' || !isDirty}
            >
              {upsert.isPending ? 'Salvataggio…' : 'Salva limite'}
            </Button>
          </>
        )}
      </form>
    </section>
  )
}
