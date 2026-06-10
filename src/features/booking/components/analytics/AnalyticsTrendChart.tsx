import type { FC } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AnalyticsTrendPoint, DateRange } from '@/features/booking/hooks/useAnalytics'

export interface AnalyticsTrendChartProps {
  data: AnalyticsTrendPoint[]
  range: DateRange
  isEmpty: boolean
}

const tickStyle = { fill: 'var(--color-text-muted)', fontSize: 11 }

export const AnalyticsTrendChart: FC<AnalyticsTrendChartProps> = ({ data, range, isEmpty }) => {
  if (isEmpty) return null

  const xTickFormatter = (dateStr: string) => {
    try {
      return format(parseISO(`${dateStr}T12:00:00`), 'd/M')
    } catch {
      return dateStr
    }
  }

  return (
    <div className="w-full min-h-0 rounded-xl border border-(--color-border) bg-surface p-3 pt-4 shadow-sm md:p-4">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={tickStyle}
            tickFormatter={xTickFormatter}
            interval={range === 'month' ? 2 : range === 'year' ? 29 : 0}
          />
          <YAxis allowDecimals={false} tick={tickStyle} width={36} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.75rem',
            }}
            labelFormatter={(dateStr) => {
              try {
                return format(parseISO(`${dateStr}T12:00:00`), 'd MMM yyyy')
              } catch {
                return String(dateStr)
              }
            }}
          />
          <Legend
            wrapperStyle={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', paddingTop: '0.5rem' }}
          />
          <Bar dataKey="bookings" name="Prenotazioni" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Bar dataKey="covers" name="Coperti" fill="#0d9488" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
