import { describe, expect, it } from 'vitest'
import type { AppSettings, InventoryItem } from '../types'
import {
  calculateFoodDays,
  calculateWaterDays,
  getExpiringWithin,
  getRotationItems,
  getSafetyStatus,
} from './inventory'

const settings: AppSettings = {
  region: 'AU_NSW',
  householdPeople: 2,
  caloriesPerPersonPerDay: 2000,
  waterLitresPerPersonPerDay: 4,
  fuelLitresPerDay: 3.6,
  targetBufferDays: 7,
}

function item(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: overrides.id ?? 'item-1',
    name: overrides.name ?? 'Beans',
    category: overrides.category ?? 'food',
    quantity: overrides.quantity ?? 1,
    unit: overrides.unit ?? 'can',
    locationId: overrides.locationId ?? 'pantry',
    dateLabelType: overrides.dateLabelType ?? 'best_before',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('inventory safety logic', () => {
  it('marks AU/NSW use-by food as do not use after the date', () => {
    const result = getSafetyStatus(
      item({ dateLabelType: 'use_by', dateValue: '2026-04-20' }),
      'AU_NSW',
      '2026-04-25',
    )

    expect(result).toBe('do_not_use')
  })

  it('marks AU/NSW best-before food as past quality after the date', () => {
    const result = getSafetyStatus(
      item({ dateLabelType: 'best_before', dateValue: '2026-04-20' }),
      'AU_NSW',
      '2026-04-25',
    )

    expect(result).toBe('past_quality')
  })

  it('treats US infant formula dates as safety-critical', () => {
    const result = getSafetyStatus(
      item({
        name: 'Infant formula powder',
        dateLabelType: 'best_before',
        dateValue: '2026-04-20',
      }),
      'US',
      '2026-04-25',
    )

    expect(result).toBe('do_not_use')
  })
})

describe('inventory calculations', () => {
  it('calculates days of food from calories', () => {
    const result = calculateFoodDays(
      [
        item({ quantity: 4, caloriesPerUnit: 1000 }),
        item({ quantity: 2, caloriesPerUnit: 2000 }),
      ],
      settings,
    )

    expect(result).toBe(2)
  })

  it('calculates days of water from potable litres', () => {
    const result = calculateWaterDays(
      [item({ category: 'water', quantity: 16, potableLitresPerUnit: 1 })],
      settings,
    )

    expect(result).toBe(2)
  })

  it('finds items within an expiry window', () => {
    const result = getExpiringWithin(
      [
        item({ id: 'soon', dateValue: '2026-05-01' }),
        item({ id: 'later', dateValue: '2026-07-01' }),
      ],
      30,
      '2026-04-25',
    )

    expect(result.map((entry) => entry.id)).toEqual(['soon'])
  })

  it('sorts rotation by safety priority then FIFO date', () => {
    const result = getRotationItems(
      [
        item({ id: 'ok', dateLabelType: 'best_before', dateValue: '2026-09-01' }),
        item({ id: 'bad', dateLabelType: 'use_by', dateValue: '2026-04-20' }),
        item({ id: 'soon', dateLabelType: 'best_before', dateValue: '2026-04-30' }),
      ],
      settings,
      '2026-04-25',
    )

    expect(result.map((entry) => entry.id)).toEqual(['bad', 'soon', 'ok'])
  })
})
