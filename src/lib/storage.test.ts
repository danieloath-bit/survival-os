import { beforeEach, describe, expect, it } from 'vitest'
import { seedInventory, seedPlans } from '../data/seed'
import type { InventoryItem } from '../types'
import {
  loadActiveScenario,
  loadIgnoredDuplicateGroups,
  loadIncidentLog,
  loadInventory,
  loadPlans,
  loadSettings,
  resetToSeedData,
  saveActiveScenario,
  saveIgnoredDuplicateGroups,
  saveIncidentLog,
  saveInventory,
  saveSettings,
} from './storage'

describe('local storage persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads seed data when no local inventory exists', () => {
    expect(loadInventory()).toHaveLength(seedInventory.length)
  })

  it('persists inventory and settings changes', () => {
    const inventory = [
      ...seedInventory,
      {
        id: 'test-water',
        name: 'Test water',
        category: 'water' as const,
        quantity: 8,
        unit: 'L',
        litresPerUnit: 1,
      },
    ]

    saveInventory(inventory)
    saveSettings({
      region: 'AU_NSW',
      householdPeople: 3,
      caloriesPerPersonPerDay: 2100,
      waterLitresPerPersonPerDay: 4,
      fuelLitresPerDay: 3.6,
      targetBufferDays: 7,
    })

    expect(loadInventory()).toHaveLength(seedInventory.length + 1)
    expect(loadSettings().householdPeople).toBe(3)
  })

  it('normalizes catalog-backed inventory categories on load', () => {
    saveInventory([
      {
        id: 'fuel-1',
        name: 'Jerry can (fuel)',
        catalogItemId: 'fuel-jerry-can',
        category: 'tools',
        quantity: 1,
        unit: 'L',
      } as InventoryItem,
    ])

    expect(loadInventory()[0].category).toBe('fuel')
  })

  it('resets local data to the seeded demo state', () => {
    saveInventory([])
    saveActiveScenario({ planId: 'water-contamination', activatedAt: '2026-04-26T00:00:00.000Z' })
    saveIncidentLog([
      {
        id: 'log-1',
        planId: 'water-contamination',
        timestamp: '2026-04-26T00:00:00.000Z',
        type: 'scenario_started',
        message: 'Scenario activated',
      },
    ])
    saveIgnoredDuplicateGroups([
      {
        catalogItemId: 'drinking-water-potable',
        fingerprint: 'a',
        ignoredAt: '2026-04-26T00:00:00.000Z',
      },
    ])
    const reset = resetToSeedData()

    expect(reset.items).toHaveLength(seedInventory.length)
    expect(loadInventory()).toHaveLength(seedInventory.length)
    expect(loadActiveScenario()).toBeUndefined()
    expect(loadIncidentLog()).toHaveLength(0)
    expect(loadIgnoredDuplicateGroups()).toHaveLength(0)
  })

  it('loads saved legacy plan payloads without breaking after phase updates', () => {
    const legacyPlans = seedPlans.map((plan) =>
      plan.id === 'water-contamination'
        ? {
            ...plan,
            tasks: plan.tasks
              .filter((task) => task.id !== 'wc-9')
              .map((task) => ({
                ...task,
                phase: task.id.startsWith('wc-1') || task.id.startsWith('wc-2') || task.id.startsWith('wc-3')
                  ? 'Immediate'
                  : task.id.startsWith('wc-4') || task.id.startsWith('wc-5')
                    ? 'First Hour'
                    : task.id.startsWith('wc-6')
                      ? 'First 24 Hours'
                      : 'Ongoing',
              })),
          }
        : plan,
    )
    localStorage.setItem('survival-os.plans', JSON.stringify(legacyPlans))

    const loaded = loadPlans()
    const waterPlan = loaded.find((plan) => plan.id === 'water-contamination')

    expect(waterPlan).toBeDefined()
    expect(waterPlan?.tasks).toHaveLength(seedPlans.find((plan) => plan.id === 'water-contamination')!.tasks.length)
  })

  it('falls back to seed plans when stored plans payload is malformed', () => {
    localStorage.setItem('survival-os.plans', JSON.stringify({ bad: true }))

    expect(loadPlans()).toHaveLength(seedPlans.length)
  })

  it('persists incident log entries tied to plan ids', () => {
    saveIncidentLog([
      {
        id: 'log-1',
        planId: 'water-contamination',
        timestamp: '2026-04-26T00:00:00.000Z',
        type: 'scenario_started',
        message: 'Scenario activated',
      },
      {
        id: 'log-2',
        planId: 'power-outage',
        timestamp: '2026-04-26T00:10:00.000Z',
        type: 'item_added',
        message: 'Fuel can added (5 L)',
      },
    ])

    const loaded = loadIncidentLog()
    expect(loaded).toHaveLength(2)
    expect(loaded.filter((entry) => entry.planId === 'water-contamination')).toHaveLength(1)
    expect(loaded.filter((entry) => entry.planId === 'power-outage')).toHaveLength(1)
  })

  it('ignores malformed incident log entries', () => {
    localStorage.setItem(
      'survival-os.incident-log',
      JSON.stringify([{ id: 'bad', planId: 'water-contamination', timestamp: '2026-04-26T00:00:00.000Z' }]),
    )

    expect(loadIncidentLog()).toHaveLength(0)
  })

  it('persists ignored duplicate groups', () => {
    saveIgnoredDuplicateGroups([
      {
        catalogItemId: 'drinking-water-potable',
        fingerprint: 'a:drinking-water-potable:l:12::',
        ignoredAt: '2026-04-26T00:00:00.000Z',
      },
    ])

    expect(loadIgnoredDuplicateGroups()).toHaveLength(1)
    expect(loadIgnoredDuplicateGroups()[0].catalogItemId).toBe('drinking-water-potable')
  })
})
