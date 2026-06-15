import { useCallback, useState } from 'react'
import {
  runAfterTripleAnimationFrame,
  scrollToFormValidationError,
} from '../utils/formValidationAttention'

export type UseFormValidationAttentionOptions = {
  errorFieldIds: Record<string, string>
  /** Chiusura pannelli espansi prima dello scroll (es. card ingredienti Prenota). */
  onCollapsePanels?: () => void
}

/**
 * Orchestrazione condivisa: collapse → pulse su un campo → triple rAF → scroll al primo errore.
 * Vedi `docs/per-ui-design-skill/FORM_VALIDATION_ATTENTION_PATTERN.md`.
 */
export function useFormValidationAttention({
  errorFieldIds,
  onCollapsePanels,
}: UseFormValidationAttentionOptions) {
  const [attentionFieldKey, setAttentionFieldKey] = useState<string | null>(null)
  const [composeCollapseNonce, setComposeCollapseNonce] = useState(0)

  const clearAttentionField = useCallback(() => {
    setAttentionFieldKey(null)
  }, [])

  const focusFirstValidationIssue = useCallback(
    (firstErrorKey: string | null) => {
      setComposeCollapseNonce((value) => value + 1)
      setAttentionFieldKey(firstErrorKey)
      onCollapsePanels?.()
      if (!firstErrorKey) return
      runAfterTripleAnimationFrame(() => {
        scrollToFormValidationError(firstErrorKey, errorFieldIds)
      })
    },
    [errorFieldIds, onCollapsePanels],
  )

  return {
    attentionFieldKey,
    clearAttentionField,
    focusFirstValidationIssue,
    composeCollapseNonce,
  }
}
