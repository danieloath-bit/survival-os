import { describe, expect, it } from 'vitest'
import { defaultSettings, seedInventory, seedPlans } from '../data/seed'
import { getDashboardActions } from './actions'
import { getPlanReadiness } from './plans'
import { getResourceSummary } from './readiness'

describe('dashboard action queue', () => {
  it('prioritises water deficits from resource data', () => {
    const plan = seedPlans.find((entry) => entry.id === 'water-contamination')!
    const summary = getResourceSummary(seedInventory, defaultSettings)
    const actions = getDashboardActions({
      activePlan: plan,
      items: seedInventory,
      planReadiness: getPlanReadiness(plan, seedInventory, defaultSettings),
      settings: defaultSettings,
      summary,
    })

    expect(actions[0]).toMatchObject({
      source: 'resource',
      relatedCatalogItemId: 'drinking-water-potable',
    })
  })

  it('removes water deficit action when potable water meets the target', () => {
    const plan = seedPlans.find((entry) => entry.id === 'water-contamination')!
    const items = [
      ...seedInventory,
      {
        id: 'extra-water',
        name: 'Drinking water (potable)',
        catalogItemId: 'drinking-water-potable',
        category: 'water' as const,
        quantity: 100,
        unit: 'L',
      },
    ]
    const actions = getDashboardActions({
      activePlan: plan,
      items,
      planReadiness: getPlanReadiness(plan, items, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(items, defaultSettings),
    })

    expect(actions.some((action) => action.id === 'resource-water')).toBe(false)
  })

  it('adds incomplete critical plan tasks as actions', () => {
    const plan = seedPlans.find((entry) => entry.id === 'power-outage')!
    const actions = getDashboardActions({
      activeScenario: { planId: plan.id, activatedAt: '2026-04-26T00:00:00.000Z' },
      activePlan: plan,
      items: seedInventory,
      planReadiness: getPlanReadiness(plan, seedInventory, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(seedInventory, defaultSettings),
    })

    expect(actions.some((action) => action.source === 'task' && action.taskId === 'po-1')).toBe(true)
  })

  it('does not include plan checklist tasks when no scenario is active', () => {
    const plan = seedPlans.find((entry) => entry.id === 'power-outage')!
    const actions = getDashboardActions({
      activePlan: plan,
      items: seedInventory,
      planReadiness: getPlanReadiness(plan, seedInventory, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(seedInventory, defaultSettings),
    })

    expect(actions.some((action) => action.source === 'task')).toBe(false)
  })

  it('includes plan checklist tasks only for the active scenario', () => {
    const waterPlan = seedPlans.find((entry) => entry.id === 'water-contamination')!
    const powerPlan = seedPlans.find((entry) => entry.id === 'power-outage')!

    const inactiveActions = getDashboardActions({
      activePlan: waterPlan,
      items: seedInventory,
      planReadiness: getPlanReadiness(waterPlan, seedInventory, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(seedInventory, defaultSettings),
    })
    const activeActions = getDashboardActions({
      activeScenario: { planId: waterPlan.id, activatedAt: '2026-04-26T00:00:00.000Z' },
      activePlan: waterPlan,
      items: seedInventory,
      planReadiness: getPlanReadiness(waterPlan, seedInventory, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(seedInventory, defaultSettings),
    })
    const switchedActions = getDashboardActions({
      activeScenario: { planId: powerPlan.id, activatedAt: '2026-04-26T00:00:00.000Z' },
      activePlan: powerPlan,
      items: seedInventory,
      planReadiness: getPlanReadiness(powerPlan, seedInventory, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(seedInventory, defaultSettings),
    })

    expect(inactiveActions.some((action) => action.source === 'task')).toBe(false)
    expect(activeActions.some((action) => action.source === 'task' && action.planId === waterPlan.id)).toBe(true)
    expect(switchedActions.some((action) => action.source === 'task' && action.planId === powerPlan.id)).toBe(true)
    expect(switchedActions.some((action) => action.source === 'task' && action.planId === waterPlan.id)).toBe(false)
  })

  it('infers catalog targets for old plan requirements without catalog ids', () => {
    const plan = {
      ...seedPlans.find((entry) => entry.id === 'water-contamination')!,
      requirements: [
        {
          id: 'old-tabs',
          label: 'Purification tablets',
          itemName: 'Water purification tablets',
          category: 'water' as const,
          minQuantity: 3,
          unit: 'pack',
        },
      ],
    }
    const items = seedInventory.filter((item) => item.id !== 'water-tablets')
    const actions = getDashboardActions({
      activePlan: plan,
      items,
      planReadiness: getPlanReadiness(plan, items, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(items, defaultSettings),
    })

    expect(actions.find((action) => action.id === 'plan-water-contamination-old-tabs')).toMatchObject({
      relatedCatalogItemId: 'water-purification-tablets',
    })
  })

  it('promotes active scenario actions above unrelated resource noise', () => {
    const plan = seedPlans.find((entry) => entry.id === 'water-contamination')!
    const actions = getDashboardActions({
      activeScenario: { planId: plan.id, activatedAt: '2026-04-26T00:00:00.000Z' },
      activePlan: plan,
      items: seedInventory,
      planReadiness: getPlanReadiness(plan, seedInventory, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(seedInventory, defaultSettings),
    })

    expect(actions[0]).toMatchObject({
      fromActiveScenario: true,
      source: 'task',
      priority: 'critical',
    })
  })

  it('orders active scenario tasks as NOW before NEXT and LATER', () => {
    const plan = seedPlans.find((entry) => entry.id === 'water-contamination')!
    const actions = getDashboardActions({
      activeScenario: { planId: plan.id, activatedAt: '2026-04-26T00:00:00.000Z' },
      activePlan: plan,
      items: seedInventory,
      planReadiness: getPlanReadiness(plan, seedInventory, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(seedInventory, defaultSettings),
    })

    const nowIndex = actions.findIndex((action) => action.source === 'task' && action.reason.startsWith('NOW'))
    const nextIndex = actions.findIndex((action) => action.source === 'task' && action.reason.startsWith('NEXT'))
    const laterIndex = actions.findIndex((action) => action.source === 'task' && action.reason.startsWith('LATER'))

    expect(nowIndex).toBeGreaterThanOrEqual(0)
    expect(nextIndex).toBeGreaterThan(nowIndex)
    expect(laterIndex).toBeGreaterThan(nextIndex)
  })

  it('keeps unrelated critical resource deficits visible after active scenario actions', () => {
    const plan = seedPlans.find((entry) => entry.id === 'power-outage')!
    const actions = getDashboardActions({
      activeScenario: { planId: plan.id, activatedAt: '2026-04-26T00:00:00.000Z' },
      activePlan: plan,
      items: seedInventory,
      planReadiness: getPlanReadiness(plan, seedInventory, defaultSettings),
      settings: defaultSettings,
      summary: getResourceSummary(seedInventory, defaultSettings),
    })

    expect(actions.some((action) => action.id === 'resource-water')).toBe(true)
  })
})
