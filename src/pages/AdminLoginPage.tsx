import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAdminAuth } from '@/features/booking/hooks/useAdminAuth'
import { Input, Button, Label } from '@/components/ui'
import { ArrowRight } from 'lucide-react'

export const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubscriptionBanner, setShowSubscriptionBanner] = useState(false)

  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const bgFile = isMobile ? 'login/admin-login-bg-mobile.png' : 'login/admin-login-bg.png'
  const loginPageBgStyle: React.CSSProperties = {
    backgroundImage: `url(${import.meta.env.BASE_URL}${bgFile})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
  const loginSubmitStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: 'rgba(255, 255, 255, 0.9)',
    color: '#0f172a',
    WebkitTextFillColor: '#0f172a',
  }

  useEffect(() => {
    const revokedReason = sessionStorage.getItem('auth_revoked_reason')
    if (revokedReason === 'subscription_inactive') {
      setShowSubscriptionBanner(true)
      sessionStorage.removeItem('auth_revoked_reason')
    }
  }, [])

  const validate = (): boolean => {
    const newErrors: { email?: string; password?: string } = {}
    if (!email.trim()) {
      newErrors.email = 'Email obbligatoria'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email non valida'
    }
    if (!password.trim()) {
      newErrors.password = 'Password obbligatoria'
    } else if (password.length < 6) {
      newErrors.password = 'Password troppo corta (min. 6 caratteri)'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const result = await login(email, password)
      if (result.success) {
        toast.success('Accesso effettuato!')
        navigate('/admin')
      } else {
        toast.error(result.error || 'Credenziali non valide')
      }
    } catch {
      toast.error('Errore imprevisto. Riprova.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={loginPageBgStyle}
    >
      <div className="w-full max-w-md animate-fade-in">

        {/* Card: contenitori interni trasparenti per far vedere lo sfondo pagina */}
        <div className="rounded-2xl bg-transparent shadow-none overflow-hidden">

          {/* Header strip */}
          <div className="bg-transparent px-4 pt-6 pb-2 text-center sm:px-5">
            <img
              src={`${import.meta.env.BASE_URL}icons/icon-192-v2.png`}
              alt="Logo app"
              className="mx-auto mb-4 size-[calc(7rem*4/3)] rounded-full object-contain min-[570px]:size-[calc(8rem*4/3)]"
            />
            <h1 className="text-title-page font-bold leading-tight text-slate-900 drop-shadow-sm max-[736px]:text-balance min-[737px]:text-pretty">
              Sistema Gestionale{' '}
              <br className="hidden max-[736px]:block" aria-hidden />
              Prenotazioni
            </h1>
          </div>

          {/* Form */}
          <div className="bg-transparent px-4 pt-2 pb-6 sm:px-5">
            {showSubscriptionBanner && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Abbonamento non attivo. Contatta il supporto.
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">

              <div className="w-full max-w-[14rem] space-y-1.5 text-center">
                <Label htmlFor="email" className="block text-center">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
                  placeholder="admin@tuoristorante.it"
                  disabled={isSubmitting}
                  className={`min-h-[3.667rem] rounded-[1.25rem] border-2 border-white/90 !bg-white/72 px-4 py-2.5 text-center text-xl font-medium leading-snug shadow-sm backdrop-blur-[1px] placeholder:text-slate-500 ${errors.email ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''}`}
                />
                {errors.email && <p className="text-xs text-red-500 text-center">{errors.email}</p>}
              </div>

              <div className="w-full max-w-[14rem] space-y-1.5 text-center" style={{ marginTop: '0.25rem' }}>
                <Label htmlFor="password" className="block text-center">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className={`min-h-[3.667rem] rounded-[1.25rem] border-2 border-white/90 !bg-white/72 px-4 py-2.5 text-center text-xl font-medium leading-snug shadow-sm backdrop-blur-[1px] placeholder:text-slate-500 ${errors.password ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''}`}
                />
                {errors.password && <p className="text-xs text-red-500 text-center">{errors.password}</p>}
              </div>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="w-full max-w-[14rem] rounded-[1.25rem] group border !shadow-sm font-bold hover:bg-white/80 focus:ring-teal-500/40 focus:ring-offset-transparent"
                style={{ ...loginSubmitStyle, marginTop: '0.75rem' }}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-400/50 border-t-slate-700 rounded-full animate-spin" />
                    Accesso in corso...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Accedi
                    <ArrowRight className="h-6 w-6 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                )}
              </Button>
            </form>

          </div>
        </div>

      </div>
    </div>
  )
}
