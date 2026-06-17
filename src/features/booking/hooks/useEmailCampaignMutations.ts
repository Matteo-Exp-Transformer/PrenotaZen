import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import { EMAIL_CAMPAIGNS_QUERY_KEY, EMAIL_CAMPAIGNS_MAX, type CampaignLinkRow } from './useEmailCampaigns'

export type CadenceType = 'none' | 'weekly' | 'monthly' | 'custom'

export interface CadenceConfig {
  weekday?: number
  day_of_month?: number
  interval_days?: number
  [key: string]: unknown
}

export interface CreateCampaignInput {
  name: string
  subject: string
  body: string
  links: CampaignLinkRow[]
  recipient_emails: string[]
  cadence_type: CadenceType
  cadence_config?: CadenceConfig | null
  enabled?: boolean
  heading?: string | null
}

export interface UpdateCampaignInput extends CreateCampaignInput {
  id: string
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      if (!tenantId) throw new Error('Tenant non disponibile')

      // Guard client-side: rispecchia il trigger DB
      const { count } = await supabase
        .from('email_campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
      if ((count ?? 0) >= EMAIL_CAMPAIGNS_MAX) {
        throw new Error(`Limite di ${EMAIL_CAMPAIGNS_MAX} campagne per tenant raggiunto`)
      }

      const { error } = await supabase.from('email_campaigns').insert({
        tenant_id: tenantId,
        name: input.name,
        subject: input.subject,
        body: input.body,
        links: input.links as unknown as Json,
        recipient_emails: input.recipient_emails as unknown as Json,
        cadence_type: input.cadence_type,
        cadence_config: (input.cadence_config ?? null) as unknown as Json,
        enabled: input.enabled ?? true,
        heading: input.heading?.trim() || null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [EMAIL_CAMPAIGNS_QUERY_KEY, tenantId] })
    },
  })
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (input: UpdateCampaignInput) => {
      if (!tenantId) throw new Error('Tenant non disponibile')

      const { error } = await supabase
        .from('email_campaigns')
        .update({
          name: input.name,
          subject: input.subject,
          body: input.body,
          links: input.links as unknown as Json,
          recipient_emails: input.recipient_emails as unknown as Json,
          cadence_type: input.cadence_type,
          cadence_config: (input.cadence_config ?? null) as unknown as Json,
          enabled: input.enabled ?? true,
          heading: input.heading?.trim() || null,
        })
        .eq('id', input.id)
        .eq('tenant_id', tenantId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [EMAIL_CAMPAIGNS_QUERY_KEY, tenantId] })
    },
  })
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient()
  const { tenantId } = useTenantContext()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!tenantId) throw new Error('Tenant non disponibile')

      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [EMAIL_CAMPAIGNS_QUERY_KEY, tenantId] })
    },
  })
}
