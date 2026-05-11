import type {
  ActiveScenario,
  DashboardAction,
  EmergencyPlan,
  HouseholdSettings,
  InventoryItem,
  PlanReadiness,
  ResourceSummary,
} from '../types'
import { getDaysUntilExpiry } from './readiness'
import { findBestCatalogMatch } from './catalog'
import { getTaskExecutionPhase } from './plans'

export function getDashboardActions({
  activeScenario,
  activePlan,
  items,
  planReadiness,
  settings,
  summary,
}: {
  activeScenario?: ActiveScenario
  activePlan: EmergencyPlan
  items: InventoryItem[]
  planReadiness: PlanReadiness
  settings: HouseholdSettings
  summary: ResourceSummary
}): DashboardAction[] {
  const targetDays = settings.targetBufferDays ?? 7
  const waterTarget = settings.householdPeople * settings.waterLitresPerPersonPerDay * targetDays
  const fuelTarget = settings.fuelLitresPerDay * targetDays
  const actions: DashboardAction[] = []
  const waterDeficit = roundQuantity(waterTarget - summary.totalWaterLitres)
  const fuelDeficit = roundQuantity(fuelTarget - summary.totalFuelLitres)

  if (waterDeficit > 0) {
    actions.push({
      id: 'resource-water',
      title: `Add ${formatQuantity(waterDeficit)}L drinking water`,
      reason: `${formatQuantity(summary.totalWaterLitres)}L stored against ${formatQuantity(waterTarget)}L target`,
      priority:
        activeScenario && summary.waterStatus !== 'CRITICAL'
          ? 'medium'
          : summary.waterStatus === 'CRITICAL'
            ? 'critical'
            : 'high',
      source: 'resource',
      relatedCatalogItemId: 'drinking-water-potable',
      suggestedQuantity: waterDeficit,
      suggestedUnit: 'L',
    })
  }

  if (fuelDeficit > 0) {
    actions.push({
      id: 'resource-fuel',
      title: `Add ${formatQuantity(fuelDeficit)}L fuel`,
      reason: `${formatQuantity(summary.totalFuelLitres)}L stored against ${formatQuantity(fuelTarget)}L target`,
      priority:
        activeScenario && summary.fuelStatus !== 'CRITICAL'
          ? 'low'
          : summary.fuelStatus === 'CRITICAL'
            ? 'critical'
            : 'medium',
      source: 'resource',
      relatedCatalogItemId: 'fuel-jerry-can',
      suggestedQuantity: fuelDeficit,
      suggestedUnit: 'L',
    })
  }

  for (const gap of planReadiness.missing) {
    const catalogItemId =
      gap.requirement.catalogItemId ??
      findBestCatalogMatch(gap.requirement.itemName ?? gap.requirement.label)?.id
    actions.push({
      id: `plan-${activePlan.id}-${gap.requirement.id}`,
      title: `Add ${gap.requirement.label}`,
      reason: `Missing ${formatQuantity(gap.deficit)}${gap.requirement.unit ? ` ${gap.requirement.unit}` : ''} for ${activePlan.name}`,
      priority:
        activeScenario
          ? gap.requirement.category === 'medical'
            ? 'critical'
            : 'high'
          : gap.requirement.category === 'medical'
            ? 'critical'
            : 'high',
      source: 'plan',
      fromActiveScenario: Boolean(activeScenario),
      relatedCatalogItemId: catalogItemId,
      suggestedQuantity: roundQuantity(gap.deficit),
      suggestedUnit: gap.requirement.unit,
      planId: activePlan.id,
    })
  }

  const expiringCritical = items.filter((item) => {
    const days = getDaysUntilExpiry(item)
    return days !== undefined && days >= 0 && days <= 7
  })
  if (expiringCritical.length > 0) {
    actions.push({
      id: 'expiry-critical',
      title: 'Replace expiring critical supplies',
      reason: `${expiringCritical.length} item${expiringCritical.length === 1 ? '' : 's'} expire within 7 days`,
      priority: activeScenario ? 'medium' : 'high',
      source: 'expiry',
    })
  }

  if (activeScenario) {
    for (const task of activePlan.tasks.filter((task) => !task.completed)) {
    const executionPhase = getTaskExecutionPhase(task)
    actions.push({
      id: `task-${activePlan.id}-${task.id}`,
      title: `Complete ${activePlan.name} task: ${task.title}`,
      reason: `${executionPhase.toUpperCase()} checklist item`,
      priority:
        activeScenario && (executionPhase === 'now' || task.priority === 'critical' || task.priority === 'high')
          ? 'critical'
          : 'medium',
      source: 'task',
      fromActiveScenario: Boolean(activeScenario),
      taskPhase: executionPhase,
      planId: activePlan.id,
      taskId: task.id,
    })
    }
  }

  return uniqueActions(actions).sort((a, b) => actionRank(a, Boolean(activeScenario)) - actionRank(b, Boolean(activeScenario)))
}

function actionRank(action: DashboardAction, hasActiveScenario: boolean) {
  if (hasActiveScenario) {
    const isNowTask = action.fromActiveScenario && action.source === 'task' && action.taskPhase === 'now'
    const isNextTask = action.fromActiveScenario && action.source === 'task' && action.taskPhase === 'next'
    const isLaterTask = action.fromActiveScenario && action.source === 'task' && action.taskPhase === 'later'
    const isActivePlanSupply = action.fromActiveScenario && action.source === 'plan'
    const isUnrelatedCriticalResource = action.source === 'resource' && action.priority === 'critical' && !action.fromActiveScenario

    if (isNowTask) return 0
    if (isActivePlanSupply) return 10
    if (isNextTask) return 20
    if (isUnrelatedCriticalResource) return 30
    if (action.source === 'expiry') return 40
    if (isLaterTask) return 50
    if (action.priority === 'high') return 60
    return 70
  }
  const priorityRank = { critical: 0, high: 10, medium: 20, low: 30 }[action.priority]
  const sourceRank = { resource: 0, plan: 2, expiry: 4, task: 5 }[action.source]
  const waterBoost = action.relatedCatalogItemId === 'drinking-water-potable' ? -3 : 0
  const medicalBoost = action.reason.toLowerCase().includes('medical') ? -2 : 0
  return priorityRank + sourceRank + waterBoost + medicalBoost
}

function uniqueActions(actions: DashboardAction[]) {
  const seen = new Set<string>()
  return actions.filter((action) => {
    if (seen.has(action.id)) return false
    seen.add(action.id)
    return true
  })
}

function roundQuantity(value: number) {
  return Math.max(0, Number(value.toFixed(2)))
}

function formatQuantity(value: number) {
  return Number(value.toFixed(2)).toString()
}
