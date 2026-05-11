import { beforeEach, describe, expect, it } from 'vitest'
import { seedInventory, seedPlans } from '../data/seed'
import { getPlanReadiness, getRecommendedPlan, getTaskExecutionPhase, getTaskPlanningPhase, resetPlanTasks } from './plans'
import { loadPlans, resetPlansToSeed, savePlans } from './storage'

describe('plan readiness', () => {
  it('calculates requirement coverage and missing items from inventory', () => {
    const plan = seedPlans.find((entry) => entry.id === 'power-outage')!
    const readiness = getPlanReadiness(plan, seedInventory)

    expect(readiness.readiness).toBeGreaterThan(0)
    expect(readiness.missing.map((gap) => gap.requirement.id)).toContain('po-power-bank')
    expect(readiness.missing.map((gap) => gap.requirement.id)).toContain('po-fuel')
  })

  it('counts a plan-created generator fuel item against the generator fuel requirement', () => {
    const plan = seedPlans.find((entry) => entry.id === 'power-outage')!
    const readiness = getPlanReadiness(plan, [
      ...seedInventory,
      {
        id: 'added-generator-fuel',
        name: 'Generator fuel',
        category: 'fuel',
        quantity: 8,
        unit: 'L',
        litresPerUnit: 1,
      },
    ])

    expect(readiness.missing.map((gap) => gap.requirement.id)).not.toContain('po-fuel')
  })

  it('does not count purification tablet packs as potable water litres', () => {
    const plan = seedPlans.find((entry) => entry.id === 'water-contamination')!
    const inventory = seedInventory.filter((item) => item.id !== 'water-tablets')
    const readiness = getPlanReadiness(plan, [
      ...inventory,
      {
        id: 'one-tablet-pack',
        name: 'Water purification tablets',
        category: 'water',
        quantity: 1,
        unit: 'pack',
      },
    ])
    const waterGap = readiness.missing.find((gap) => gap.requirement.id === 'wc-water')
    const tabletGap = readiness.missing.find((gap) => gap.requirement.id === 'wc-tablets')

    expect(waterGap?.currentAmount).toBe(24)
    expect(tabletGap?.currentAmount).toBe(1)
  })

  it('matches itemName before category fallback for count requirements', () => {
    const readiness = getPlanReadiness(
      {
        id: 'tablet-test',
        name: 'Tablet Test',
        summary: 'Test',
        category: 'water',
        trigger: 'Test',
        priority: 'high',
        requirements: [
          {
            id: 'tabs',
            label: 'Purification tablets',
            itemName: 'Water purification tablets',
            category: 'water',
            minQuantity: 3,
            unit: 'pack',
          },
        ],
        tasks: [],
      },
      [
        { id: 'water', name: 'Stored potable water', category: 'water', quantity: 100, unit: 'L' },
        { id: 'tabs', name: 'Water purification tablets', category: 'water', quantity: 1, unit: 'pack' },
      ],
    )

    expect(readiness.missing[0].currentAmount).toBe(1)
    expect(readiness.missing[0].deficit).toBe(2)
  })

  it('does not count unrelated medical items against named medical requirements', () => {
    const readiness = getPlanReadiness(
      {
        id: 'medical-test',
        name: 'Medical Test',
        summary: 'Test',
        category: 'medical',
        trigger: 'Test',
        priority: 'high',
        requirements: [
          { id: 'gloves', label: 'Medical gloves', itemName: 'Medical gloves', category: 'medical', minQuantity: 20, unit: 'pair' },
        ],
        tasks: [],
      },
      [
        { id: 'bandages', name: 'Bandages', category: 'medical', quantity: 50, unit: 'roll' },
      ],
    )

    expect(readiness.missing[0].currentAmount).toBe(0)
  })

  it('keeps preparedness readiness stable while task completion changes response progress', () => {
    const plan = seedPlans.find((entry) => entry.id === 'power-outage')!
    const started = {
      ...plan,
      tasks: plan.tasks.map((task, index) => ({ ...task, completed: index < 5 })),
    }
    const base = getPlanReadiness(plan, seedInventory)
    const withCompletedTasks = getPlanReadiness(started, seedInventory)

    expect(withCompletedTasks.preparednessReadiness).toBe(base.preparednessReadiness)
    expect(withCompletedTasks.responseProgress).toBeGreaterThan(base.responseProgress)
  })

  it('updates preparedness readiness when required supplies change', () => {
    const plan = seedPlans.find((entry) => entry.id === 'power-outage')!
    const base = getPlanReadiness(plan, seedInventory)
    const improved = getPlanReadiness(plan, [
      ...seedInventory,
      {
        id: 'added-generator-fuel-large',
        name: 'Generator fuel',
        catalogItemId: 'fuel-jerry-can',
        category: 'fuel',
        quantity: 20,
        unit: 'L',
        litresPerUnit: 1,
      },
      {
        id: 'added-power-bank',
        name: 'Power bank',
        catalogItemId: 'power-bank',
        category: 'energy',
        quantity: 2,
        unit: 'unit',
      },
    ])

    expect(improved.preparednessReadiness).toBeGreaterThan(base.preparednessReadiness)
  })

  it('recommends the weakest high-priority plan', () => {
    const recommended = getRecommendedPlan(seedPlans, seedInventory)

    expect(recommended.priority === 'critical' || recommended.priority === 'high').toBe(true)
  })

  it('resets completed tasks', () => {
    const plan = {
      ...seedPlans[0],
      tasks: seedPlans[0].tasks.map((task) => ({ ...task, completed: true })),
    }

    expect(resetPlanTasks(plan).tasks.every((task) => !task.completed)).toBe(true)
  })

  it('falls back task phase to execution and planning groups', () => {
    const nowTask = {
      id: 'fallback-1',
      title: 'Stop using tap water',
      priority: 'critical' as const,
      completed: false,
    }
    const nextTask = {
      id: 'fallback-2',
      title: 'Set up treatment batch',
      priority: 'high' as const,
      completed: false,
    }
    const laterTask = {
      id: 'fallback-3',
      title: 'Recovery status log',
      priority: 'medium' as const,
      completed: false,
    }

    expect(getTaskExecutionPhase(nowTask)).toBe('now')
    expect(getTaskExecutionPhase(nextTask)).toBe('next')
    expect(getTaskExecutionPhase(laterTask)).toBe('later')
    expect(getTaskPlanningPhase(nowTask)).toBe('Immediate')
    expect(getTaskPlanningPhase(nextTask)).toBe('First Hour')
    expect(getTaskPlanningPhase(laterTask)).toBe('Ongoing')
  })
})

describe('plan storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists task completion state', () => {
    const plans = seedPlans.map((plan) =>
      plan.id === 'power-outage'
        ? {
            ...plan,
            tasks: plan.tasks.map((task, index) => ({
              ...task,
              completed: index === 0,
            })),
          }
        : plan,
    )

    savePlans(plans)
    const loaded = loadPlans()
    const powerOutage = loaded.find((plan) => plan.id === 'power-outage')!

    expect(powerOutage.tasks[0].completed).toBe(true)
  })

  it('resets plans to seed state', () => {
    savePlans([])

    expect(resetPlansToSeed()).toHaveLength(seedPlans.length)
    expect(loadPlans()).toHaveLength(seedPlans.length)
  })
})

describe('plan add item quantity formatting guard', () => {
  it('keeps recurring decimal deficits small enough for form prefill', () => {
    const deficit = 56 - 53.66

    expect(Number(deficit.toFixed(2)).toString()).toBe('2.34')
  })
})
