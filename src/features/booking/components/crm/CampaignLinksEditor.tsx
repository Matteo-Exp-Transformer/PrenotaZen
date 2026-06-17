import type { FC } from 'react'
import { Button, Input, Label } from '@/components/ui'
import { isValidHttpUrl, type CampaignLink } from '@/lib/emailTemplates'

interface Props {
  links: CampaignLink[]
  onChange: (links: CampaignLink[]) => void
}

export const CampaignLinksEditor: FC<Props> = ({ links, onChange }) => {
  const update = (index: number, field: keyof CampaignLink, value: string) => {
    const next = links.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    onChange(next)
  }

  const add = () => {
    if (links.length >= 5) return
    onChange([...links, { label: '', url: '' }])
  }

  const remove = (index: number) => {
    onChange(links.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <Label>Pulsanti link (opzionali)</Label>

      {links.map((link, i) => {
        const urlInvalid = link.url.trim() !== '' && !isValidHttpUrl(link.url)
        return (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="Etichetta (es. Visita il sito)"
                value={link.label}
                onChange={(e) => update(i, 'label', e.target.value)}
              />
              <Input
                placeholder="URL (https://...)"
                value={link.url}
                onChange={(e) => update(i, 'url', e.target.value)}
                className={urlInvalid ? 'border-red-400 focus:ring-red-400' : ''}
              />
              {urlInvalid && (
                <p className="text-xs text-red-500">URL non valido — usa https:// o http://</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove(i)}
              className="mt-1 text-slate-400 hover:text-red-500 text-lg leading-none cursor-pointer"
              aria-label="Rimuovi link"
            >
              ×
            </button>
          </div>
        )
      })}

      {links.length < 5 && (
        <Button type="button" variant="secondary" size="sm" onClick={add}>
          + Aggiungi link
        </Button>
      )}
    </div>
  )
}
