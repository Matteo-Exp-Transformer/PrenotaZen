import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // =============================================
    // GET - Validate invite token
    // =============================================
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");

      if (!token) {
        return jsonResponse({ valid: false, error: "Token mancante" }, 400);
      }

      const { data, error } = await supabaseAdmin
        .from("invite_tokens")
        .select(
          "id, email, organization_id, organizations!inner(name)"
        )
        .eq("token", token)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error || !data) {
        return jsonResponse(
          { valid: false, error: "Link scaduto o non valido" },
          404
        );
      }

      // Extract organization name from joined data
      const organizationName =
        (data.organizations as Record<string, unknown>)?.name ?? null;

      return jsonResponse(
        {
          valid: true,
          organizationName,
          email: data.email || null,
        },
        200
      );
    }

    // =============================================
    // POST - Register new admin via invite token
    // =============================================
    if (req.method === "POST") {
      const body = await req.json();
      const { token, email, password } = body;

      // --- Validation ---
      if (!token) {
        return jsonResponse({ error: "Token è obbligatorio" }, 400);
      }

      if (!email || typeof email !== "string") {
        return jsonResponse({ error: "Email è obbligatoria" }, 400);
      }

      // Basic email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return jsonResponse({ error: "Formato email non valido" }, 400);
      }

      if (!password || typeof password !== "string" || password.length < 8) {
        return jsonResponse(
          { error: "Password obbligatoria (minimo 8 caratteri)" },
          400
        );
      }

      // --- Verify token ---
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("invite_tokens")
        .select("id, organization_id, email")
        .eq("token", token)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (tokenError || !tokenData) {
        return jsonResponse(
          { error: "Token non valido o scaduto" },
          404
        );
      }

      // Check if invite email is set and matches
      if (tokenData.email && tokenData.email !== email) {
        return jsonResponse(
          { error: "Email non autorizzata per questo invito" },
          403
        );
      }

      // --- Atomically consume the token BEFORE creating the user ---
      // Conditional UPDATE guarded by `used_at IS NULL`: only ONE concurrent
      // request can flip it from NULL to a timestamp. `.select()` returns only
      // the rows actually updated, so an empty result means the token was
      // already used (or just consumed by a racing request) -> we must NOT
      // create the user. This closes the TOCTOU window left by the previous
      // "select-then-update-at-the-end" approach.
      const { data: consumedRows, error: consumeError } = await supabaseAdmin
        .from("invite_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenData.id)
        .is("used_at", null)
        .select("id");

      if (consumeError) {
        console.error("Token consume error:", consumeError);
        return jsonResponse(
          { error: "Errore durante la validazione dell'invito" },
          500
        );
      }

      // 0 rows updated -> token already consumed / lost the race -> stop here.
      if (!consumedRows || consumedRows.length === 0) {
        return jsonResponse(
          { error: "Token non valido o scaduto" },
          409
        );
      }

      // From here on we "own" the token. If user creation fails for a technical
      // reason we roll `used_at` back to NULL so a transient error does not burn
      // the invite. This does NOT reopen the TOCTOU window: a concurrent request
      // already lost the race (got 0 rows) and bailed out above, so only this
      // single winning request can revert the token.
      const rollbackToken = async () => {
        const { error: rollbackError } = await supabaseAdmin
          .from("invite_tokens")
          .update({ used_at: null })
          .eq("id", tokenData.id);
        if (rollbackError) {
          console.error("Token rollback error:", rollbackError);
        }
      };

      // --- Create Supabase Auth user ---
      const { data: authUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (authError) {
        console.error("Auth error:", authError);
        await rollbackToken();
        return jsonResponse(
          { error: authError.message || "Errore nella creazione dell'utente" },
          400
        );
      }

      // --- Insert into admin_users ---
      const { error: adminInsertError } = await supabaseAdmin
        .from("admin_users")
        .insert({
          email,
          name: email,
          tenant_id: tokenData.organization_id,
        });

      if (adminInsertError) {
        console.error("Admin insert error:", adminInsertError);
        // Cleanup: delete the auth user we just created, then free the token.
        if (authUser?.user?.id) {
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        }
        await rollbackToken();
        return jsonResponse(
          { error: "Errore durante la registrazione dell'utente" },
          500
        );
      }

      // Success: the token is already consumed (used_at set above), so there is
      // nothing left to mark — the registration cannot be replayed.
      return jsonResponse(
        { success: true, message: "Registrazione completata" },
        201
      );
    }

    // Method not allowed
    return jsonResponse({ error: "Metodo non consentito" }, 405);
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Errore interno del server" }, 500);
  }
});
