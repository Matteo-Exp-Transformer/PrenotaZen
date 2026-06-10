import { cn } from '@/lib/utils'

/** CTA primaria admin (footer Log-out, toolbar menu, ecc.) — allinea al tema primary */
export const adminBlueCtaSurfaceClass = cn(
  'rounded-lg border-2 border-primary-700 bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-none',
  'transition-colors hover:bg-primary-500 hover:border-primary-600 hover:shadow-none',
  'focus:outline-none focus:ring-2 focus:ring-primary-300 focus:ring-offset-2 active:scale-[0.98]',
  '[&_svg]:shrink-0 [&_svg]:text-white'
)
