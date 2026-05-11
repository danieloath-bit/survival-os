import { describe, expect, it } from 'vitest'
import { defaultSettings, seedPlans } from '../data/seed'
import { getDashboardActions } from './actions'
import { getDuplicateCandidates, ignoreDuplicateCandidate, mergeDuplicateGroup } from './duplicates'
import { getPlanReadiness } from './plans'
import { getResourceSummary } from './readiness'
import type { InventoryItem } from '../types'

describe('inventory duplicate detection and merge', () => {
  it('detects same catalog item with compatible unit as merge candidate', () => {
    const items: InventoryItem[] = [
      { id: 'a', name: 'Water purification tablets', catalogItemId: 'water-purification-tablets', category: 'water', quantity: 1, unit: 'pack' },
      { id: 'b', name: 'water purifying tablets', catalogItemId: 'water-purification-tablets', category: 'water', quantity: 2, unit: 'pack' },
    ]
    const candidates = getDuplicateCandidates(items)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      catalogItemId: 'water-purification-tablets',
      mergeable: true,
      itemCount: 2,
    })
  })

  it('merges same catalog item and same unit, preserving merge rules', () => {
    const items: InventoryItem[] = [
      {
        id: 'a',
        name: 'Water purification tablets',
        catalogItemId: 'water-purification-tablets',
        category: 'water',
        quantity: 1,
        unit: 'pack',
        notes: 'Shelf A',
        expiryDate: '2026-08-01',
        location: 'Pantry',
      },
      {
        id: 'b',
        name: 'Purification tablets',
        catalogItemId: 'water-purification-tablets',
        category: 'water',
        quantity: 2,
        unit: 'pack',
        notes: 'Shelf B',
        expiryDate: '2026-06-01',
        location: 'Garage',
      },
    ]

    const result = mergeDuplicateGroup(items, 'water-purification-tablets')
    expect(result.merged).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      catalogItemId: 'water-purification-tablets',
      quantity: 3,
      location: 'Multiple',
      expiryDate: '2026-06-01',
    })
    expect(result.items[0].notes).toContain('Shelf A')
    expect(result.items[0].notes).toContain('Shelf B')
  })

  it('does not detect duplicates for different catalog items', () => {
    const items: InventoryItem[] = [
      { id: 'a', name: 'Rice', catalogItemId: 'rice', category: 'food', quantity: 4, unit: 'kg' },
      { id: 'b', name: 'Pasta', catalogItemId: 'pasta', category: 'food', quantity: 4, unit: 'kg' },
    ]
    expect(getDuplicateCandidates(items)).toHaveLength(0)
  })

  it('does not detect duplicates for custom items without catalog ids', () => {
    const items: InventoryItem[] = [
      { id: 'a', name: 'Grey water tank', category: 'water', quantity: 1, unit: 'unit' },
      { id: 'b', name: 'grey water tank', category: 'water', quantity: 1, unit: 'unit' },
    ]
    expect(getDuplicateCandidates(items)).toHaveLength(0)
  })

  it('hides ignored duplicate groups while their fingerprint stays unchanged', () => {
    const items: InventoryItem[] = [
      { id: 'a', name: 'Drinking water (potable)', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 12, unit: 'L' },
      { id: 'b', name: 'Bottled water', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 24, unit: 'bottle', litresPerUnit: 1 },
    ]
    const [candidate] = getDuplicateCandidates(items)
    const ignored = ignoreDuplicateCandidate([], candidate)

    expect(getDuplicateCandidates(items, ignored)).toHaveLength(0)
  })

  it('resurfaces an ignored duplicate group when item details change', () => {
    const items: InventoryItem[] = [
      { id: 'a', name: 'Drinking water (potable)', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 12, unit: 'L' },
      { id: 'b', name: 'Bottled water', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 24, unit: 'bottle', litresPerUnit: 1 },
    ]
    const [candidate] = getDuplicateCandidates(items)
    const ignored = ignoreDuplicateCandidate([], candidate)
    const changed = items.map((item) => (item.id === 'b' ? { ...item, quantity: 25 } : item))

    expect(getDuplicateCandidates(changed, ignored)).toHaveLength(1)
  })

  it('blocks merge on unit conflict', () => {
    const items: InventoryItem[] = [
      { id: 'a', name: 'Water purification tablets', catalogItemId: 'water-purification-tablets', category: 'water', quantity: 1, unit: 'pack' },
      { id: 'b', name: 'Water purification tablets', catalogItemId: 'water-purification-tablets', category: 'water', quantity: 30, unit: 'unit' },
    ]
    const candidates = getDuplicateCandidates(items)
    expect(candidates[0].mergeable).toBe(false)

    const result = mergeDuplicateGroup(items, 'water-purification-tablets')
    expect(result.merged).toBe(false)
  })

  it('converts L and mL deterministically during merge', () => {
    const items: InventoryItem[] = [
      { id: 'a', name: 'Drinking water (potable)', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 1, unit: 'L' },
      { id: 'b', name: 'Drinking water (potable)', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 500, unit: 'mL' },
    ]

    const result = mergeDuplicateGroup(items, 'drinking-water-potable')
    expect(result.merged).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].unit).toBe('L')
    expect(result.items[0].quantity).toBe(1.5)
  })

  it('blocks L and bottle merge when bottle volume is not deterministic', () => {
    const items: InventoryItem[] = [
      { id: 'a', name: 'Drinking water (potable)', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 1, unit: 'L' },
      { id: 'b', name: 'Drinking water (potable)', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 1, unit: 'bottle' },
    ]

    const result = mergeDuplicateGroup(items, 'drinking-water-potable')
    expect(result.merged).toBe(false)
  })

  it('blocks count and pack merge without known pack size', () => {
    const items: InventoryItem[] = [
      { id: 'a', name: 'Water purification tablets', catalogItemId: 'water-purification-tablets', category: 'water', quantity: 1, unit: 'pack' },
      { id: 'b', name: 'Water purification tablets', catalogItemId: 'water-purification-tablets', category: 'water', quantity: 1, unit: 'count' },
    ]

    const result = mergeDuplicateGroup(items, 'water-purification-tablets')
    expect(result.merged).toBe(false)
  })

  it('supports readiness and action queue recompute after merge', () => {
    const plan = seedPlans.find((entry) => entry.id === 'water-contamination')!
    const items: InventoryItem[] = [
      { id: 'w1', name: 'Drinking water (potable)', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 25, unit: 'L', litresPerUnit: 1 },
      { id: 'w2', name: 'Stored potable water', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 20, unit: 'L', litresPerUnit: 1 },
      { id: 'tabs', name: 'Water purification tablets', catalogItemId: 'water-purification-tablets', category: 'water', quantity: 1, unit: 'pack' },
    ]
    const merged = mergeDuplicateGroup(items, 'drinking-water-potable')
    expect(merged.merged).toBe(true)
    expect(merged.items).toHaveLength(2)

    const summary = getResourceSummary(merged.items, defaultSettings)
    const readiness = getPlanReadiness(plan, merged.items, defaultSettings)
    const actions = getDashboardActions({
      activePlan: plan,
      items: merged.items,
      planReadiness: readiness,
      settings: defaultSettings,
      summary,
    })

    expect(summary.totalWaterLitres).toBe(45)
    expect(actions.some((action) => action.id === 'resource-water')).toBe(true)
  })
})
