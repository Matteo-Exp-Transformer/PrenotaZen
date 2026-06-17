import type { FC } from 'react'
import { Label } from '@/components/ui'
import type { CadenceType, CadenceConfig } from '@/features/booking/hooks/useEmailCampaignMutations'

export type { CadenceType, CadenceConfig }

interface Props {
  cadenceType: CadenceType
  cadenceConfig: CadenceConfig | null
  onChange: (type: CadenceType, config: CadenceConfig | null) => void
}

const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

export const CampaignCadenceSelector: FC<Props> = ({ cadenceType, cadenceConfig, onChange }) => {
  const handleTypeChange = (type: CadenceType) => {
    let config: CadenceConfig | null = null
    if (type === 'weekly') config = { weekday: 0 }
    if (type === 'monthly') config = { day_of_month: 1 }
    if (type === 'custom') config = { interval_days: 7 }
    onChange(type, config)
  }

  return (
    <div className="space-y-3">
      <Label>Cadenza (opzionale)</Label>

      <div className="flex flex-wrap gap-2">
        {([
          ['none', 'Nessuna (solo manuale)'],
          ['weekly', 'Settimanale'],
          ['monthly', 'Mensile'],
          ['custom', 'Personalizzata'],
        ] as [CadenceType, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => handleTypeChange(value)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors cursor-pointer ${
              cadenceType === value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-slate-700 border-slate-300 hover:border-primary-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {cadenceType === 'weekly' && (
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Giorno della settimana</label>
          <select
            value={cadenceConfig?.weekday ?? 0}
            onChange={(e) => onChange('weekly', { weekday: Number(e.target.value) })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            {WEEKDAYS.map((day, i) => (
              <option key={i} value={i}>
                {day}
              </option>
            ))}
          </select>
        </div>
      )}

      {cadenceType === 'monthly' && (
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Giorno del mese (1–28)</label>
          <input
            type="number"
            min={1}
            max={28}
            value={cadenceConfig?.day_of_month ?? 1}
            onChange={(e) =>
              onChange('monthly', { day_of_month: Math.min(28, Math.max(1, Number(e.target.value))) })
            }
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      )}

      {cadenceType === 'custom' && (
        <div className="space-y-1">
          <label className="text-sm text-slate-600">Ogni quanti giorni</label>
          <input
            type="number"
            min={1}
            max={365}
            value={cadenceConfig?.interval_days ?? 7}
            onChange={(e) =>
              onChange('custom', { interval_days: Math.max(1, Number(e.target.value)) })
            }
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
      )}

      {cadenceType !== 'none' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          L'invio automatico secondo cadenza sarà attivato a breve. Per ora usa il pulsante «Invia
          ora» per spedire manualmente.
        </div>
      )}
    </div>
  )
}
