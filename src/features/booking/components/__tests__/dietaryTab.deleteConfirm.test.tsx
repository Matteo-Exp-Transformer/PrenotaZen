// Verification: dietary restriction deletion confirmation modal
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DietaryTab } from '../DietaryTab'
import type { BookingRequest } from '@/types/booking'

const mockBooking: BookingRequest = {
  id: 'test-1',
  tenant_id: 'test',
  guest_name: 'Mario',
  guest_phone: '123456789',
  guest_email: 'mario@test.it',
  num_guests: 4,
  booking_type: 'compleanno',
  dietary_restrictions: [],
  special_requests: '',
  status: 'pending',
  created_at: new Date().toISOString(),
  desired_time: '20:00',
  source: 'public',
} as any

describe('DietaryTab — delete confirmation', () => {
  it('shows confirmation modal when clicking trash icon', async () => {
    const user = userEvent.setup()
    const onDietaryChange = vi.fn()
    const onSpecialChange = vi.fn()

    render(
      <DietaryTab
        booking={mockBooking}
        isEditMode
        dietaryRestrictions={[
          { restriction: 'No Lattosio', guest_count: 2, notes: undefined }
        ]}
        specialRequests=""
        onDietaryRestrictionsChange={onDietaryChange}
        onSpecialRequestsChange={onSpecialChange}
      />
    )

    // Find and click trash button
    const trashButtons = screen.getAllByRole('button').filter(btn => {
      // Look for red trash button by class
      return btn.className.includes('text-red-600')
    })
    expect(trashButtons.length).toBeGreaterThan(0)

    await user.click(trashButtons[0])

    // Modal should appear
    const modalTitle = screen.getByText('Elimina intolleranza')
    expect(modalTitle).toBeInTheDocument()

    const modalMessage = screen.getByText(/Confermi di voler rimuovere questa intolleranza/)
    expect(modalMessage).toBeInTheDocument()
  })

  it('does NOT delete when clicking Annulla', async () => {
    const user = userEvent.setup()
    const onDietaryChange = vi.fn()

    render(
      <DietaryTab
        booking={mockBooking}
        isEditMode
        dietaryRestrictions={[
          { restriction: 'No Lattosio', guest_count: 2 }
        ]}
        specialRequests=""
        onDietaryRestrictionsChange={onDietaryChange}
        onSpecialRequestsChange={() => {}}
      />
    )

    // Click trash
    const trashButtons = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('text-red-600')
    )
    await user.click(trashButtons[0])

    // Click Annulla (green button)
    const cancelBtn = screen.getByRole('button', { name: /Annulla/ })
    await user.click(cancelBtn)

    // onDietaryChange should NOT have been called
    expect(onDietaryChange).not.toHaveBeenCalled()

    // Modal should be gone
    const modal = screen.queryByText('Elimina intolleranza')
    expect(modal).not.toBeInTheDocument()
  })

  it('deletes item when clicking Elimina', async () => {
    const user = userEvent.setup()
    const onDietaryChange = vi.fn()

    render(
      <DietaryTab
        booking={mockBooking}
        isEditMode
        dietaryRestrictions={[
          { restriction: 'No Lattosio', guest_count: 2 },
          { restriction: 'Vegano', guest_count: 1 }
        ]}
        specialRequests=""
        onDietaryRestrictionsChange={onDietaryChange}
        onSpecialRequestsChange={() => {}}
      />
    )

    // Click trash on first item
    const trashButtons = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('text-red-600')
    )
    await user.click(trashButtons[0])

    // Click Elimina (red button)
    const deleteBtn = screen.getByRole('button', { name: /Elimina/ })
    await user.click(deleteBtn)

    // onDietaryChange should have been called with array without first item
    expect(onDietaryChange).toHaveBeenCalledWith([
      { restriction: 'Vegano', guest_count: 1 }
    ])
  })
})
