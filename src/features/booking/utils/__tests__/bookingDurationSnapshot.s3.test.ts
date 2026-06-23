// @s3-blindatura: admin-duration-snapshot
import { describe, expect, it } from 'vitest'
import { durationSnapshotFromConfirmedRange } from '../bookingDurationSnapshot'

describe('durationSnapshotFromConfirmedRange', () => {
  it('congela la durata effettiva anche overnight', () => {
    expect(durationSnapshotFromConfirmedRange(
      '2026-06-23T23:30:00+02:00', '2026-06-24T01:30:00+02:00',
    )).toEqual({ duration_minutes: 120, duration_source: 'admin_schedule', duration_rule_version: 1 })
  })
  it('non inventa snapshot per intervalli invalidi', () => {
    expect(durationSnapshotFromConfirmedRange('bad', 'bad')).toBeUndefined()
    expect(durationSnapshotFromConfirmedRange(
      '2026-06-23T20:00:00+02:00', '2026-06-23T20:10:00+02:00',
    )).toBeUndefined()
  })
})
