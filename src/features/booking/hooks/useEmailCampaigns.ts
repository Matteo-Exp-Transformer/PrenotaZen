import { useQuery } from '@tanstack/react-query'
import { useTenantContext } from '@/contexts/TenantContext'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { Json } from '@/types/database'

export type EmailCampaign = Tables<'email_campaigns'>

export interface CampaignLinkRow {
  label: string
  url: string
}

export const EMAIL_CAMPAIGNS_QUERY_KEY = 'email-campaigns'
export const EMAIL_CAMPAIGNS_MAX = 5

/** Cast sicuro del campo JSONB `links` in CampaignLinkRow[]. */
export function parseCampaignLinks(raw: Json): CampaignLinkRow[] {
  if (!Array.isArray(raw)) return []
  const result: CampaignLinkRow[] = []
  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      !Array.isArray(item) &&
      typeof (item as Record<string, unknown>).label === 'string' &&
      typeof (item as Record<string, unknown>).url === 'string'
    ) {
      result.push(item as unknown as CampaignLinkRow)
    }
  }
  return result
}

/** Cast sicuro del campo JSONB `recipient_emails` in string[]. */
export function parseCampaignRecipients(raw: Json): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string')
}

export function useEmailCampaigns() {
  const { tenantId } = useTenantContext()

  return useQuery({
    queryKey: [EMAIL_CAMPAIGNS_QUERY_KEY, tenantId],
    queryFn: async () => {
      if (!tenantId) return []
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    enabled: !!tenantId,
  })
}
