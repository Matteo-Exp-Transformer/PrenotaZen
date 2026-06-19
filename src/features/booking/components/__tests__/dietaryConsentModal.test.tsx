import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DietaryConsentModal } from '../DietaryConsentModal'

describe('DietaryConsentModal', () => {
  const baseProps = {
    isOpen: true,
    onAuthorize: vi.fn(),
    onCancel: vi.fn(),
    onDecline: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('non renderizza nulla quando isOpen=false', () => {
    render(<DietaryConsentModal {...baseProps} isOpen={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renderizza il dialogo quando isOpen=true', () => {
    render(<DietaryConsentModal {...baseProps} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/allergie.*intolleranze.*esigenze alimentari/i)).toBeTruthy()
  })

  it('chiama onAuthorize al click su "Sì, autorizzo"', () => {
    render(<DietaryConsentModal {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /sì.*autorizzo/i }))
    expect(baseProps.onAuthorize).toHaveBeenCalledOnce()
  })

  it('chiama onDecline al click su "No, le comunicherò"', () => {
    render(<DietaryConsentModal {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /no.*comunicherò/i }))
    expect(baseProps.onDecline).toHaveBeenCalledOnce()
  })

  it('chiama onCancel al click su "Annulla"', () => {
    render(<DietaryConsentModal {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /annulla/i }))
    expect(baseProps.onCancel).toHaveBeenCalledOnce()
  })

  it('chiama onCancel al tasto Escape', () => {
    render(<DietaryConsentModal {...baseProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(baseProps.onCancel).toHaveBeenCalledOnce()
  })
})
