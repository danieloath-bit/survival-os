import type {
  EmergencyPlan,
  HouseholdSettings,
  InventoryItem,
  PlanReadiness,
  PlanRequirement,
  PlanExecutionPhase,
  PlanTask,
  RequirementGap,
} from '../types'
import {
  canCountForRequirement,
  getCatalogItemById,
  isFuelLitresItem,
  isPotableWaterItem,
  isWaterFilterItem,
  isWaterTreatmentItem,
  itemMatchesRequirement,
} from './catalog'
import { getLitresPerUnit } from './units'

export const planPhases = ['Immediate', 'First Hour', 'First 24 Hours', 'Ongoing'] as const
export const executionPhases: PlanExecutionPhase[] = ['now', 'next', 'later']

export function getTaskPlanningPhase(task: PlanTask): (typeof planPhases)[number] {
  if (task.phase === 'Immediate' || task.phase === 'First Hour' || task.phase === 'First 24 Hours' || task.phase === 'Ongoing') {
    return task.phase
  }
  if (task.timing) return task.timing
  if (task.phase === 'now') return 'Immediate'
  if (task.phase === 'next') return 'First Hour'
  if (task.phase === 'later') return 'Ongoing'

  const executionPhase = getTaskExecutionPhase(task)
  if (executionPhase === 'now') return 'Immediate'
  if (executionPhase === 'next') return 'First Hour'
  return 'Ongoing'
}

export function getPlanReadiness(
  plan: EmergencyPlan,
  inventory: InventoryItem[],
  settings?: HouseholdSettings,
): PlanReadiness {
  const missing = getMissingRequirements(plan, inventory, settings)
  const metCount = missing.filter((gap) => gap.met).length
  const requirementCoverage =
    plan.requirements.length > 0 ? metCount / plan.requirements.length : 1
  const completedTasks = plan.tasks.filter((task) => task.completed).length
  const taskCompletion = plan.tasks.length > 0 ? completedTasks / plan.tasks.length : 1
  const preparednessReadiness = Math.round(requirementCoverage * 100)
  const responseProgress = Math.round(taskCompletion * 100)

  return {
    planId: plan.id,
    readiness: preparednessReadiness,
    preparednessReadiness,
    responseProgress,
    requirementCoverage: Math.round(requirementCoverage * 100),
    taskCompletion: responseProgress,
    missing: missing.filter((gap) => !gap.met),
  }
}

export function getMissingRequirements(
  plan: EmergencyPlan,
  inventory: InventoryItem[],
  settings?: HouseholdSettings,
): RequirementGap[] {
  return plan.requirements.map((requirement) => {
    const currentAmount = getRequirementAmount(requirement, inventory)
    const requiredAmount = resolveRequirementMinimum(requirement, settings)
    return {
      requirement,
      currentAmount,
      requiredAmount,
      deficit: Math.max(0, requiredAmount - currentAmount),
      met: currentAmount >= requiredAmount,
    }
  })
}

export function getRecommendedPlan(
  plans: EmergencyPlan[],
  inventory: InventoryItem[],
  settings?: HouseholdSettings,
) {
  const highPriority = plans.filter(
    (plan) => plan.priority === 'critical' || plan.priority === 'high',
  )
  const candidates = highPriority.length > 0 ? highPriority : plans
  return [...candidates].sort(
    (a, b) =>
      getPlanReadiness(a, inventory, settings).readiness -
      getPlanReadiness(b, inventory, settings).readiness,
  )[0]
}

export function resetPlanTasks(plan: EmergencyPlan): EmergencyPlan {
  return {
    ...plan,
    tasks: plan.tasks.map((task) => ({ ...task, completed: false })),
  }
}

export function getPriorityStatus(priority: EmergencyPlan['priority']) {
  if (priority === 'critical') return 'CRITICAL'
  if (priority === 'high') return 'LOW'
  if (priority === 'medium') return 'WATCH'
  return 'OK'
}

export function getTaskExecutionPhase(task: PlanTask): PlanExecutionPhase {
  if (task.phase === 'now' || task.phase === 'next' || task.phase === 'later') return task.phase
  if (task.phase === 'Immediate') return 'now'
  if (task.phase === 'First Hour' || task.phase === 'First 24 Hours') return 'next'
  if (task.phase === 'Ongoing') return 'later'
  if (task.timing === 'Immediate') return 'now'
  if (task.timing === 'First Hour' || task.timing === 'First 24 Hours') return 'next'
  if (task.timing === 'Ongoing') return 'later'

  const content = `${task.title} ${task.description ?? ''}`.toLowerCase()
  if (/(stop|switch|protect|confirm|check scene safety|assess|call emergency)/.test(content)) return 'now'
  if (/(set|setup|begin|treat|check|allocate|charge|prepare)/.test(content)) return 'next'
  return 'later'
}

function getRequirementAmount(requirement: PlanRequirement, inventory: InventoryItem[]) {
  const requirementCatalog = getCatalogItemById(requirement.catalogItemId)
  const matches = inventory.filter((item) => itemMatchesRequirement(item, requirement))

  return matches.reduce((total, item) => {
    if (requirement.unit === 'L' && (item.category === 'water' || item.category === 'fuel')) {
      if (requirementCatalog?.valueType === 'potable_water' && !isPotableWaterItem(item)) return total
      if (requirementCatalog?.valueType === 'fuel_litres' && !isFuelLitresItem(item)) return total
      return total + item.quantity * getLitresPerUnit(item)
    }

    if (requirement.unit === 'kcal' && item.category === 'food') {
      return total + item.quantity * (item.caloriesPerUnit ?? 0)
    }

    if (requirementCatalog?.valueType === 'water_treatment' && !isWaterTreatmentItem(item)) return total
    if (requirementCatalog?.valueType === 'water_filter' && !isWaterFilterItem(item)) return total
    if (!canCountForRequirement(item, requirement)) return total
    return total + item.quantity
  }, 0)
}

function resolveRequirementMinimum(
  requirement: PlanRequirement,
  settings?: HouseholdSettings,
) {
  const seededMinimum = requirement.minQuantity ?? 1
  if (!settings) return seededMinimum
  const targetDays = settings.targetBufferDays ?? 7

  if (requirement.category === 'water' && requirement.unit === 'L') {
    return Math.max(
      seededMinimum,
      settings.householdPeople * settings.waterLitresPerPersonPerDay * targetDays,
    )
  }

  if (requirement.category === 'food' && requirement.unit === 'kcal') {
    return Math.max(
      seededMinimum,
      settings.householdPeople * settings.caloriesPerPersonPerDay * targetDays,
    )
  }

  if (requirement.category === 'fuel' && requirement.unit === 'L') {
    return Math.max(seededMinimum, settings.fuelLitresPerDay * targetDays)
  }

  return seededMinimum
}
