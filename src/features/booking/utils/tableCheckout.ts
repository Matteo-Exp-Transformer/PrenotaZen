type TableTurnRow = {
  table_id: string
  service_slot_id: string
  date: string
  turn_number: number
  checked_out_at: string | null
}

/** True se esiste un turno successivo già assegnato e ancora attivo sullo stesso tavolo. */
export function hasWaitingNextTurnOnTable(
  assignments: TableTurnRow[],
  current: TableTurnRow,
): boolean {
  return assignments.some(
    (a) =>
      a.table_id === current.table_id &&
      a.service_slot_id === current.service_slot_id &&
      a.date === current.date &&
      a.turn_number > current.turn_number &&
      a.checked_out_at === null,
  )
}
