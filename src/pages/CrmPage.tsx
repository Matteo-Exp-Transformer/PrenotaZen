import type { FC } from 'react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { CustomerDirectoryTab } from '@/features/booking/components/crm/CustomerDirectoryTab'
import { EmailTemplatesTab } from '@/features/booking/components/crm/EmailTemplatesTab'
import { useUnsavedChangesGuard } from '@/contexts/UnsavedChangesContext'

type CrmTab = 'rubrica' | 'email'

const TABS: { id: CrmTab; label: string }[] = [
  { id: 'rubrica', label: 'Rubrica clienti' },
  { id: 'email', label: 'Personalizza email' },
]

export const CrmPage: FC = () => {
  const [activeTab, setActiveTab] = useState<CrmTab>('rubrica')
  const { confirmNavigation } = useUnsavedChangesGuard()

  // Cambiare tab abbandona l'editor email: se ci sono modifiche non salvate,
  // passa per il guard (modale Salva/Annulla/Esci) prima di cambiare.
  const handleTabChange = (id: CrmTab) => {
    if (id === activeTab) return
    void confirmNavigation().then((ok) => {
      if (ok) setActiveTab(id)
    })
  }

  return (
    <div className="min-h-0 flex-1 bg-(--color-bg) px-4 py-5 md:px-6 md:py-7">
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="text-title-page min-w-0 truncate font-bold text-primary-900">CRM Clienti</h1>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenuto tab */}
        {activeTab === 'rubrica' && <CustomerDirectoryTab />}
        {activeTab === 'email' && <EmailTemplatesTab />}
      </div>
    </div>
  )
}
