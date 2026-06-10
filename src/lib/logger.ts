const isDev = import.meta.env.DEV

export const logger = {
  debug: (...a: unknown[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.log(...a)
  },
  info: (...a: unknown[]) => {
    // eslint-disable-next-line no-console
    if (isDev) console.info(...a)
  },
  warn: (...a: unknown[]) => console.warn(...a),
  error: (...a: unknown[]) => console.error(...a),
}
