import React, { useRef, useState } from 'react'
import { toast } from 'react-toastify'
import QRCode from 'qrcode'
import { Plus, Edit, Trash2, Copy, Download } from 'lucide-react'
import { Button } from '@/components/ui'
import { Modal } from '@/components/ui/Modal'
import { ADMIN_WARM_GRADIENT_SURFACE } from '@/lib/adminWarmGradientSurface'
import {
  useMenuQrCodes,
  useSaveMenuQrSettings,
  useDeleteMenuQrCode,
} from '../hooks/useMenuQrCodes'
import { useMenuCategories } from '../hooks/useMenuCategories'
import { MenuQrModal } from './MenuQrModal'
import { useTenantContext } from '@/contexts/TenantContext'
import { cn } from '@/lib/utils'
import type { MenuQrCode, MenuQrSettingsSavePayload } from '@/types/menu'
import {
  canAddMenuQrCode,
  getMenuQrCodeLimitMessage,
} from '../constants/menuMagazzinoLimits'
import { MenuMagazzinoLimitNotice } from './MenuMagazzinoLimitNotice'
function buildPublicUrl(tenantSlug: string | null, shortCode: string): string {
  return `${window.location.origin}/menu/${tenantSlug}/qr/${shortCode}`
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Link copiato')
  } catch {
    toast.error('Impossibile copiare')
  }
}

async function downloadQrPng(url: string, name: string) {
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-menu-${name.toLowerCase().replace(/\s+/g, '-')}.png`
    a.click()
  } catch {
    toast.error('Errore generazione QR')
  }
}

interface QrRowProps {
  qr: MenuQrCode
  tenantSlug: string | null
  onEdit: (qr: MenuQrCode) => void
  onDelete: (qr: MenuQrCode) => void
  isDeleting: boolean
}

function QrRow({ qr, tenantSlug, onEdit, onDelete, isDeleting }: QrRowProps) {
  const url = buildPublicUrl(tenantSlug, qr.short_code)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    if (!canvasRef.current) return
    void QRCode.toCanvas(canvasRef.current, url, { width: 80, margin: 1 })
  }, [url])

  return (
    <div className="menu-prices-item-row flex-wrap gap-3 px-4 py-4 min-h-[88px]">
      <canvas ref={canvasRef} width={80} height={80} className="shrink-0 rounded-lg" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{qr.name}</span>
          {!qr.is_active && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inattivo</span>
          )}
        </div>
        <p className="truncate text-xs text-gray-400">{url}</p>
      </div>

      <div className="menu-prices-item-actions flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="menu-prices-icon-btn"
          aria-label="Copia link"
          title="Copia link"
          onClick={() => void copyToClipboard(url)}
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="menu-prices-icon-btn"
          aria-label="Scarica QR PNG"
          title="Scarica QR PNG"
          onClick={() => void downloadQrPng(url, qr.name)}
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="menu-prices-icon-btn menu-prices-icon-btn--edit"
          aria-label={`Modifica ${qr.name}`}
          onClick={() => onEdit(qr)}
        >
          <Edit className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="menu-prices-icon-btn menu-prices-icon-btn--delete"
          aria-label={`Elimina ${qr.name}`}
          disabled={isDeleting}
          onClick={() => onDelete(qr)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function MenuQrManager() {
  const { tenantSlug } = useTenantContext()
  const { data: qrCodes = [], isLoading } = useMenuQrCodes()
  const { data: categories = [], refetch: refetchCategories } = useMenuCategories()

  const saveMutation = useSaveMenuQrSettings()
  const deleteMutation = useDeleteMenuQrCode()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MenuQrCode | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<{ isNew: boolean } | null>(null)
  const [qrToDelete, setQrToDelete] = useState<MenuQrCode | null>(null)

  const qrAtLimit = !canAddMenuQrCode(qrCodes.length)
  const qrLimitMessage = getMenuQrCodeLimitMessage()

  const openCreate = () => {
    if (qrAtLimit) {
      toast.error(qrLimitMessage)
      return
    }
    void refetchCategories()
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (qr: MenuQrCode) => {
    void refetchCategories()
    setEditing(qr)
    setModalOpen(true)
  }

  const handleDelete = (qr: MenuQrCode) => {
    setQrToDelete(qr)
  }

  const confirmDelete = () => {
    if (!qrToDelete) return
    deleteMutation.mutate(qrToDelete.id, {
      onSuccess: () => setQrToDelete(null),
    })
  }

  const handleSave = (payload: MenuQrSettingsSavePayload) => {
    const isNew = !editing
    saveMutation.mutate(payload, {
      onSuccess: () => {
        setModalOpen(false)
        setEditing(null)
        setSaveSuccess({ isNew })
      },
    })
  }

  const isPending = saveMutation.isPending

  return (
    <div
      className={cn('relative w-full rounded-2xl border-2 p-4 md:p-6 shadow-lg')}
      style={ADMIN_WARM_GRADIENT_SURFACE}
      role="region"
      aria-label="Gestione QR menu"
    >
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-600 sm:text-sm sm:flex-1">
            Ogni QR apre una versione pubblica del menu. Scansiona con il telefono per vedere l'anteprima.
          </p>
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="success"
              size="sm"
              type="button"
              onClick={openCreate}
              disabled={qrAtLimit}
              className="h-9 shrink-0 gap-1.5 px-4 py-0 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuovo QR
            </Button>
            {qrAtLimit && (
              <MenuMagazzinoLimitNotice message={qrLimitMessage} className="max-w-xs text-right" />
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {isLoading && <p className="py-8 text-center text-sm text-gray-500">Caricamento…</p>}
          {!isLoading && qrCodes.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 bg-white/60 py-12 text-center text-sm text-gray-600">
              Nessun QR ancora. Crea il primo con il pulsante sopra.
            </p>
          )}
          {qrCodes.map((qr) => (
            <QrRow
              key={qr.id}
              qr={qr}
              tenantSlug={tenantSlug}
              onEdit={openEdit}
              onDelete={handleDelete}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      </div>

      <MenuQrModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        isPending={isPending}
        editing={editing}
        categories={categories}
        tenantSlug={tenantSlug}
      />

      <Modal
        isOpen={saveSuccess !== null}
        onClose={() => setSaveSuccess(null)}
        title="Menù QR salvato"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          {saveSuccess?.isNew
            ? 'Salvato. Hai creato un nuovo codice e un nuovo link QR: condividili o stampa il QR dalla lista.'
            : 'Salvato. Le modifiche sono già visibili aprendo lo stesso link o la stessa stampa QR.'}
        </p>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" type="button" onClick={() => setSaveSuccess(null)}>
            OK
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={qrToDelete !== null}
        onClose={() => !deleteMutation.isPending && setQrToDelete(null)}
        title="Elimina menù QR"
        size="sm"
        closeOnOverlayClick={!deleteMutation.isPending}
        closeOnEscape={!deleteMutation.isPending}
      >
        <p className="text-sm text-gray-600">
          Eliminare il menù QR <strong className="font-semibold">{qrToDelete?.name}</strong>? Il link e la
          stampa QR smetteranno di funzionare. L&apos;operazione non si può annullare.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            disabled={deleteMutation.isPending}
            onClick={() => setQrToDelete(null)}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={deleteMutation.isPending}
            onClick={confirmDelete}
          >
            {deleteMutation.isPending ? 'Eliminazione…' : 'Elimina'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
