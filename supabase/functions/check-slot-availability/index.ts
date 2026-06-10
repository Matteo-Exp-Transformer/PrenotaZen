import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceSlotRow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  max_guests: number | null;
  display_order: number;
}

interface SlotOverrideRow {
  service_slot_id: string;
  override_date: string;
  max_guests: number;
}

interface BookingRow {
  confirmed_start: string;
  confirmed_end: string;
  num_guests: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseHm(t: string): number {
  const [h, m] = t.substring(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function rangesOverlap(
  aStart: number, aEnd: number,
  bStart: number, bEnd: number
): boolean {
  // Handle midnight-crossing segments
  const aSegs: [number, number][] = aEnd < aStart
    ? [[aStart, 1440], [0, aEnd]]
    : [[aStart, aEnd]];
  const bSegs: [number, number][] = bEnd < bStart
    ? [[bStart, 1440], [0, bEnd]]
    : [[bStart, bEnd]];
  for (const [as, ae] of aSegs) {
    for (const [bs, be] of bSegs) {
      if (as < be && bs < ae) return true;
    }
  }
  return false;
}

function getSlotIdsOccupiedByBooking(
  startIso: string,
  endIso: string,
  slots: ServiceSlotRow[]
): string[] {
  const startTime = startIso.match(/T(\d{2}:\d{2})/)?.[1] ?? "";
  const endTime = endIso.match(/T(\d{2}:\d{2})/)?.[1] ?? "";
  if (!startTime || !endTime) return [];
  const sMin = parseHm(startTime);
  const eMin = parseHm(endTime);
  return slots
    .filter((s) => rangesOverlap(sMin, eMin, parseHm(s.start_time), parseHm(s.end_time)))
    .map((s) => s.id);
}

function isTimeInsideSlot(time: string, slotStart: string, slotEnd: string): boolean {
  const t = parseHm(time);
  const s = parseHm(slotStart);
  const e = parseHm(slotEnd);
  return e < s ? (t >= s || t <= e) : (t >= s && t <= e);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
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
    const db = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { tenantSlug, desired_date, desired_time, num_guests } = body;

    if (!tenantSlug || !desired_date || !desired_time || !num_guests) {
      return new Response(
        JSON.stringify({ error: "Parametri obbligatori mancanti" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve tenant
    const { data: org, error: orgError } = await db
      .from("organizations")
      .select("id")
      .eq("slug", tenantSlug)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organizzazione non trovata" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const tenantId = org.id;

    // Read settings
    const { data: settingsRows } = await db
      .from("restaurant_settings")
      .select("setting_key, setting_value")
      .eq("tenant_id", tenantId)
      .eq("setting_key", "booking_time_slots_enabled");

    const settingsMap: Record<string, unknown> = {};
    for (const row of settingsRows ?? []) {
      settingsMap[row.setting_key] = row.setting_value;
    }
    // null/undefined → default true (fasce abilitate)
    const timeSlotsEnabled: boolean =
      settingsMap["booking_time_slots_enabled"] === false ? false : true;

    // Read service_slots for tenant
    const { data: slots } = await db
      .from("service_slots")
      .select("id, name, start_time, end_time, max_guests, display_order")
      .eq("tenant_id", tenantId)
      .order("display_order");

    const activeSlots: ServiceSlotRow[] = slots ?? [];

    // Read existing accepted bookings for the date
    const dateStart = `${desired_date}T00:00:00`;
    const dateEnd = `${desired_date}T23:59:59`;
    const { data: existingBookings } = await db
      .from("booking_requests")
      .select("confirmed_start, confirmed_end, num_guests")
      .eq("tenant_id", tenantId)
      .eq("status", "accepted")
      .gte("confirmed_start", dateStart)
      .lte("confirmed_start", dateEnd);

    const dayBookings: BookingRow[] = existingBookings ?? [];

    // Read overrides for the date
    const { data: overridesRows } = await db
      .from("service_slot_overrides")
      .select("service_slot_id, override_date, max_guests")
      .eq("tenant_id", tenantId)
      .eq("override_date", desired_date);

    const overrides: SlotOverrideRow[] = overridesRows ?? [];

    // Helper: get effective capacity for a slot on the target date
    const getSlotCap = (slot: ServiceSlotRow): number | null => {
      const ov = overrides.find((o) => o.service_slot_id === slot.id);
      if (ov) return ov.max_guests;
      return slot.max_guests;
    };

    // --- Per-slot check ---
    if (timeSlotsEnabled && activeSlots.length > 0) {
      // Find which slot the new booking falls into
      const matchedSlot = activeSlots
        .slice()
        .sort((a, b) => a.display_order - b.display_order)
        .find((s) => isTimeInsideSlot(desired_time, s.start_time, s.end_time));

      if (matchedSlot) {
        const cap = getSlotCap(matchedSlot);
        if (cap != null) {
          // Count guests already in this slot
          const occupied = dayBookings.reduce((acc, b) => {
            const ids = getSlotIdsOccupiedByBooking(b.confirmed_start, b.confirmed_end, activeSlots);
            return ids.includes(matchedSlot.id) ? acc + (b.num_guests ?? 0) : acc;
          }, 0);

          if (occupied + num_guests > cap) {
            return new Response(
              JSON.stringify({
                available: false,
                reason: "slot_limit",
                slotName: matchedSlot.name,
                message: `Spiacenti, la fascia "${matchedSlot.name}" è al completo per questa data. Prova con un orario diverso.`,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ available: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("check-slot-availability error:", err);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
