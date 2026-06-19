import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  normalizePublicUrl,
  resolveAppPublicUrl,
} from "./unsubscribeLink.ts";

Deno.test("normalizePublicUrl accetta solo http/https e restituisce origin", () => {
  assertEquals(normalizePublicUrl("https://prenota-zen.vercel.app/path?q=1"), "https://prenota-zen.vercel.app");
  assertEquals(normalizePublicUrl("http://localhost:5173/admin"), "http://localhost:5173");
  assertEquals(normalizePublicUrl("javascript:alert(1)"), "");
  assertEquals(normalizePublicUrl("non-url"), "");
});

Deno.test("resolveAppPublicUrl preferisce APP_PUBLIC_URL configurato", () => {
  const req = new Request("https://project.supabase.co/functions/v1/send-email", {
    headers: { Origin: "https://preview.vercel.app" },
  });

  assertEquals(
    resolveAppPublicUrl(req, "https://prenota-zen.vercel.app/qualcosa"),
    "https://prenota-zen.vercel.app",
  );
});

Deno.test("resolveAppPublicUrl usa Origin vercel come fallback", () => {
  const req = new Request("https://project.supabase.co/functions/v1/send-email", {
    headers: { Origin: "https://prenota-zen.vercel.app" },
  });

  assertEquals(resolveAppPublicUrl(req, ""), "https://prenota-zen.vercel.app");
});

Deno.test("resolveAppPublicUrl rifiuta fallback da origine non attendibile", () => {
  const req = new Request("https://project.supabase.co/functions/v1/send-email", {
    headers: { Origin: "https://evil.example" },
  });

  assertEquals(resolveAppPublicUrl(req, ""), "");
});
