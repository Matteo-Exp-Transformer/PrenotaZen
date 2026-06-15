import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_EMAIL_TYPES = new Set([
  "booking_confirmation",
  "booking_accepted",
  "booking_rejected",
  "booking_cancelled",
  "booking_reminder_24h",
  "booking_thank_you",
  "test_email",
  "manual",
]);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo non consentito" }, 405);
  }

  try {
    const apiKey = Deno.env.get("BREVO_API_KEY")?.trim();
    const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL")?.trim();
    const senderName = Deno.env.get("BREVO_SENDER_NAME")?.trim() || "Prenotazioni";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!apiKey || !senderEmail) {
      return jsonResponse(
        { error: "Email non configurata sul server (BREVO_API_KEY / BREVO_SENDER_EMAIL mancanti)" },
        503,
      );
    }

    // Verifica JWT admin — si accetta solo un Bearer token valido
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    if (!token) {
      return jsonResponse({ error: "Autenticazione richiesta" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);

    if (authErr || !authData?.user?.email) {
      return jsonResponse({ error: "Sessione non valida" }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "JSON non valido" }, 400);
    }

    // Valida tenantId (obbligatorio per verificare che il chiamante sia admin del tenant)
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (!tenantId || !UUID_REGEX.test(tenantId)) {
      return jsonResponse({ error: "tenantId obbligatorio (UUID)" }, 400);
    }

    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id")
      .eq("email", authData.user.email)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!adminRow) {
      return jsonResponse({ error: "Permesso negato per questo tenant" }, 403);
    }

    // Valida destinatari
    const rawTo = body.to;
    const recipients: string[] = [];
    if (typeof rawTo === "string" && EMAIL_REGEX.test(rawTo.trim())) {
      recipients.push(rawTo.trim().toLowerCase());
    } else if (Array.isArray(rawTo)) {
      for (const e of (rawTo as unknown[]).slice(0, 10)) {
        if (typeof e === "string" && EMAIL_REGEX.test(e.trim())) {
          recipients.push(e.trim().toLowerCase());
        }
      }
    }

    if (recipients.length === 0) {
      return jsonResponse({ error: "Destinatario email non valido" }, 400);
    }

    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const html = typeof body.html === "string" ? body.html : "";

    if (!subject || subject.length > 998) {
      return jsonResponse({ error: "Oggetto email non valido" }, 400);
    }
    if (!html || html.length > 950_000) {
      return jsonResponse({ error: "Contenuto email non valido" }, 400);
    }

    const emailType =
      typeof body.emailType === "string" && ALLOWED_EMAIL_TYPES.has(body.emailType.trim())
        ? body.emailType.trim()
        : "manual";

    // Chiamata Brevo
    let brevoRes: Response;
    try {
      brevoRes = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: recipients.map((email) => ({ email })),
          subject,
          htmlContent: html,
          tags: [emailType],
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore di rete verso Brevo";
      return jsonResponse({ error: msg }, 502);
    }

    const brevoText = await brevoRes.text();
    let brevoJson: Record<string, unknown> = {};
    try {
      brevoJson = JSON.parse(brevoText) as Record<string, unknown>;
    } catch {
      brevoJson = {};
    }

    if (!brevoRes.ok) {
      const detail =
        typeof brevoJson.message === "string"
          ? brevoJson.message
          : `HTTP ${brevoRes.status}`;
      return jsonResponse({ error: detail }, 502);
    }

    const messageId =
      typeof brevoJson.messageId === "string" ? brevoJson.messageId : undefined;

    return jsonResponse(messageId ? { success: true, messageId } : { success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Errore interno";
    return jsonResponse({ error: msg }, 500);
  }
});
