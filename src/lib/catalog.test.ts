import { describe, expect, it } from 'vitest'
import type { EmergencyPlan, InventoryItem } from '../types'
import {
  findBestCatalogMatch,
  findCatalogMatches,
  getCatalogItemById,
  getInventoryCategoryForCatalogItem,
  itemMatchesRequirement,
  normalizeInventoryItem,
} from './catalog'
import { getPlanReadiness } from './plans'
import {
  addOrUpdateUserAlias,
  loadInventory,
  loadUserAliases,
  resetToSeedData,
} from './storage'

describe('catalog matching', () => {
  it('returns multiple catalog suggestions for water', () => {
    const matches = findCatalogMatches('water')

    expect(matches.length).toBeGreaterThan(2)
    expect(matches.map((item) => item.id)).toContain('drinking-water-potable')
  })

  it('matches water purifying tablets to the canonical purification item', () => {
    expect(findBestCatalogMatch('water purifying tablets')?.id).toBe('water-purification-tablets')
  })

  it('catalogItemId still works after display name changes', () => {
    const item: InventoryItem = {
      id: 'tabs',
      name: 'water purifying tablets',
      catalogItemId: 'water-purification-tablets',
      category: 'water',
      quantity: 1,
      unit: 'pack',
    }

    expect(
      itemMatchesRequirement(item, {
        id: 'req',
        label: 'Purification tablets',
        catalogItemId: 'water-purification-tablets',
        category: 'water',
        minQuantity: 1,
        unit: 'pack',
      }),
    ).toBe(true)
  })

  it('custom unmatched items do not satisfy specific catalog requirements', () => {
    const item: InventoryItem = {
      id: 'grey-water',
      name: 'grey water tank',
      category: 'water',
      quantity: 100,
      unit: 'L',
    }

    expect(
      itemMatchesRequirement(item, {
        id: 'req',
        label: 'Stored potable water',
        catalogItemId: 'drinking-water-potable',
        category: 'water',
        minQuantity: 56,
        unit: 'L',
      }),
    ).toBe(false)
  })

  it('water treatment does not count as potable water and potable water does not satisfy tablets', () => {
    const plan: EmergencyPlan = {
      id: 'water-test',
      name: 'Water Test',
      summary: 'Test',
      category: 'water',
      trigger: 'Test',
      priority: 'high',
      requirements: [
        { id: 'potable', label: 'Stored potable water', catalogItemId: 'drinking-water-potable', category: 'water', minQuantity: 10, unit: 'L' },
        { id: 'tabs', label: 'Purification tablets', catalogItemId: 'water-purification-tablets', category: 'water', minQuantity: 2, unit: 'pack' },
      ],
      tasks: [],
    }
    const readiness = getPlanReadiness(plan, [
      { id: 'water', name: 'Drinking water (potable)', catalogItemId: 'drinking-water-potable', category: 'water', quantity: 10, unit: 'L' },
      { id: 'tabs', name: 'Water purification tablets', catalogItemId: 'water-purification-tablets', category: 'water', quantity: 1, unit: 'pack' },
    ])

    expect(readiness.missing).toHaveLength(1)
    expect(readiness.missing[0].requirement.id).toBe('tabs')
    expect(readiness.missing[0].currentAmount).toBe(1)
  })
})

describe('user entry history', () => {
  it('keeps previous entries without duplicating normalized names', () => {
    const first = addOrUpdateUserAlias([], { text: 'grey water tank', category: 'water', unit: 'L' })
    const second = addOrUpdateUserAlias(first, { text: 'Grey   water tank', category: 'water', unit: 'L' })

    expect(second).toHaveLength(1)
    expect(second[0].usageCount).toBe(2)
  })

  it('reset seed data does not delete catalog or user history', () => {
    localStorage.clear()
    const aliases = addOrUpdateUserAlias([], { text: 'grey water tank', category: 'water', unit: 'L' })
    localStorage.setItem('survival-os.inventory-aliases', JSON.stringify(aliases))

    resetToSeedData()

    expect(loadInventory().length).toBeGreaterThan(0)
    expect(loadUserAliases()).toHaveLength(1)
    expect(findBestCatalogMatch('water purifying tablets')?.id).toBe('water-purification-tablets')
  })

  it('derives inventory category from catalog item value type when catalogItemId exists', () => {
    expect(getInventoryCategoryForCatalogItem(getCatalogItemById('fuel-jerry-can'))).toBe('fuel')
    expect(getInventoryCategoryForCatalogItem(getCatalogItemById('water-purification-tablets'))).toBe('water')
  })

  it('normalizes catalog-backed inventory category from catalog item id', () => {
    const item = normalizeInventoryItem({
      id: 'fuel',
      name: 'Jerry can (fuel)',
      catalogItemId: 'fuel-jerry-can',
      category: 'tools',
      quantity: 1,
      unit: 'L',
    })

    expect(item.category).toBe('fuel')
  })
})
