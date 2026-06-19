import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DietaryRestrictionsSection } from '../DietaryRestrictionsSection'

// La modale Privacy (PrivacyPolicyModal) risolve il nome ristorante via hook: mock per
// evitare setup provider. Mockati solo perché il blocco privacy monta la modale.
vi.mock('@/hooks/useRestaurantName', () => ({ useRestaurantName: () => 'Trattoria Demo' }))
vi.mock('@/contexts/TenantContext', () => ({
  useTenantContext: () => ({ organizationName: 'Trattoria Demo' }),
}))

const renderSection = (props: Partial<React.ComponentProps<typeof DietaryRestrictionsSection>> = {}) =>
  render(
    <MemoryRouter>
      <DietaryRestrictionsSection
        dietaryText=""
        onDietaryTextChange={vi.fn()}
        specialRequests=""
        onSpecialRequestsChange={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  )

describe('DietaryRestrictionsSection — checkbox consenso dietary', () => {
  it('non mostra la checkbox se il campo dietary è vuoto', () => {
    renderSection({
      dietaryConsentAccepted: false,
      onDietaryConsentChange: vi.fn(),
    })
    expect(screen.queryByLabelText(/acconsento al trattamento/i)).toBeNull()
  })

  it('mostra la checkbox se il campo dietary è non vuoto', () => {
    renderSection({
      dietaryText: 'glutine',
      dietaryConsentAccepted: false,
      onDietaryConsentChange: vi.fn(),
    })
    expect(screen.getByLabelText(/acconsento al trattamento/i)).toBeTruthy()
  })

  it('la checkbox risulta spuntata quando dietaryConsentAccepted=true', () => {
    renderSection({
      dietaryText: 'glutine',
      dietaryConsentAccepted: true,
      onDietaryConsentChange: vi.fn(),
    })
    expect((screen.getByLabelText(/acconsento al trattamento/i) as HTMLInputElement).checked).toBe(true)
  })

  it('chiama onDietaryConsentChange al click', () => {
    const onChange = vi.fn()
    renderSection({
      dietaryText: 'glutine',
      dietaryConsentAccepted: false,
      onDietaryConsentChange: onChange,
    })
    fireEvent.click(screen.getByLabelText(/acconsento al trattamento/i))
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('non mostra la checkbox se le props non sono passate (contesto admin)', () => {
    renderSection({ dietaryText: 'glutine' })
    expect(screen.queryByLabelText(/acconsento al trattamento/i)).toBeNull()
  })
})

describe('DietaryRestrictionsSection — link Privacy Policy (modale in-page)', () => {
  it('apre la modale al click sul link e la chiude senza smontare il form', () => {
    renderSection({
      privacyAccepted: false,
      onPrivacyChange: vi.fn(),
    })
    // Modale chiusa di default: il contenuto della policy non è in pagina.
    expect(screen.queryByText('1. Chi tratta i tuoi dati')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /privacy policy/i }))
    expect(screen.getByText('1. Chi tratta i tuoi dati')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /chiudi/i }))
    expect(screen.queryByText('1. Chi tratta i tuoi dati')).toBeNull()
    // Il form (checkbox privacy + link) resta montato dopo la chiusura.
    expect(screen.getByRole('checkbox')).toBeTruthy()
    expect(screen.getByRole('button', { name: /privacy policy/i })).toBeTruthy()
  })
})
