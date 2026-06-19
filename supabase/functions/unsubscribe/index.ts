import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeLogger } from "../_shared/log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const log = createEdgeLogger("unsubscribe", req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Metodo non consentito" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t")?.trim() ?? "";

    if (!token) {
      return jsonResponse({ error: "token_mancante" }, 400);
    }

    const { data: row, error: selectErr } = await supabase
      .from("unsubscribe_tokens")
      .select("id, tenant_id, email")
      .eq("token", token)
      .maybeSingle();

    if (selectErr) {
      log.error("unsubscribe_token_select_failed", { err: selectErr.message });
      return jsonResponse({ error: "Errore interno" }, 500);
    }

    if (!row) {
      return jsonResponse({ error: "token_not_found" }, 404);
    }

    // Imposta marketing_consent = false (idempotente)
    await supabase
      .from("customers")
      .update({ marketing_consent: false })
      .eq("tenant_id", row.tenant_id)
      .eq("email", row.email);

    // Audit trail: registra il momento di utilizzo
    await supabase
      .from("unsubscribe_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);

    return jsonResponse({ success: true });
  } catch (err) {
    log.error("unsubscribe_unexpected", { err: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "Errore interno" }, 500);
  }
});
