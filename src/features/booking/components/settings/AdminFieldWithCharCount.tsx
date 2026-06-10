import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { cn } from '@/lib/utils'

export function AdminFieldWithCharCount({
  id,
  label,
  value,
  maxLength,
  onChange,
  placeholder,
  singleLine = false,
}: {
  id?: string
  label: string
  value: string
  maxLength: number
  onChange: (value: string) => void
  placeholder?: string
  singleLine?: boolean
}) {
  return (
    <div className="w-full min-w-0 space-y-1.5">
      <Label htmlFor={id} className="block text-sm">
        {label}
      </Label>
      {singleLine ? (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onBlur={(e) => {
            const trimmed = e.target.value.trim()
            if (trimmed !== value) onChange(trimmed)
          }}
          maxLength={maxLength}
          placeholder={placeholder}
          className="w-full"
        />
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onBlur={(e) => {
            const trimmed = e.target.value.trim()
            if (trimmed !== value) onChange(trimmed)
          }}
          maxLength={maxLength}
          rows={3}
          placeholder={placeholder}
          className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      )}
      <p
        className={cn(
          'text-right text-[11px] tabular-nums',
          value.length >= maxLength ? 'text-red-500' : 'text-slate-400',
        )}
      >
        {value.length}/{maxLength}
      </p>
    </div>
  )
}
