import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { supabasePublic } from '../lib/supabasePublic'
import type { TenantEdition } from '@/types/edition'
import { setDevHealth, printDevHealth } from '@/lib/devConsole'

interface TenantContextType {
  tenantId: string | null
  tenantSlug: string | null
  organizationName: string | null
  edition: TenantEdition
  /** Feature attive per questo tenant (da tenant_features DB). Usato da buildFeatures. */
  featureOverrides: string[]
  isLoading: boolean
  setTenantFromSlug: (slug: string) => Promise<void>
  setTenantFromAdmin: (email: string) => Promise<void>
  clearTenant: () => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export const TenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [edition, setEdition] = useState<TenantEdition>('pro')
  const [featureOverrides, setFeatureOverrides] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  /** Risolve il tenant dalla slug (usato dalla pagina pubblica /prenota/:slug) */
  const setTenantFromSlug = useCallback(async (slug: string) => {
    setIsLoading(true)
    setTenantId(null)
    setTenantSlug(null)
    try {
      // organizations_public espone feature_overrides (da tenant_features) oltre ai campi base.
      // Dopo la migrazione 026 anon non può leggere organizations direttamente.
      const { data, error } = await (supabasePublic
        .from('organizations_public') as any)
        .select('id, name, slug, edition, feature_overrides')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        setTenantId(null)
        setTenantSlug(null)
        setOrganizationName(null)
        setFeatureOverrides([])
        return
      }

      setTenantId(data.id)
      setTenantSlug(data.slug)
      setOrganizationName(data.name)
      setEdition((data.edition as TenantEdition) || 'classic')
      setFeatureOverrides(Array.isArray(data.feature_overrides) ? data.feature_overrides : [])
      // Dev console: fotografia salute (pagina pubblica — non admin).
      setDevHealth({ tenant: data.name, isAdmin: false, edition: (data.edition as string) || 'classic' })
      printDevHealth('STATO (pagina pubblica)')
    } catch (err) {
      setTenantId(null)
      setTenantSlug(null)
      setOrganizationName(null)
      setFeatureOverrides([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  /** Risolve il tenant dall'email admin (usato dopo login).
   *  check_admin_email ora restituisce anche feature_overrides in un solo round-trip. */
  const setTenantFromAdmin = useCallback(async (email: string) => {
    setIsLoading(true)
    try {
      const { data: adminData, error } = await (supabase
        .rpc as any)('check_admin_email', { check_email: email })

      if (error || !adminData || (adminData as any[]).length === 0) {
        setTenantId(null)
        setTenantSlug(null)
        setOrganizationName(null)
        setFeatureOverrides([])
        return
      }

      const adminInfo = (adminData as any[])[0]
      setTenantId(adminInfo.tenant_id as string)
      setTenantSlug(adminInfo.slug || null)
      setOrganizationName(adminInfo.org_name || null)
      setEdition((adminInfo.edition as TenantEdition) || 'pro')
      setFeatureOverrides(Array.isArray(adminInfo.feature_overrides) ? adminInfo.feature_overrides : [])
      // Dev console: fotografia salute (sei loggato come admin).
      setDevHealth({ tenant: adminInfo.org_name || null, isAdmin: true, edition: (adminInfo.edition as string) || 'pro' })
      printDevHealth('STATO (admin)')
    } catch (err) {
      setTenantId(null)
      setTenantSlug(null)
      setOrganizationName(null)
      setFeatureOverrides([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearTenant = useCallback(() => {
    setTenantId(null)
    setTenantSlug(null)
    setOrganizationName(null)
    setEdition('classic')
    setFeatureOverrides([])
  }, [])

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        tenantSlug,
        organizationName,
        edition,
        featureOverrides,
        isLoading,
        setTenantFromSlug,
        setTenantFromAdmin,
        clearTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export const useTenantContext = () => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenantContext deve essere usato dentro TenantProvider')
  }
  return context
}
