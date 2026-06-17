import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import { EMAIL_TEMPLATES_QUERY_KEY, type EmailTemplateKey } from './useEmailTemplates'

export interface UpsertEmailTemplateInput {
  template_key: EmailTemplateKey
  subject?: string | null
  intro?: string | null
  closing?: string | null
  enabled?: boolean
}

export function useUpsertEmailTemplate() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: UpsertEmailTemplateInput) => {
      if (!tenantId) throw new Error('Tenant non disponibile')

      const { error } = await supabase.from('email_templates').upsert(
        {
          tenant_id: tenantId,
          template_key: input.template_key,
          subject: input.subject ?? null,
          intro: input.intro ?? null,
          closing: input.closing ?? null,
          enabled: input.enabled ?? true,
        },
        { onConflict: 'tenant_id,template_key' },
      )

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [EMAIL_TEMPLATES_QUERY_KEY, tenantId] })
    },
  })
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (templateKey: EmailTemplateKey) => {
      if (!tenantId) throw new Error('Tenant non disponibile')

      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('template_key', templateKey)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [EMAIL_TEMPLATES_QUERY_KEY, tenantId] })
    },
  })
}
