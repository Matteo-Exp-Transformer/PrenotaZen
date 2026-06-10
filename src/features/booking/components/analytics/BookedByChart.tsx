import type { FC } from 'react'
import type { PieLabelRenderProps } from 'recharts'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const SOURCE_LABELS: Record<string, string> = {
  public_form: 'Form pubblico',
  manual: 'Admin',
  walk_in: 'Walk-in',
  phone: 'Telefono',
  google: 'Google',
}

const COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e']

interface BookedByChartProps {
  data: { source: string; count: number; percentage: number }[]
  isLoading?: boolean
}

interface TooltipPayload {
  name: string
  value: number
  payload: { percentage: number }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-lg border border-(--color-border) bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-primary-900">{item.name}</p>
      <p className="text-(--color-text-muted)">
        {item.value} prenotazioni ({item.payload.percentage}%)
      </p>
    </div>
  )
}

export const BookedByChart: FC<BookedByChartProps> = ({ data, isLoading }) => {
  if (isLoading || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-(--color-border) bg-surface text-sm text-(--color-text-muted)">
        {isLoading ? 'Caricamento…' : 'Nessun dato fonte prenotazione nel periodo.'}
      </div>
    )
  }

  const chartData = data.map((d) => ({
    name: SOURCE_LABELS[d.source] ?? d.source,
    value: d.count,
    percentage: d.percentage,
  }))

  return (
    <div className="rounded-xl border border-(--color-border) bg-surface p-4 shadow-sm">
      <h3 className="mb-3 text-title-card font-semibold text-primary-900">Fonte prenotazioni</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={80}
            dataKey="value"
            label={(props: PieLabelRenderProps) => {
              const entry = chartData[props.index as number]
              return `${entry?.name ?? ''} ${entry?.percentage ?? 0}%`
            }}
            labelLine={false}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs text-primary-900">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
