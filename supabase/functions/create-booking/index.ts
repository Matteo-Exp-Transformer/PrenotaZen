import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEdgeLogger } from "../_shared/log.ts";
import { validateArrivalRules } from "./arrivalValidation.ts";

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

/**
 * Capienza coperti per-fascia letta da `restaurant_settings.slot_guest_capacities`
 * (Record<slotId, number|null>). Fonte allineata al client (`useCapacityCheck`): la UI Classic
 * scrive qui il limite "Coperti max" per fascia, non su `service_slots.max_guests`.
 */
function parseSlotGuestCapacitiesFromDb(raw: unknown): Record<string, number | null> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) { out[k] = null; continue; }
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    out[k] = Number.isNaN(n) ? null : n;
  }
  return out;
}

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

interface SlotOverrideRow {
  max_guests: number | null;
  date_from: string;
  date_to: string;
  created_at: string;
}

/**
 * Replica server-side di resolveSlotOverride (useServiceSlotOverrides.ts).
 * Tra gli override che coprono desiredDate, vince lo span più corto;
 * a parità di span, vince created_at più recente (stringa ISO confrontabile).
 * Ritorna max_guests del vincitore, o null se nessuna riga.
 */
export function resolveOverrideMaxGuests(
  rows: SlotOverrideRow[],
  desiredDate: string,
): number | null {
  const candidates = rows.filter(
    (r) => r.date_from <= desiredDate && desiredDate <= r.date_to,
  );
  if (candidates.length === 0) return null;

  const winner = candidates.reduce((best, cur) => {
    const spanOf = (r: SlotOverrideRow) =>
      Math.round(
        (new Date(r.date_to + "T00:00:00").getTime() -
          new Date(r.date_from + "T00:00:00").getTime()) /
          86_400_000,
      ) + 1;
    const bs = spanOf(best);
    const cs = spanOf(cur);
    if (cs < bs) return cur;
    if (cs > bs) return best;
    return cur.created_at > best.created_at ? cur : best;
  });

  return winner.max_guests;
}

Deno.serve(async (req: Request) => {
  const log = createEdgeLogger("create-booking", req);

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

    // --- Rate limiting by IP (eseguito PRIMA di qualsiasi validazione/return) ---
    // Falla chiusa: prima l'IP veniva registrato solo dopo un insert riuscito,
    // così i tentativi respinti (payload invalido, tenant assente, limite coperti,
    // conflitto, 429) non venivano mai contati → spam impunito. Ora OGNI tentativo
    // che raggiunge l'endpoint viene registrato e conteggiato qui, una sola volta.
    //
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

    // Registra SUBITO il tentativo: ogni richiesta (valida o respinta più avanti)
    // conta una sola volta. La finestra di conteggio sotto include questa riga,
    // evitando il TOCTOU (registra-poi-conta, non conta-poi-registra).
    await supabaseAdmin.from("rate_limits").insert({
      ip_address: ip,
      endpoint: "create-booking",
    });

    const now = Date.now();
    const oneMinuteAgo = new Date(now - 60_000).toISOString();
    const tenMinutesAgo = new Date(now - 10 * 60_000).toISOString();

    // 1. Richieste nell'ultimo minuto (include il tentativo appena registrato).
    //    Soglia: > 3 perché la riga corrente è già contata; le prime 3/min passano.
    const { count: recentRequests } = await supabaseAdmin
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("endpoint", "create-booking")
      .gte("requested_at", oneMinuteAgo);

    if (recentRequests !== null && recentRequests > 3) {
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
      marketing_consent,
      dietary_data_consent,
      dietary_off_platform_notice,
      dietary_data_consent_at,
      duration_minutes,
      duration_source: _duration_source,
      duration_rule_version: _duration_rule_version,
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

    // Consenso art. 9 GDPR obbligatorio se sono presenti dati alimentari
    if (getDietaryRestrictionsTextLength(dietary_restrictions) > 0 && dietary_data_consent !== true) {
      return new Response(
        JSON.stringify({ error: "Consenso per dati alimentari obbligatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // off_platform e dati presenti sono in conflitto (non deve succedere dal client)
    if (dietary_off_platform_notice === true && getDietaryRestrictionsTextLength(dietary_restrictions) > 0) {
      return new Response(
        JSON.stringify({ error: "Conflitto: off-platform con dati alimentari presenti" }),
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

    const validatedDuration = duration_minutes == null
      ? null
      : Number.isInteger(duration_minutes) && duration_minutes >= 30 && duration_minutes <= 360
        ? duration_minutes
        : undefined;
    if (validatedDuration === undefined) {
      return new Response(
        JSON.stringify({ error: "Durata prenotazione non valida", code: "INVALID_DURATION" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Resolve tenant from slug ---
    // Falla chiusa: filtro is_active=true così un'organizzazione disattivata
    // (is_active=false) è trattata come inesistente — stesso errore/status.
    // Colonna is_active: boolean NOT NULL default true (nessun NULL possibile a
    // livello di schema), quindi il filtro non esclude tenant legittimi.
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, max_booking_requests_per_year")
      .eq("slug", tenantSlug)
      .eq("is_active", true)
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

    // --- Slot availability guard ---
    // Eseguito con service_role: bypassa RLS, vede tutto il necessario.
    if (desired_date && desired_time && num_guests) {
      // Leggi impostazioni
      const { data: settingsRows } = await supabaseAdmin
        .from("restaurant_settings")
        .select("setting_key, setting_value")
        .eq("tenant_id", orgId)
        .in("setting_key", [
          "booking_time_slots_enabled",
          "slot_limit_enabled",
          "booking_reject_out_of_slot",
          "slot_guest_capacities",
          "cutoff_minutes",
          "late_arrival_allowed",
          "min_order_time_minutes",
          "timezone",
        ]);

      const sMap: Record<string, unknown> = {};
      for (const r of settingsRows ?? []) sMap[r.setting_key] = r.setting_value;
      const timeSlotsEnabled: boolean =
        sMap["booking_time_slots_enabled"] === false ? false : true;
      // Blocco per-fascia: disattivato di default (decisione Matteo 11-06-26).
      // Interruttore globale: restaurant_settings.slot_limit_enabled = true.
      const slotLimitEnabled: boolean =
        sMap["slot_limit_enabled"] === true || sMap["slot_limit_enabled"] === "true";
      // Vincolo orario: rifiuta gli orari fuori da ogni fascia. Default OFF (decisione Matteo 18-06-26).
      const rejectOutOfSlot: boolean =
        sMap["booking_reject_out_of_slot"] === true || sMap["booking_reject_out_of_slot"] === "true";
      // Capienza per-fascia impostata dalla UI Classic (Record<slotId, number|null>).
      const slotGuestCapacities = parseSlotGuestCapacitiesFromDb(sMap["slot_guest_capacities"]);
      const cutoffMinutes = Number.isFinite(Number(sMap["cutoff_minutes"]))
        ? Math.max(0, Math.min(1440, Number(sMap["cutoff_minutes"]))) : 60;
      const lateArrivalAllowed = sMap["late_arrival_allowed"] === true || sMap["late_arrival_allowed"] === "true";
      const minOrderTimeMinutes = Number.isFinite(Number(sMap["min_order_time_minutes"]))
        ? Math.max(1, Math.min(1440, Number(sMap["min_order_time_minutes"]))) : 45;
      const restaurantTimezone = typeof sMap["timezone"] === "string" && sMap["timezone"].trim()
        ? sMap["timezone"].trim() : "Europe/Rome";

      // Prenotazioni accettate del giorno
      const dateStart = `${desired_date}T00:00:00`;
      const dateEnd = `${desired_date}T23:59:59`;
      const { data: dayBookings } = await supabaseAdmin
        .from("booking_requests")
        .select("confirmed_start, confirmed_end, num_guests")
        .eq("tenant_id", orgId)
        .eq("status", "accepted")
        // I no-show liberano il posto: non occupano coperti verso il limite (decisione Matteo 11-06-26).
        .neq("no_show", true)
        .gte("confirmed_start", dateStart)
        .lte("confirmed_start", dateEnd);

      // Check per-fascia / vincolo orario — entrambi opzionali (default OFF), bloccano solo il pubblico.
      if (timeSlotsEnabled) {
        const { data: slotsRows } = await supabaseAdmin
          .from("service_slots")
          .select("id, name, start_time, end_time, max_guests, min_duration, arrival_step_minutes, display_order")
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

          if (!matchedSlot) {
            return new Response(
              JSON.stringify({ error: "Spiacenti, l'orario scelto non rientra negli orari di servizio.", code: "OUT_OF_SLOT" }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const nowParts = new Intl.DateTimeFormat("en-CA", {
            timeZone: restaurantTimezone, year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", hourCycle: "h23",
          }).formatToParts(new Date());
          const part = (type: string) => nowParts.find((entry) => entry.type === type)?.value ?? "00";
          const restaurantToday = `${part("year")}-${part("month")}-${part("day")}`;
          const restaurantNowMinutes = Number(part("hour")) * 60 + Number(part("minute"));
          const arrivalError = validateArrivalRules({
            desiredDate: desired_date, desiredTime: desired_time,
            restaurantToday, restaurantNowMinutes,
            slotStart: matchedSlot.start_time, slotEnd: matchedSlot.end_time,
            arrivalStepMinutes: matchedSlot.arrival_step_minutes,
            cutoffMinutes, lateArrivalAllowed, minOrderTimeMinutes,
            slotMinDuration: matchedSlot.min_duration,
            durationMinutes: validatedDuration,
          });
          if (arrivalError) {
            const message = arrivalError === "INVALID_ARRIVAL_STEP"
              ? "L'orario scelto non rispetta l'intervallo previsto."
              : arrivalError === "INVALID_DURATION"
                ? "La durata scelta è inferiore al minimo della fascia."
                : arrivalError === "OUT_OF_SLOT"
                  ? "Spiacenti, l'orario scelto non rientra negli orari di servizio."
                  : "L'orario scelto non è più prenotabile.";
            return new Response(
              JSON.stringify({ error: message, code: arrivalError }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (slotLimitEnabled) {
            // Leggi tutti gli override che coprono la data (intervallo date_from..date_to inclusivo).
            const { data: ovRows } = await supabaseAdmin
              .from("service_slot_overrides")
              .select("max_guests, date_from, date_to, created_at")
              .eq("tenant_id", orgId)
              .eq("service_slot_id", matchedSlot.id)
              .lte("date_from", desired_date)
              .gte("date_to", desired_date);

            // "Vince il più specifico": tra gli override che coprono la data, lo span più corto;
            // a parità di span, il created_at più recente. Replica resolveSlotOverride lato client.
            const ovMaxGuests = resolveOverrideMaxGuests(ovRows ?? [], desired_date);

            // Priorità cap allineata al client (useCapacityCheck): override → service_slots.max_guests
            // → slot_guest_capacities[slotId] (dove la UI Classic scrive il limite per-fascia).
            const cap: number | null =
              ovMaxGuests ?? matchedSlot.max_guests ?? slotGuestCapacities[matchedSlot.id] ?? null;

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
      marketing_consent: marketing_consent === true,
      dietary_data_consent: dietary_data_consent === true,
      dietary_off_platform_notice: dietary_off_platform_notice === true,
      dietary_data_consent_at: dietary_data_consent === true
        ? (dietary_data_consent_at ?? new Date().toISOString())
        : null,
      duration_minutes: validatedDuration,
      duration_source: validatedDuration == null ? null : "public_form",
      duration_rule_version: validatedDuration == null ? null : 1,
    };

    const { data: booking, error: insertError } = await supabaseAdmin
      .from("booking_requests")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      log.error("Insert error", { err: insertError });
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
          .update({
            updated_at: new Date().toISOString(),
            // Il consenso marketing si aggiorna solo a true: una prenotazione senza spunta
            // non revoca un consenso già dato in precedenza (la revoca avviene via admin).
            ...(marketing_consent === true ? { marketing_consent: true } : {}),
          })
          .eq("id", existingCustomer.id);
      } else {
        await supabaseAdmin.from("customers").insert({
          tenant_id: orgId,
          name: client_name,
          email: clientEmailNormalized,
          phone: client_phone || null,
          source: "synced",
          marketing_consent: marketing_consent === true,
        });
      }
    }

    // Nota: l'IP è già stato registrato all'inizio (vedi blocco rate limiting).
    // Non lo registriamo di nuovo qui, per non contare due volte una richiesta riuscita.

    // --- Return success ---
    return new Response(
      JSON.stringify({ success: true, booking }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log.error("Unexpected error", { err });
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
