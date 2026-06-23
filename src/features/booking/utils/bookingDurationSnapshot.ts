export interface BookingDurationSnapshot {
  duration_minutes: number
  duration_source: 'admin_schedule'
  duration_rule_version: 1
}

/** Congela la durata effettivamente scelta dall'admin, senza ricalcolare snapshot già presenti. */
export function durationSnapshotFromConfirmedRange(
  confirmedStart: string,
  confirmedEnd: string,
): BookingDurationSnapshot | undefined {
  const start = Date.parse(confirmedStart)
  const end = Date.parse(confirmedEnd)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined
  const minutes = Math.round((end - start) / 60_000)
  if (minutes < 30 || minutes > 24 * 60) return undefined
  return { duration_minutes: minutes, duration_source: 'admin_schedule', duration_rule_version: 1 }
}
