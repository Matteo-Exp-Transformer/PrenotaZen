// Test unitari per resolveOverrideMaxGuests — funzione pura estratta da create-booking/index.ts.
// Esecuzione (richiede Deno installato, fuori da `npm run validate` che è Vitest):
//   deno test supabase/functions/create-booking/resolveOverrideMaxGuests.test.ts
//
// Copre: nessuna riga → null; singola riga; due sovrapposte (vince lo span più corto);
// pareggio di span (vince created_at più recente).

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveOverrideMaxGuests } from "./index.ts";

const BASE = {
  date_from: "2026-06-25",
  date_to: "2026-06-25",
  max_guests: 5,
  created_at: "2026-06-01T10:00:00Z",
};

Deno.test("nessuna riga → null", () => {
  assertEquals(resolveOverrideMaxGuests([], "2026-06-25"), null);
});

Deno.test("riga che non copre la data → null", () => {
  const row = { ...BASE, date_from: "2026-06-20", date_to: "2026-06-24", max_guests: 3 };
  assertEquals(resolveOverrideMaxGuests([row], "2026-06-25"), null);
});

Deno.test("una sola riga che copre la data → il suo max_guests", () => {
  const row = { ...BASE, max_guests: 7 };
  assertEquals(resolveOverrideMaxGuests([row], "2026-06-25"), 7);
});

Deno.test("due righe sovrapposte: vince lo span più corto (single-day=2 batte month=10)", () => {
  const month = {
    ...BASE,
    date_from: "2026-06-01",
    date_to: "2026-06-30",
    max_guests: 10,
    created_at: "2026-05-01T00:00:00Z",
  };
  const singleDay = {
    ...BASE,
    date_from: "2026-06-25",
    date_to: "2026-06-25",
    max_guests: 2,
    created_at: "2026-05-01T00:00:00Z",
  };
  assertEquals(resolveOverrideMaxGuests([month, singleDay], "2026-06-25"), 2);
  // ordine inverso: stesso risultato
  assertEquals(resolveOverrideMaxGuests([singleDay, month], "2026-06-25"), 2);
});

Deno.test("pareggio di span → vince created_at più recente", () => {
  const older = { ...BASE, max_guests: 8, created_at: "2026-05-01T00:00:00Z" };
  const newer = { ...BASE, max_guests: 3, created_at: "2026-06-10T12:00:00Z" };
  assertEquals(resolveOverrideMaxGuests([older, newer], "2026-06-25"), 3);
  assertEquals(resolveOverrideMaxGuests([newer, older], "2026-06-25"), 3);
});

Deno.test("max_guests null nel vincitore → restituisce null", () => {
  const row = { ...BASE, max_guests: null };
  assertEquals(resolveOverrideMaxGuests([row], "2026-06-25"), null);
});
