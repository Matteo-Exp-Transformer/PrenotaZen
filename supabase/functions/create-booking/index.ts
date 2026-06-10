import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

/** Sync con src/features/booking/constants/bookingPrenotaTextLimits.ts (BOOKING_PUBLIC_CLIENT_TEXT_LIMITS). */
const BOOKING_PUBLIC_CLIENT_TEXT_LIMITS = {
  clientName: 65,
  clientEmail: 65,
  clientPhone: 30,
  dietaryText: 550,
  specialRequests: 550,
  numGuestsMax: 110,
} as const;

const TEXT_TOO_LONG_ERROR = "Testo troppo lungo";

function getDietaryRestrictionsTextLength(
  restrictions: unknown,
): number {
  if (!Array.isArray(restrictions)) return 0;
  return restrictions.reduce((sum: number, entry: unknown) => {
    if (!entry || typeof entry !== "object") return sum;
    const r = entry as { restriction?: unknown; notes?: unknown };
    const restriction = typeof r.restriction === "string" ? r.restriction.trim() : "";
    const notes = typeof r.notes === "string" ? r.notes.trim() : "";
    return sum + restriction.length + notes.length;
  }, 0);
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Metodo non consentito" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const {
      tenantSlug,
      client_name,
      client_email,
      client_phone,
      desired_date,
      desired_time,
      num_guests,
      special_requests,
      booking_type,
      event_type,
      menu_selection,
      menu_total_per_person,
      menu_total_booking,
      dietary_restrictions,
      preset_menu,
      placement,
      menu,
      menu_promo_labels,
    } = body;

    // DB: client_email è NOT NULL (default ''). Non usare `|| null`: stringa vuota è falsy e diventerebbe NULL.
    const clientEmailNormalized =
      typeof client_email === "string" ? client_email.trim() : "";

    // --- Validation ---
    if (!tenantSlug) {
      return new Response(
        JSON.stringify({ error: "tenantSlug è obbligatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!client_name || typeof client_name !== "string") {
      return new Response(
        JSON.stringify({ error: "client_name è obbligatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (client_name.length > BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.clientName) {
      return new Response(
        JSON.stringify({ error: TEXT_TOO_LONG_ERROR }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      clientEmailNormalized.length > BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.clientEmail
    ) {
      return new Response(
        JSON.stringify({ error: TEXT_TOO_LONG_ERROR }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      typeof client_phone === "string" &&
      client_phone.length > BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.clientPhone
    ) {
      return new Response(
        JSON.stringify({ error: TEXT_TOO_LONG_ERROR }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      typeof special_requests === "string" &&
      special_requests.length > BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.specialRequests
    ) {
      return new Response(
        JSON.stringify({ error: TEXT_TOO_LONG_ERROR }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (
      getDietaryRestrictionsTextLength(dietary_restrictions) >
      BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.dietaryText
    ) {
      return new Response(
        JSON.stringify({ error: TEXT_TOO_LONG_ERROR }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!desired_date || !/^\d{4}-\d{2}-\d{2}$/.test(desired_date)) {
      return new Response(
        JSON.stringify({ error: "desired_date è obbligatorio (formato YYYY-MM-DD)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!num_guests || typeof num_guests !== "number" || num_guests < 1) {
      return new Response(
        JSON.stringify({ error: "num_guests è obbligatorio e deve essere >= 1" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (num_guests > BOOKING_PUBLIC_CLIENT_TEXT_LIMITS.numGuestsMax) {
      return new Response(
        JSON.stringify({ error: TEXT_TOO_LONG_ERROR }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Resolve tenant from slug ---
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, max_booking_requests_per_year")
      .eq("slug", tenantSlug)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organizzazione non trovata" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = org.id;
    const maxRequestsPerYear = org.max_booking_requests_per_year;

    // --- Check annual limits ---
    const currentYear = new Date().getFullYear();
    const { data: usage } = await supabaseAdmin
      .from("tenant_usage")
      .select("booking_requests_count")
      .eq("organization_id", orgId)
      .eq("year", currentYear)
      .single();

    if (usage && usage.booking_requests_count >= maxRequestsPerYear) {
      return new Response(
        JSON.stringify({ error: "Limite annuale di richieste raggiunto per questa organizzazione" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Rate limiting by IP ---
    // Regole (definite con utente 2026-05-23):
    //   - max 3 richieste/min per IP
    //   - se l'IP sfora >=2 volte in 10 min → ban 24h (tabella ip_blacklist)
    //   - blacklist auto-scaduta dopo 24h per non bannare permanentemente
    //     IP dinamici (NAT, mobile, WiFi pubblici)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    // Check blacklist attiva
    const { data: blacklistedRow } = await supabaseAdmin
      .from("ip_blacklist")
      .select("expires_at")
      .eq("ip_address", ip)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (blacklistedRow) {
      return new Response(
        JSON.stringify({
          error: "Accesso temporaneamente bloccato per violazione ripetuta del rate limit. Riprova tra 24 ore.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = Date.now();
    const oneMinuteAgo = new Date(now - 60_000).toISOString();
    const tenMinutesAgo = new Date(now - 10 * 60_000).toISOString();

    // 1. Richieste nell'ultimo minuto
    const { count: recentRequests } = await supabaseAdmin
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("endpoint", "create-booking")
      .gte("requested_at", oneMinuteAgo);

    if (recentRequests !== null && recentRequests >= 3) {
      // Sforamento: conta quante volte questo IP ha sforato negli ultimi 10 min
      // (= quanti "tentativi" totali ha fatto sopra soglia).
      // Heuristica: se ha già >=6 richieste in 10 min, significa che sta sforando
      // sistematicamente → blacklist 24h.
      const { count: tenMinRequests } = await supabaseAdmin
        .from("rate_limits")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", ip)
        .eq("endpoint", "create-booking")
        .gte("requested_at", tenMinutesAgo);

      if (tenMinRequests !== null && tenMinRequests >= 6) {
        await supabaseAdmin
          .from("ip_blacklist")
          .upsert({
            ip_address: ip,
            blocked_at: new Date().toISOString(),
            expires_at: new Date(now + 24 * 60 * 60_000).toISOString(),
            reason: "rate_limit_violation",
          });

        return new Response(
          JSON.stringify({
            error: "Accesso bloccato per 24 ore: rilevati troppi tentativi ripetuti.",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Troppe richieste. Riprova tra un minuto." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Slot availability guard ---
    // Eseguito con service_role: bypassa RLS, vede tutto il necessario.
    if (desired_date && desired_time && num_guests) {
      // Leggi impostazioni
      const { data: settingsRows } = await supabaseAdmin
        .from("restaurant_settings")
        .select("setting_key, setting_value")
        .eq("tenant_id", orgId)
        .eq("setting_key", "booking_time_slots_enabled");

      const sMap: Record<string, unknown> = {};
      for (const r of settingsRows ?? []) sMap[r.setting_key] = r.setting_value;
      const timeSlotsEnabled: boolean =
        sMap["booking_time_slots_enabled"] === false ? false : true;

      // Prenotazioni accettate del giorno
      const dateStart = `${desired_date}T00:00:00`;
      const dateEnd = `${desired_date}T23:59:59`;
      const { data: dayBookings } = await supabaseAdmin
        .from("booking_requests")
        .select("confirmed_start, confirmed_end, num_guests")
        .eq("tenant_id", orgId)
        .eq("status", "accepted")
        .gte("confirmed_start", dateStart)
        .lte("confirmed_start", dateEnd);

      // Check per-fascia
      if (timeSlotsEnabled) {
        const { data: slotsRows } = await supabaseAdmin
          .from("service_slots")
          .select("id, name, start_time, end_time, max_guests, display_order")
          .eq("tenant_id", orgId)
          .order("display_order");

        const slots = slotsRows ?? [];

        if (slots.length > 0) {
          const parseHm = (t: string) => {
            const [h, m] = t.substring(0, 5).split(":").map(Number);
            return h * 60 + m;
          };
          const isInSlot = (time: string, s: string, e: string) => {
            const t = parseHm(time), sv = parseHm(s), ev = parseHm(e);
            return ev < sv ? (t >= sv || t <= ev) : (t >= sv && t <= ev);
          };
          const segsOverlap = (aS: number, aE: number, bS: number, bE: number) => {
            const a: [number,number][] = aE < aS ? [[aS,1440],[0,aE]] : [[aS,aE]];
            const b: [number,number][] = bE < bS ? [[bS,1440],[0,bE]] : [[bS,bE]];
            return a.some(([as,ae]) => b.some(([bs,be]) => as < be && bs < ae));
          };
          const getOccupiedSlots = (cStart: string, cEnd: string) => {
            const st = cStart.match(/T(\d{2}:\d{2})/)?.[1] ?? "";
            const et = cEnd.match(/T(\d{2}:\d{2})/)?.[1] ?? "";
            if (!st || !et) return [];
            return slots
              .filter((s: { start_time: string; end_time: string }) =>
                segsOverlap(parseHm(st), parseHm(et), parseHm(s.start_time), parseHm(s.end_time))
              )
              .map((s: { id: string }) => s.id);
          };

          const matchedSlot = [...slots]
            .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
            .find((s: { start_time: string; end_time: string }) =>
              isInSlot(desired_time, s.start_time, s.end_time)
            );

          if (matchedSlot) {
            // Leggi override
            const { data: ovRow } = await supabaseAdmin
              .from("service_slot_overrides")
              .select("max_guests")
              .eq("tenant_id", orgId)
              .eq("service_slot_id", matchedSlot.id)
              .eq("override_date", desired_date)
              .maybeSingle();

            const cap: number | null = ovRow?.max_guests ?? matchedSlot.max_guests ?? null;

            if (cap != null) {
              const occupied = (dayBookings ?? []).reduce(
                (acc: number, b: { confirmed_start: string; confirmed_end: string; num_guests: number }) => {
                  const ids = getOccupiedSlots(b.confirmed_start, b.confirmed_end);
                  return ids.includes(matchedSlot.id) ? acc + (b.num_guests ?? 0) : acc;
                }, 0
              );
              if (occupied + num_guests > cap) {
                return new Response(
                  JSON.stringify({
                    error: `Spiacenti, la fascia "${matchedSlot.name}" è al completo per questa data.`,
                    code: "SLOT_LIMIT",
                    slotName: matchedSlot.name,
                  }),
                  { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          }
        }
      }
    }

    // --- Insert booking request ---
    let resolvedMenuPromoLabels: string[] | null =
      Array.isArray(menu_promo_labels) && menu_promo_labels.length > 0
        ? menu_promo_labels
            .map((label: unknown) => String(label ?? "").trim())
            .filter((label: string) => label.length > 0)
        : null;

    if (!resolvedMenuPromoLabels?.length && booking_type) {
      const { data: promosRow } = await supabaseAdmin
        .from("restaurant_settings")
        .select("setting_value")
        .eq("tenant_id", orgId)
        .eq("setting_key", "booking_menu_promos")
        .maybeSingle();

      const promos = promosRow?.setting_value;
      if (Array.isArray(promos)) {
        const labels = promos
          .filter(
            (p: {
              label?: string;
              message?: string;
              placement?: string;
              booking_type?: string;
              booking_types?: string[];
              visible_on_booking?: boolean;
            }) => {
              if (p.visible_on_booking === false) return false;
              if (String(p.message ?? "").trim().length === 0) return false;
              const types = Array.isArray(p.booking_types)
                ? p.booking_types
                : p.booking_type
                  ? [p.booking_type]
                  : [];
              if (p.placement === "booking_type" && types.includes(booking_type)) {
                return true;
              }
              if (
                !p.placement &&
                types.includes(booking_type)
              ) {
                return true;
              }
              return false;
            },
          )
          .map((p: { label?: string }) => String(p.label ?? "").trim())
          .filter((label: string) => label.length > 0);

        if (labels.length > 0) {
          resolvedMenuPromoLabels = [labels[0]];
        }
      }
    }

    const insertData: Record<string, unknown> = {
      tenant_id: orgId,
      client_name,
      client_email: clientEmailNormalized,
      client_phone: client_phone || null,
      desired_date,
      desired_time: desired_time || null,
      num_guests,
      special_requests: special_requests || null,
      booking_type: booking_type || null,
      event_type: event_type || null,
      menu: menu || null,
      menu_selection: menu_selection || null,
      menu_total_per_person: menu_total_per_person ?? null,
      menu_total_booking: menu_total_booking ?? null,
      dietary_restrictions: dietary_restrictions || null,
      preset_menu: preset_menu || null,
      placement: placement || null,
      menu_promo_labels: resolvedMenuPromoLabels,
      booking_source: "public",
      status: "pending",
    };

    const { data: booking, error: insertError } = await supabaseAdmin
      .from("booking_requests")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Errore durante il salvataggio della prenotazione" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Upsert customer in CRM ---
    // service_role bypassa RLS; il trigger enforce_customer_tenant salta il check
    // se auth.role() != 'authenticated', quindi l'insert è sicuro da Edge Function.
    if (clientEmailNormalized) {
      const { data: existingCustomer } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("tenant_id", orgId)
        .eq("email", clientEmailNormalized.toLowerCase())
        .maybeSingle();

      if (existingCustomer) {
        await supabaseAdmin
          .from("customers")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", existingCustomer.id);
      } else {
        await supabaseAdmin.from("customers").insert({
          tenant_id: orgId,
          name: client_name,
          email: clientEmailNormalized,
          phone: client_phone || null,
          source: "synced",
        });
      }
    }

    // --- Record IP in rate_limits ---
    await supabaseAdmin.from("rate_limits").insert({
      ip_address: ip,
      endpoint: "create-booking",
    });

    // --- Return success ---
    return new Response(
      JSON.stringify({ success: true, booking }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
