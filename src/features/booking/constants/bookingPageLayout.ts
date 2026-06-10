// NOTA breakpoint layout Prenota (1256 sidebar sticky · 1600 riepilogo esterno full-page):
// sono scritti come literal `min-[1256px]` / `min-[1600px]` nei JSX perché Tailwind JIT NON
// risolve costanti dinamiche in classi. Non esiste (né può esistere) una costante JS che li
// "guidi": se si cambia un breakpoint, aggiornare i literal a mano in BookingRequestPage.tsx /
// BookingRequestForm.tsx / bookingPublicFieldStyles.ts. Le ex-costanti 1256/1600 erano morte
// (mai consumate, davano la falsa impressione di essere la fonte di verità) → rimosse 02-06-26.

/**
 * Tetto larghezza form su desktop full-page (senza striscia): 4 card ingredienti × 280px
 * + 3 gap-4 (16px) in `ComposeScrollRow` ≥700px → 1168px.
 * (Questa SÌ è consumata: iniettata come CSS variable in BookingRequestPage.tsx.)
 */
export const BOOKING_FULL_PAGE_FORM_MAX_WIDTH_PX = 1168

/** Larghezza riepilogo desktop nel blocco centrato full-page (affiancato al cap form). */
export const BOOKING_FULL_PAGE_SUMMARY_WIDTH_PX = 360
