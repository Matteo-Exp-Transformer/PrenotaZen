// FU-LOG-1-H — test unit per il logger edge condiviso.
// Esecuzione (richiede Deno installato, fuori da `npm run validate` che è Vitest):
//   deno test supabase/functions/_shared/log.test.ts
//
// Copre: prefisso [fn][request-id]; redazione chiavi PII (key-based) e
// chiavi-contenitore (value-based, customer/payload/…); serializeError senza
// stack grezzo.

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createEdgeLogger } from "./log.ts";

/** Cattura le righe scritte su console.error durante `fn`. */
function captureError(fn: () => void): string[] {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return lines;
}

Deno.test("prefisso [fn][request-id] dall'header x-request-id", () => {
  const req = new Request("https://example.test", {
    headers: { "x-request-id": "req-123" },
  });
  const log = createEdgeLogger("create-booking", req);
  const [line] = captureError(() => log.error("boom"));
  assertStringIncludes(line, "[create-booking][req-123] boom");
});

Deno.test("prefisso solo [fn] senza request id", () => {
  const log = createEdgeLogger("create-booking");
  const [line] = captureError(() => log.error("boom"));
  assertStringIncludes(line, "[create-booking] boom");
  assert(!line.includes("][")); // niente secondo segmento
});

Deno.test("redige le chiavi PII per nome (email/phone/token)", () => {
  const log = createEdgeLogger("fn");
  const [line] = captureError(() =>
    log.error("msg", { email: "a@b.it", phone: "+39333", token: "xyz" })
  );
  assertStringIncludes(line, '"email":"[redacted]"');
  assertStringIncludes(line, '"phone":"[redacted]"');
  assertStringIncludes(line, '"token":"[redacted]"');
  assert(!line.includes("a@b.it"));
});

Deno.test("redige il VALORE delle chiavi-contenitore (customer/payload)", () => {
  const log = createEdgeLogger("fn");
  const [line] = captureError(() =>
    log.error("msg", {
      customer: { name: "Mario Rossi", email: "m@r.it" },
      payload: { num_guests: 4, special: "no glutine" },
    })
  );
  assertStringIncludes(line, '"customer":"[redacted]"');
  assertStringIncludes(line, '"payload":"[redacted]"');
  assert(!line.includes("Mario Rossi"));
  assert(!line.includes("no glutine"));
});

Deno.test("serializeError espone name/message, mai lo stack grezzo", () => {
  const log = createEdgeLogger("fn");
  const err = new Error("qualcosa è andato storto");
  const [line] = captureError(() => log.error("fallito", { err }));
  assertStringIncludes(line, '"message":"qualcosa è andato storto"');
  assertStringIncludes(line, '"name":"Error"');
  assert(!line.toLowerCase().includes("stack"));
  assert(!line.includes("at "));
});

Deno.test("chiavi neutre restano in chiaro", () => {
  const log = createEdgeLogger("fn");
  const [line] = captureError(() =>
    log.error("msg", { code: "DAILY_LIMIT", count: 18 })
  );
  assertStringIncludes(line, '"code":"DAILY_LIMIT"');
  assertStringIncludes(line, '"count":18');
});

Deno.test("null/undefined su chiave sensibile resta com'è (no '[redacted]')", () => {
  const log = createEdgeLogger("fn");
  const [line] = captureError(() => log.error("msg", { customer: null }));
  assertEquals(line.includes('"customer":null'), true);
});
