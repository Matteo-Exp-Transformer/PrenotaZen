import type { FC, FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Input, Label } from '@/components/ui'
import { useUpsertRestaurantSetting } from '@/features/booking/hooks/useRestaurantSetting'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase, handleSupabaseError } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import { restaurantSettingRegistry } from '@/features/booking/lib/restaurantSettingRegistry'

export const WalkInLimitCard: FC = () => {
  const { tenantId } = useTenantContext()
  const upsert = useUpsertRestaurantSetting()
  const [value, setValue] = useState<number | ''>('')
  const hydratedRef = useRef(false)

  const { data: rawRow, isPending, isSuccess, error } = useQuery({
    queryKey: ['restaurant_settings', 'walk_in_max_guests', tenantId, 'raw-row'],
    queryFn: async () => {
      const { data, error: dbError } = await (supabase.from('restaurant_settings') as any)
        .select('setting_value')
        .eq('tenant_id', tenantId!)
        .eq('setting_key', 'walk_in_max_guests')
        .maybeSingle()

      if (dbError) {
        throw new Error(handleSupabaseError(dbError))
      }
      return data as { setting_value: unknown } | null
    },
    enabled: !!tenantId,
  })

  useEffect(() => {
    hydratedRef.current = false
    setValue('')
  }, [tenantId])

  useEffect(() => {
    if (!isSuccess || hydratedRef.current) return
    if (!rawRow) {
      setValue('')
    } else {
      setValue(restaurantSettingRegistry.walk_in_max_guests.parseFromDb(rawRow.setting_value))
    }
    hydratedRef.current = true
  }, [isSuccess, rawRow])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (value === '') return
    const err = restaurantSettingRegistry.walk_in_max_guests.validate(value)
    if (err) return
    upsert.mutate([{ key: 'walk_in_max_guests', value }])
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
              disabled={upsert.isPending || value === ''}
            >
              {upsert.isPending ? 'Salvataggio…' : 'Salva limite'}
            </Button>
          </>
        )}
      </form>
    </section>
  )
}
