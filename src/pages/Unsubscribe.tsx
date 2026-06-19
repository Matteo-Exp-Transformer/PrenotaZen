import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, MailX } from 'lucide-react'

type PageState = 'loading' | 'success' | 'error'

export const UnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t')?.trim() ?? ''

  const [state, setState] = useState<PageState>(token ? 'loading' : 'error')

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  useEffect(() => {
    if (!token) return

    const revoke = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/unsubscribe?t=${encodeURIComponent(token)}`,
          {
            headers: {
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              apikey: SUPABASE_ANON_KEY,
            },
          },
        )
        setState(res.ok ? 'success' : 'error')
      } catch {
        setState('error')
      }
    }

    void revoke()
  }, [token, SUPABASE_URL, SUPABASE_ANON_KEY])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        {state === 'loading' && (
          <>
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-7 h-7 text-slate-400 animate-spin" />
            </div>
            <p className="text-slate-500">Elaborazione in corso…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-7 h-7 text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-3">Disiscrizione confermata</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Non riceverai più email promozionali da questo locale.
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              {token ? (
                <XCircle className="w-7 h-7 text-red-400" />
              ) : (
                <MailX className="w-7 h-7 text-red-400" />
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-3">Link non valido</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Il link non è valido o è già stato usato. Per assistenza, contatta direttamente il
              locale.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
