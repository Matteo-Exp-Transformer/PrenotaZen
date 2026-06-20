/** YYYY-MM-DD o ISO timestamptz → GG/MM/AAAA (solo data, locale it-IT). */
export function formatItalianDateDisplay(dateStr?: string | null): string {
  if (!dateStr?.trim()) return '—'
  const iso = dateStr.trim()

  const dateOnly = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return `${d}/${m}/${y}`
  }

  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}
