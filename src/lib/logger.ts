const isDev = import.meta.env.DEV

export const logger = {
  debug: (...a: unknown[]) => {
    if (isDev) console.log(...a)
  },
  info: (...a: unknown[]) => {
    if (isDev) console.info(...a)
  },
  warn: (...a: unknown[]) => console.warn(...a),
  error: (...a: unknown[]) => console.error(...a),
}
