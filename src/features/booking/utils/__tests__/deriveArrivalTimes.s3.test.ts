// @s3-blindatura: arrivi-slot
// Copre: step, cutoff, durata, tardivo, overnight, nessuna durata

import { describe, expect, it } from 'vitest'
import { deriveArrivalTimes, type ArrivalSlotConfig } from '@/features/booking/utils/bookingTimeSlots'

const NOT_TODAY = false
const NOW_NOON = 12 * 60  // 12:00

function validTimes(result: ReturnType<typeof deriveArrivalTimes>) {
  return result.filter(t => t.isValid).map(t => t.time)
}

describe('deriveArrivalTimes — S3 slot di arrivo', () => {
  describe('step base', () => {
    it('calcola lo step dall’inizio fascia, non dalla mezzanotte', () => {
      const result = validTimes(deriveArrivalTimes({
        slot_start: '11:31', slot_end: '13:10', arrival_step_minutes: 30,
      }, NOW_NOON, NOT_TODAY))
      expect(result).toEqual(['11:31', '12:01', '12:31', '13:01'])
    })
    it('fascia 19:00–23:00, step 30, durata 120 → slot fino a 21:00', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '19:00',
        slot_end: '23:00',
        arrival_step_minutes: 30,
        card_duration_minutes: 120,
      }
      const result = validTimes(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY))
      expect(result).toEqual(['19:00', '19:30', '20:00', '20:30', '21:00'])
    })

    it('step 15 genera granularità fine', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '12:00',
        slot_end: '14:00',
        arrival_step_minutes: 15,
        card_duration_minutes: 60,
      }
      const result = validTimes(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY))
      expect(result).toEqual(['12:00', '12:15', '12:30', '12:45', '13:00'])
    })

    it('step 60 genera soli interi', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '19:00',
        slot_end: '22:00',
        arrival_step_minutes: 60,
        card_duration_minutes: 120,
      }
      const result = validTimes(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY))
      expect(result).toEqual(['19:00', '20:00'])
    })
  })

  describe('cutoff (isToday)', () => {
    it('cutoff 60 min: taglia i primi slot passati', () => {
      // Sono le 19:30 (1170 min). Cutoff 60 → solo >=  20:30 (1230)
      const cfg: ArrivalSlotConfig = {
        slot_start: '19:00',
        slot_end: '23:00',
        arrival_step_minutes: 30,
        card_duration_minutes: 60,
        cutoff_minutes: 60,
      }
      const result = validTimes(deriveArrivalTimes(cfg, 19 * 60 + 30, true))
      // 19:00 (1140) < 1170+60=1230 → invalid; 19:30 (1170) < 1230 → invalid
      // 20:00 (1200) < 1230 → invalid; 20:30 (1230) >= 1230 → valid
      expect(result[0]).toBe('20:30')
      expect(result).not.toContain('19:00')
      expect(result).not.toContain('19:30')
      expect(result).not.toContain('20:00')
    })

    it('cutoff non applicato se non è oggi', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '19:00',
        slot_end: '20:00',
        arrival_step_minutes: 30,
        card_duration_minutes: 0,
        cutoff_minutes: 120,
      }
      const result = validTimes(deriveArrivalTimes(cfg, 20 * 60, NOT_TODAY))
      expect(result).toContain('19:00')
      expect(result).toContain('19:30')
    })
  })

  describe('tardivo (late_arrival_allowed)', () => {
    it('tardivo ON: allarga la finestra fino a slot_end - min_order_time', () => {
      // Fascia 19:00-23:00, min_order_time 45 → ultimo arrivo 22:15
      const cfg: ArrivalSlotConfig = {
        slot_start: '19:00',
        slot_end: '23:00',
        arrival_step_minutes: 30,
        card_duration_minutes: 180,  // con tardivo OFF taglierebbe a 20:00
        late_arrival_allowed: true,
        min_order_time_minutes: 45,
      }
      const result = validTimes(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY))
      // Ultimi slot: 22:00 (1320 + 45 = 1365 <= 1380 ✓), 22:30 (1350 + 45 = 1395 > 1380 ✗)
      expect(result).toContain('22:00')
      expect(result).not.toContain('22:30')
    })

    it('tardivo OFF: usa durata per calcolare ultimo arrivo', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '19:00',
        slot_end: '23:00',
        arrival_step_minutes: 30,
        card_duration_minutes: 180,
        late_arrival_allowed: false,
      }
      const result = validTimes(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY))
      // 19:00 + 180 = 22:00 <= 23:00 ✓; 19:30 + 180 = 22:30 > 23:00... wait
      // endMin = 23*60 = 1380; 19:00 = 1140; 1140+180=1320 <= 1380 ✓
      // 19:30=1170; 1170+180=1350 <= 1380 ✓
      // 20:00=1200; 1200+180=1380 <= 1380 ✓
      // 20:30=1230; 1230+180=1410 > 1380 ✗
      expect(result).toContain('20:00')
      expect(result).not.toContain('20:30')
    })
  })

  describe('overnight (mezzanotte)', () => {
    it('fascia overnight 22:00–02:00 genera slot a cavallo mezzanotte', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '22:00',
        slot_end: '02:00',
        arrival_step_minutes: 30,
        card_duration_minutes: 60,
      }
      const result = validTimes(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY))
      expect(result).toContain('22:00')
      expect(result).toContain('23:00')
      expect(result).toContain('00:00')  // mezzanotte
      expect(result).toContain('01:00')
    })

    it('slot overnight: tutti i tempi generati hanno formato HH:MM valido', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '23:00',
        slot_end: '01:00',
        arrival_step_minutes: 30,
        card_duration_minutes: 30,
      }
      const result = validTimes(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY))
      for (const t of result) {
        expect(t).toMatch(/^\d{2}:\d{2}$/)
      }
      expect(result).toContain('23:00')
      expect(result).toContain('23:30')
      expect(result).toContain('00:00')
      expect(result).toContain('00:30')
    })
  })

  describe('nessuna durata', () => {
    it('effectiveDuration=0 (undefined) → tutti gli slot della fascia validi', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '12:00',
        slot_end: '15:00',
        arrival_step_minutes: 60,
        // nessun card_duration_minutes né slot_min_duration
      }
      const result = validTimes(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY))
      expect(result).toEqual(['12:00', '13:00', '14:00'])
    })

    it('slot_min_duration come fallback se card assente', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '19:00',
        slot_end: '23:00',
        arrival_step_minutes: 60,
        slot_min_duration: 120,  // senza card_duration_minutes
      }
      const result = validTimes(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY))
      // 19:00+120=21:00 ✓; 20:00+120=22:00 ✓; 21:00+120=23:00 ✓; 22:00+120=24:00 > 23:00 ✗
      expect(result).toEqual(['19:00', '20:00', '21:00'])
    })
  })

  describe('ritorna tutti gli slot con isValid', () => {
    it('slot con isValid=false presenti ma non validi', () => {
      const cfg: ArrivalSlotConfig = {
        slot_start: '19:00',
        slot_end: '21:00',
        arrival_step_minutes: 30,
        card_duration_minutes: 90,
      }
      const all = deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY)
      // 19:00+90=20:30 ✓; 19:30+90=21:00 ✓; 20:00+90=21:30 > 21:00 ✗; 20:30+90=22:00 ✗
      expect(all.some(t => !t.isValid)).toBe(true)
      const valid = all.filter(t => t.isValid)
      expect(valid.map(t => t.time)).toEqual(['19:00', '19:30'])
    })
  })

  describe('input malformati e confini', () => {
    it.each([
      { slot_start: '25:00', slot_end: '23:00', arrival_step_minutes: 30 },
      { slot_start: '19:00', slot_end: 'xx', arrival_step_minutes: 30 },
      { slot_start: '19:00', slot_end: '23:00', arrival_step_minutes: 0 },
      { slot_start: '19:00', slot_end: '23:00', arrival_step_minutes: 121 },
    ])('ritorna lista vuota per %#', (cfg) => {
      expect(deriveArrivalTimes(cfg, NOW_NOON, NOT_TODAY)).toEqual([])
    })

    it('include il confine esatto di cutoff e durata', () => {
      const result = validTimes(deriveArrivalTimes({
        slot_start: '19:00', slot_end: '21:00', arrival_step_minutes: 30,
        card_duration_minutes: 60, cutoff_minutes: 60,
      }, 18 * 60, true))
      expect(result).toContain('19:00')
      expect(result).toContain('20:00')
    })
  })
})
