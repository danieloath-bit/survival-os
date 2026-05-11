import { describe, expect, it } from 'vitest'
import { defaultSettings, seedInventory } from '../data/seed'
import {
  getDashboardAlerts,
  getDepletionSeries,
  getFuelDays,
  getMedicalExpiryStatus,
  getNextFailurePoint,
  getItemStatus,
  getResourceSummary,
  getStoredValue,
  getTotalFoodCalories,
  getTotalFuelLitres,
  getTotalWaterLitres,
  getWaterDays,
} from './readiness'
import { classifyUnit } from './units'

describe('readiness engine', () => {
  it('calculates resource totals and days from inventory', () => {
    expect(getTotalWaterLitres(seedInventory)).toBe(24)
    expect(getTotalFuelLitres(seedInventory)).toBe(18)
    expect(getTotalFoodCalories(seedInventory)).toBeGreaterThan(60_000)
    expect(getWaterDays(seedInventory, defaultSettings)).toBe(3)
    expect(getFuelDays(seedInventory, defaultSettings)).toBe(5)
  })

  it('treats L units as litres even when litresPerUnit is omitted', () => {
    expect(
      getTotalFuelLitres([
        { id: 'manual-fuel', name: 'Generator fuel', category: 'fuel', quantity: 8, unit: 'L' },
      ]),
    ).toBe(8)
  })

  it('classifies common inventory units', () => {
    expect(classifyUnit('L')).toBe('volume')
    expect(classifyUnit('pack')).toBe('count')
    expect(classifyUnit('kg')).toBe('weight')
  })

  it('does not count water treatment packs as potable litres', () => {
    expect(
      getTotalWaterLitres([
        { id: 'tabs', name: 'Purification tablets', category: 'water', quantity: 3, unit: 'pack' },
      ]),
    ).toBe(0)
  })

  it('counts stored potable water in litres', () => {
    expect(
      getTotalWaterLitres([
        { id: 'water', name: 'Stored potable water', category: 'water', quantity: 12, unit: 'L' },
      ]),
    ).toBe(12)
  })

  it('counts bottled water only when bottle volume is explicit', () => {
    expect(
      getTotalWaterLitres([
        { id: 'plain-bottles', name: 'Bottled water', category: 'water', quantity: 12, unit: 'bottle' },
      ]),
    ).toBe(0)
    expect(
      getTotalWaterLitres([
        { id: 'known-bottles', name: 'Bottled water', category: 'water', quantity: 12, unit: 'bottle', litresPerUnit: 0.6 },
      ]),
    ).toBeCloseTo(7.2)
  })

  it('does not inflate food days for food without calories', () => {
    expect(
      getTotalFoodCalories([
        { id: 'unknown-food', name: 'Mystery ration', category: 'food', quantity: 10, unit: 'pack' },
      ]),
    ).toBe(0)
  })

  it('only counts litre-based fuel or explicit litre equivalents', () => {
    expect(
      getTotalFuelLitres([
        { id: 'can', name: 'Fuel can', category: 'fuel', quantity: 5, unit: 'can' },
        { id: 'litres', name: 'Generator fuel', category: 'fuel', quantity: 6, unit: 'L' },
        { id: 'equiv', name: 'Gas canister', category: 'fuel', quantity: 2, unit: 'canister', litresPerUnit: 1.5 },
      ]),
    ).toBe(9)
  })

  it('labels stored values by usable resource type', () => {
    expect(getStoredValue({ id: 'water', name: 'Stored potable water', category: 'water', quantity: 53, unit: 'L' })).toBe('53 L usable water')
    expect(getStoredValue({ id: 'tabs', name: 'Purification tablets', category: 'water', quantity: 1, unit: 'pack' })).toBe('1 pack treatment supply')
    expect(getStoredValue({ id: 'rice', name: 'Rice', category: 'food', quantity: 8, unit: 'kg', caloriesPerUnit: 3600 })).toBe('28,800 kcal')
    expect(getStoredValue({ id: 'fuel', name: 'Fuel can', category: 'fuel', quantity: 12, unit: 'L' })).toBe('12 L fuel')
  })

  it('generates a resource summary and next failure point', () => {
    const summary = getResourceSummary(seedInventory, defaultSettings)

    expect(summary.waterStatus).toBe('LOW')
    expect(summary.fuelStatus).toBe('LOW')
    expect(summary.foodStatus).toBe('OK')
    expect(getNextFailurePoint(summary)).toMatchObject({ id: 'water', days: 3 })
  })

  it('flags the two seeded medical items expiring within 30 days', () => {
    const medical = getMedicalExpiryStatus(seedInventory, new Date('2026-04-25'))

    expect(medical.status).toBe('WATCH')
    expect(medical.expiringCount).toBe(2)
  })

  it('generates dashboard alerts and depletion series from inventory', () => {
    const summary = getResourceSummary(seedInventory, defaultSettings)
    const alerts = getDashboardAlerts(summary, seedInventory, defaultSettings)
    const series = getDepletionSeries(summary)

    expect(alerts.map((alert) => alert.id)).toContain('water-low')
    expect(alerts.map((alert) => alert.id)).toContain('fuel-low')
    expect(series.find((entry) => entry.id === 'water')?.days).toBe(3)
  })

  it('keeps aggregate resource pressure off individual rows unless the row has its own minimum', () => {
    const settings = {
      ...defaultSettings,
      householdPeople: 2,
      fuelLitresPerDay: 3.6,
    }
    const rows = [
      { id: 'fuel-1', name: 'Fuel can', category: 'fuel' as const, quantity: 15, unit: 'L' },
      { id: 'fuel-2', name: 'Gas canister', category: 'fuel' as const, quantity: 15, unit: 'L' },
    ]
    const summary = getResourceSummary(rows, settings)

    expect(summary.fuelStatus).not.toBe('LOW')
    expect(rows.map((item) => getItemStatus(item))).toEqual(['OK', 'OK'])
  })

  it('still shows LOW when a row has an explicit minimum and fails it', () => {
    expect(
      getItemStatus({ id: 'fuel-1', name: 'Fuel can', category: 'fuel', quantity: 4, unit: 'L', minThreshold: 10 }),
    ).toBe('LOW')
  })

  it('shows WATCH for expiring items and keeps duplicate review separate from preparedness status', () => {
    expect(
      getItemStatus(
        { id: 'med-1', name: 'Paracetamol', category: 'medical', quantity: 1, unit: 'box', expiryDate: '2026-04-29' },
        new Date('2026-04-25'),
      ),
    ).toBe('WATCH')
    expect(
      getItemStatus({ id: 'dup-1', name: 'Water purification tablets', category: 'water', quantity: 1, unit: 'pack' }, new Date()),
    ).toBe('OK')
  })
})
