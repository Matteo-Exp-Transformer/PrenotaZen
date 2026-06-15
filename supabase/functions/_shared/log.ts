/**
 * Structured logging for Supabase Edge Functions (Deno).
 * Mirrors the app channel in `src/lib/logger.ts` without importing React/Vite code.
 */

export type EdgeLogLevel = "error" | "warn" | "info";

export interface EdgeLogger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
}

/** Chiavi il cui *nome* è già PII → si redige il valore puntuale. */
const PII_KEY_PATTERN = /email|phone|token|password|authorization|secret|apikey|bearer/i;

/**
 * Chiavi-contenitore che tipicamente racchiudono PII a blocco (es. `customer`,
 * `payload`, `body`). Non sappiamo cosa contengono → redigiamo l'intero valore
 * invece di ricorrere e rischiare di stampare dati personali. Difesa preventiva
 * (FU-LOG-1-H): oggi i call site edge usano per lo più `{ err }`, ma questo chiude
 * il gap se in futuro qualcuno logga `{ customer }` o `{ payload }`.
 */
const SENSITIVE_VALUE_KEY_PATTERN =
  /customer|payload|body|guest|recipient|profile|contact|address|booking/i;

function shouldLogInfo(): boolean {
  const env = Deno.env.get("ENVIRONMENT") ?? Deno.env.get("SUPABASE_ENV") ?? "";
  return env !== "production";
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    return {
      code: o.code,
      message: o.message,
      details: o.details,
      hint: o.hint,
      name: o.name,
      status: o.status,
    };
  }
  return { message: String(err) };
}

function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (PII_KEY_PATTERN.test(key)) {
      out[key] = value == null ? value : "[redacted]";
      continue;
    }
    if (key === "err" || key === "error") {
      out[key] = serializeError(value);
      continue;
    }
    if (SENSITIVE_VALUE_KEY_PATTERN.test(key)) {
      out[key] = value == null ? value : "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeMeta(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

function resolveRequestId(req?: Request): string | undefined {
  if (!req) return undefined;
  return (
    req.headers.get("x-request-id") ??
    req.headers.get("x-correlation-id") ??
    req.headers.get("cf-ray") ??
    undefined
  );
}

function write(
  level: EdgeLogLevel,
  fn: string,
  requestId: string | undefined,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (level === "info" && !shouldLogInfo()) return;

  const prefix = requestId ? `[${fn}][${requestId}]` : `[${fn}]`;
  const safeMeta = meta ? sanitizeMeta(meta) : undefined;
  const line =
    safeMeta && Object.keys(safeMeta).length > 0
      ? `${prefix} ${message} ${JSON.stringify(safeMeta)}`
      : `${prefix} ${message}`;

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "info":
      console.info(line);
      break;
  }
}

/** Create a function-scoped logger; pass the incoming request for correlation id. */
export function createEdgeLogger(fn: string, req?: Request): EdgeLogger {
  const requestId = resolveRequestId(req);
  return {
    error: (message, meta) => write("error", fn, requestId, message, meta),
    warn: (message, meta) => write("warn", fn, requestId, message, meta),
    info: (message, meta) => write("info", fn, requestId, message, meta),
  };
}
