/**
 * Structured CLI logging for Node ESM scripts (FU-LOG-1).
 * Mirrors the sanitization philosophy of supabase/functions/_shared/log.ts.
 */

const PII_KEY_PATTERN =
  /email|phone|token|password|authorization|secret|apikey|bearer|client_name|client_email|client_phone/i

function serializeError(err) {
  if (err instanceof Error) {
    return { name: err.name, message: err.message }
  }
  if (err && typeof err === 'object') {
    const o = err
    return {
      code: o.code,
      message: o.message,
      details: o.details,
      hint: o.hint,
      name: o.name,
      status: o.status,
    }
  }
  return { message: String(err) }
}

function sanitizeMeta(meta) {
  if (meta == null) return undefined
  if (typeof meta !== 'object' || Array.isArray(meta)) {
    return meta
  }

  const out = {}
  for (const [key, value] of Object.entries(meta)) {
    if (PII_KEY_PATTERN.test(key)) {
      out[key] = value == null ? value : '[redacted]'
      continue
    }
    if (key === 'err' || key === 'error') {
      out[key] = serializeError(value)
      continue
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = sanitizeMeta(value)
      continue
    }
    out[key] = value
  }
  return out
}

function formatMeta(meta) {
  const safe = sanitizeMeta(meta)
  if (safe == null) return ''
  if (typeof safe === 'object' && Object.keys(safe).length === 0) return ''
  return ` ${JSON.stringify(safe)}`
}

/** Booking row for seed scripts: id/slug/status only — no client PII. */
export function sanitizeBookingLog(row) {
  if (row == null || typeof row !== 'object') return row
  const out = {}
  if ('id' in row) out.id = row.id
  if ('status' in row) out.status = row.status
  if ('desired_date' in row) out.desired_date = row.desired_date
  if ('booking_type' in row) out.booking_type = row.booking_type
  if ('menu_total_per_person' in row) out.menu_total_per_person = row.menu_total_per_person
  if ('menu_total_booking' in row) out.menu_total_booking = row.menu_total_booking
  return Object.keys(out).length > 0 ? out : '[redacted booking payload]'
}

/**
 * @param {string} scriptName
 * @returns {{ log: Function, ok: Function, warn: Function, fail: Function }}
 */
export function createCliLogger(scriptName) {
  const prefix = `[${scriptName}]`

  const log = (msg, meta) => {
    if (msg === '') {
      process.stdout.write('\n')
      return
    }
    process.stdout.write(`${prefix} ${msg}${formatMeta(meta)}\n`)
  }

  const ok = (msg, meta) => {
    process.stdout.write(`${prefix} ✓ ${msg}${formatMeta(meta)}\n`)
  }

  const warn = (msg, meta) => {
    process.stderr.write(`${prefix} ⚠ ${msg}${formatMeta(meta)}\n`)
  }

  /**
   * @param {string} msg
   * @param {unknown} [errOrExit]
   * @param {number} [exitCode]
   */
  const fail = (msg, errOrExit, exitCode) => {
    let err
    let code
    if (typeof errOrExit === 'number') {
      code = errOrExit
    } else if (errOrExit !== undefined) {
      err = errOrExit
      code = exitCode
    }
    const meta = err !== undefined ? { err } : undefined
    process.stderr.write(`\n${prefix} ✖ ${msg}${formatMeta(meta)}\n\n`)
    if (typeof code === 'number') {
      process.exit(code)
    }
  }

  return { log, ok, warn, fail }
}
