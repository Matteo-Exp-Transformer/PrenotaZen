import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, handleSupabaseError, isInvalidStoredRefreshTokenError } from '@/lib/supabase'
import { useTenantContext } from '@/contexts/TenantContext'

const AUTH_REVOKED_REASON_KEY = 'auth_revoked_reason'
const SUBSCRIPTION_INACTIVE_REASON = 'subscription_inactive'

interface AdminAuthUser {
  id: string
  email: string
  name?: string
  tenantId?: string
}

interface AdminAuthContextValue {
  user: AdminAuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminAuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const { setTenantFromAdmin, clearTenant } = useTenantContext()

  const setSubscriptionRevokedReason = () => {
    sessionStorage.setItem(AUTH_REVOKED_REASON_KEY, SUBSCRIPTION_INACTIVE_REASON)
  }

  const ensureActiveSubscription = async (tenantId?: string): Promise<boolean> => {
    if (!tenantId) {
      return false
    }

    const { data: organization, error } = await (supabase
      .from('organizations') as any)
      .select('is_active')
      .eq('id', tenantId)
      .single()

    if (error || !organization || !organization.is_active) {
      await supabase.auth.signOut()
      setSubscriptionRevokedReason()
      return false
    }

    return true
  }

  const checkSession = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        if (isInvalidStoredRefreshTokenError(sessionError)) {
          await supabase.auth.signOut({ scope: 'local' })
        } else {
          console.error('Session check error:', sessionError)
        }
        setUser(null)
        setIsLoading(false)
        return
      }

      if (!session || !session.user || !session.user.email) {
        setUser(null)
        setIsLoading(false)
        return
      }

      const { data: adminUser, error: adminError } = await (supabase
        .from('admin_users') as any)
        .select('name, tenant_id')
        .eq('email', session.user.email)
        .single()

      if (adminError || !adminUser) {
        setUser(null)
        setIsLoading(false)
        return
      }

      const hasActiveSubscription = await ensureActiveSubscription((adminUser as any).tenant_id)
      if (!hasActiveSubscription) {
        clearTenant()
        setUser(null)
        setIsLoading(false)
        return
      }

      await setTenantFromAdmin(session.user.email)

      setUser({
        id: session.user.id,
        email: session.user.email,
        name: (adminUser as any).name || undefined,
      })
    } catch (error) {
      console.error('Error checking session:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void checkSession()
  }, [])

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true)

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        return {
          success: false,
          error: handleSupabaseError(authError),
        }
      }

      if (!authData.user) {
        return {
          success: false,
          error: 'Errore durante il login. Riprova più tardi.',
        }
      }

      const { data: adminUser, error: adminError } = await (supabase
        .from('admin_users') as any)
        .select('name, tenant_id')
        .eq('email', authData.user.email || '')
        .single()

      if (adminError || !adminUser) {
        await supabase.auth.signOut()
        return {
          success: false,
          error: 'Utente non autorizzato',
        }
      }

      const hasActiveSubscription = await ensureActiveSubscription((adminUser as any).tenant_id)
      if (!hasActiveSubscription) {
        clearTenant()
        setUser(null)
        return {
          success: false,
          error: 'Abbonamento non attivo. Contatta il supporto.',
        }
      }

      await setTenantFromAdmin(authData.user.email || '')

      setUser({
        id: authData.user.id,
        email: authData.user.email || '',
        name: (adminUser as any).name || undefined,
      })

      return { success: true }
    } catch (error) {
      console.error('Login exception:', error)
      return {
        success: false,
        error: handleSupabaseError(error),
      }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      clearTenant()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
      navigate('/login')
    }
  }

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export const useAdminAuth = (): AdminAuthContextValue => {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider')
  }
  return ctx
}
