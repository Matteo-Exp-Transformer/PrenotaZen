/**
 * InvitePage — pagina di registrazione tramite link di invito
 *
 * Accessibile via:
 *   /invite/:token          ← nuovo formato (token nel path)
 *   /register?token=...     ← vecchio formato (retrocompatibilità)
 */
import React, { useState, useEffect } from 'react'
import { useSearchParams, useParams, useNavigate, Link } from 'react-router-dom'
import { Input, Button, Label } from '@/components/ui'
import { ArrowRight, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface TokenValidationResult {
  valid: boolean
  email?: string
  organizationName?: string
}

type PageState = 'loading' | 'invalid' | 'form' | 'submitting' | 'success' | 'error'

export const InvitePage: React.FC = () => {
  const { token: tokenFromPath } = useParams<{ token?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Token può arrivare dal path (/invite/:token) o dalla query (/register?token=...)
  const token = tokenFromPath || searchParams.get('token')

  const [pageState, setPageState] = useState<PageState>('loading')
  const [tokenData, setTokenData] = useState<TokenValidationResult | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({})
  const [errorMessage, setErrorMessage] = useState('')

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Valida il token al mount
  useEffect(() => {
    if (!token) {
      setPageState('invalid')
      return
    }

    const validateToken = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/validate-invite?token=${encodeURIComponent(token)}`,
          {
            headers: {
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!res.ok) { setPageState('invalid'); return }

        const data: TokenValidationResult = await res.json()
        if (!data.valid) { setPageState('invalid'); return }

        setTokenData(data)
        if (data.email) setEmail(data.email)
        setPageState('form')
      } catch {
        setPageState('invalid')
      }
    }

    validateToken()
  }, [token, SUPABASE_URL, SUPABASE_ANON_KEY])

  // Redirect automatico dopo successo
  useEffect(() => {
    if (pageState !== 'success') return
    const t = setTimeout(() => navigate('/login'), 3000)
    return () => clearTimeout(t)
  }, [pageState, navigate])

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!email.trim()) e.email = 'Email obbligatoria'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email non valida'
    if (!password.trim()) e.password = 'Password obbligatoria'
    else if (password.length < 8) e.password = 'Minimo 8 caratteri'
    if (!confirmPassword.trim()) e.confirmPassword = 'Conferma password obbligatoria'
    else if (password !== confirmPassword) e.confirmPassword = 'Le password non corrispondono'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setPageState('submitting')
    setErrorMessage('')

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-invite`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, email, password }),
      })

      if (res.ok) { setPageState('success'); return }

      const errData = await res.json().catch(() => null)
      switch (res.status) {
        case 400: setErrorMessage(errData?.error || 'Dati non validi.'); break
        case 403: setErrorMessage('Non sei autorizzato per questo invito.'); break
        case 404: setErrorMessage('Link scaduto o non trovato.'); break
        case 429: setErrorMessage('Troppi tentativi. Riprova tra qualche minuto.'); break
        default:  setErrorMessage(errData?.error || 'Errore durante la registrazione.'); break
      }
      setPageState('error')
    } catch {
      setErrorMessage('Errore di connessione. Verifica la tua rete e riprova.')
      setPageState('error')
    }
  }

  /* ─── Loading ─── */
  if (pageState === 'loading') {
    return (
      <PageShell>
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Verifica link di invito...</p>
        </div>
      </PageShell>
    )
  }

  /* ─── Token non valido ─── */
  if (pageState === 'invalid') {
    return (
      <PageShell>
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-title-card font-bold text-slate-800 mb-2">Link non valido</h2>
          <p className="text-slate-500 text-sm mb-6">
            Il link è scaduto o non valido. Contatta l'amministratore per ottenerne uno nuovo.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            Vai al login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </PageShell>
    )
  }

  /* ─── Successo ─── */
  if (pageState === 'success') {
    return (
      <PageShell>
        <div className="text-center py-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-emerald-500" />
          </div>
          <h2 className="text-title-card font-bold text-slate-800 mb-2">Registrazione completata!</h2>
          <p className="text-slate-500 text-sm">Verrai reindirizzato al login tra qualche secondo...</p>
        </div>
      </PageShell>
    )
  }

  /* ─── Form ─── */
  const isSubmitting = pageState === 'submitting'

  return (
    <PageShell>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <img
            src={`${import.meta.env.BASE_URL}icons/icon-192-v2.png`}
            alt="Logo app"
            className="w-4 h-4 object-cover shrink-0 rounded-full overflow-hidden"
          />
        </div>
        <h2 className="text-title-card font-bold text-slate-800">
          Registrati per {tokenData?.organizationName || 'il ristorante'}
        </h2>
        <p className="text-slate-500 text-sm mt-1">Crea il tuo account amministratore</p>
      </div>

      {/* Errore */}
      {pageState === 'error' && errorMessage && (
        <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
            placeholder="admin@tuoristorante.it"
            disabled={isSubmitting || !!tokenData?.email}
            className={errors.email ? 'border-red-400 focus:ring-red-400' : ''}
          />
          {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
            placeholder="Minimo 8 caratteri"
            disabled={isSubmitting}
            className={errors.password ? 'border-red-400 focus:ring-red-400' : ''}
          />
          {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Conferma Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: undefined })) }}
            placeholder="Ripeti la password"
            disabled={isSubmitting}
            className={errors.confirmPassword ? 'border-red-400 focus:ring-red-400' : ''}
          />
          {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
        </div>

        <Button type="submit" fullWidth size="lg" disabled={isSubmitting} className="mt-1 group">
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Registrazione in corso...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Registrati
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          )}
        </Button>
      </form>

      <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Lock className="w-3.5 h-3.5" />
        <span>Registrazione sicura tramite invito</span>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        Hai già un account?{' '}
        <Link to="/login" className="text-primary-600 hover:underline font-medium">Accedi</Link>
      </p>
    </PageShell>
  )
}

/** Wrapper di layout condiviso */
const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-indigo-50 flex items-center justify-center p-4">
    <div className="w-full max-w-md animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        {children}
      </div>
    </div>
  </div>
)
