import { useQuery } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type EmailTemplate = Tables<'email_templates'>

export type EmailTemplateKey = 'booking_accepted' | 'booking_rejected' | 'promo'

export const EMAIL_TEMPLATES_QUERY_KEY = 'email-templates'

export function useEmailTemplates() {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: [EMAIL_TEMPLATES_QUERY_KEY, tenantId],
    queryFn: async () => {
      if (!tenantId) return []
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('tenant_id', tenantId)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    enabled: !!tenantId,
  })
}

/** Restituisce il template per una chiave specifica, o undefined se non esiste. */
export function useEmailTemplate(key: EmailTemplateKey) {
  const { data: templates, ...rest } = useEmailTemplates()
  return {
    ...rest,
    data: templates?.find((t) => t.template_key === key),
  }
}
