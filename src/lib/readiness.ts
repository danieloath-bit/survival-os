import type {
  DashboardAlert,
  HouseholdSettings,
  InventoryCategory,
  InventoryItem,
  ResourceStatus,
  ResourceSummary,
} from '../types'
import { isFuelLitresItem, isPotableWaterItem, itemValueType } from './catalog'
import { getLitresPerUnit } from './units'

export function getTotalFoodCalories(items: InventoryItem[]) {
  return items
    .filter((item) => item.category === 'food' || itemValueType(item) === 'calories')
    .reduce((total, item) => total + item.quantity * (item.caloriesPerUnit ?? 0), 0)
}

export function getTotalWaterLitres(items: InventoryItem[]) {
  return items
    .filter(isPotableWaterItem)
    .reduce((total, item) => total + item.quantity * getLitresPerUnit(item), 0)
}

export function getTotalFuelLitres(items: InventoryItem[]) {
  return items
    .filter(isFuelLitresItem)
    .reduce((total, item) => total + item.quantity * getLitresPerUnit(item), 0)
}

export function getFoodDays(items: InventoryItem[], settings: HouseholdSettings) {
  return divide(getTotalFoodCalories(items), settings.householdPeople * settings.caloriesPerPersonPerDay)
}

export function getWaterDays(items: InventoryItem[], settings: HouseholdSettings) {
  return divide(getTotalWaterLitres(items), settings.householdPeople * settings.waterLitresPerPersonPerDay)
}

export function getFuelDays(items: InventoryItem[], settings: HouseholdSettings) {
  return divide(getTotalFuelLitres(items), settings.fuelLitresPerDay)
}

export function getExpiringItems(items: InventoryItem[], days: number, now = new Date()) {
  return items.filter((item) => {
    const daysUntil = getDaysUntilExpiry(item, now)
    return daysUntil !== undefined && daysUntil >= 0 && daysUntil <= days
  })
}

export function getLowStockItems(items: InventoryItem[]) {
  return items.filter(
    (item) => getRowMinimum(item) !== undefined && item.quantity < getRowMinimum(item)!,
  )
}

export function getMedicalExpiryStatus(items: InventoryItem[], now = new Date()) {
  const medicalItems = items.filter((item) => item.category === 'medical')
  const expired = medicalItems.filter((item) => {
    const days = getDaysUntilExpiry(item, now)
    return days !== undefined && days < 0
  })
  const expiring7 = medicalItems.filter((item) => {
    const days = getDaysUntilExpiry(item, now)
    return days !== undefined && days >= 0 && days <= 7
  })
  const expiring30 = getExpiringItems(medicalItems, 30, now)

  if (expired.length > 0 || expiring7.length > 0) {
    return { status: 'CRITICAL' as ResourceStatus, expiredCount: expired.length, expiringCount: expiring30.length }
  }
  if (expiring30.length > 0) {
    return { status: 'WATCH' as ResourceStatus, expiredCount: 0, expiringCount: expiring30.length }
  }
  return { status: 'OK' as ResourceStatus, expiredCount: 0, expiringCount: 0 }
}

export function getResourceStatus(days: number, settings?: HouseholdSettings): ResourceStatus {
  const criticalBelow = settings?.criticalBelowDays ?? 3
  const lowBelow = settings?.lowBelowDays ?? 7
  const watchBelow = settings?.watchBelowDays ?? 14
  if (days > watchBelow) return 'OK'
  if (days >= lowBelow) return 'WATCH'
  if (days >= criticalBelow) return 'LOW'
  return 'CRITICAL'
}

export function getResourceSummary(
  items: InventoryItem[],
  settings: HouseholdSettings,
): ResourceSummary {
  const medical = getMedicalExpiryStatus(items)
  const waterDays = getWaterDays(items, settings)
  const foodDays = getFoodDays(items, settings)
  const fuelDays = getFuelDays(items, settings)

  return {
    waterDays,
    foodDays,
    fuelDays,
    totalWaterLitres: getTotalWaterLitres(items),
    totalFoodCalories: getTotalFoodCalories(items),
    totalFuelLitres: getTotalFuelLitres(items),
    waterStatus: getResourceStatus(waterDays, settings),
    foodStatus: getResourceStatus(foodDays, settings),
    fuelStatus: getResourceStatus(fuelDays, settings),
    medicalStatus: medical.status,
    medicalExpiringCount: medical.expiringCount,
    medicalExpiredCount: medical.expiredCount,
  }
}

export function getNextFailurePoint(summary: ResourceSummary) {
  return [
    { id: 'water', name: 'Water', days: summary.waterDays },
    { id: 'food', name: 'Food', days: summary.foodDays },
    { id: 'fuel', name: 'Fuel', days: summary.fuelDays },
  ].sort((a, b) => a.days - b.days)[0]
}

export function getDashboardAlerts(
  summary: ResourceSummary,
  items: InventoryItem[],
  settings: HouseholdSettings,
): DashboardAlert[] {
  void items
  const alerts: DashboardAlert[] = []
  const targetDays = settings.targetBufferDays ?? 7
  const waterTarget = settings.householdPeople * settings.waterLitresPerPersonPerDay * targetDays
  const fuelTarget = settings.fuelLitresPerDay * targetDays
  const foodTarget = settings.householdPeople * settings.caloriesPerPersonPerDay * targetDays

  if (summary.waterStatus === 'CRITICAL' || summary.waterStatus === 'LOW') {
    alerts.push({
      id: 'water-low',
      severity: summary.waterStatus === 'CRITICAL' ? 'critical' : 'low',
      category: 'water',
      title: summary.waterStatus === 'CRITICAL' ? 'Water critically low' : 'Water below buffer',
      action: `Increase by ${Math.ceil(Math.max(0, waterTarget - summary.totalWaterLitres))}L to reach ${targetDays} day minimum`,
      age: '2 min ago',
    })
  }

  if (summary.fuelStatus === 'CRITICAL' || summary.fuelStatus === 'LOW') {
    alerts.push({
      id: 'fuel-low',
      severity: 'low',
      category: 'fuel',
      title: 'Fuel below minimum threshold',
      action: `Add at least ${Math.ceil(Math.max(0, fuelTarget - summary.totalFuelLitres))}L`,
      age: '15 min ago',
    })
  }

  if (summary.medicalExpiringCount > 0) {
    alerts.push({
      id: 'medical-expiry',
      severity: summary.medicalStatus === 'CRITICAL' ? 'critical' : 'watch',
      category: 'medical',
      title: `${summary.medicalExpiringCount} medical items expiring soon`,
      action: 'Check inventory for details',
      age: '1 hr ago',
    })
  }

  if (summary.totalFoodCalories < foodTarget) {
    alerts.push({
      id: 'food-low',
      severity: summary.foodStatus === 'LOW' ? 'low' : 'watch',
      category: 'food',
      title: 'Food below 14 day target',
      action: `Add ${Math.ceil(foodTarget - summary.totalFoodCalories).toLocaleString()} kcal`,
      age: '3 hr ago',
    })
  }

  return alerts
}

export function getDepletionSeries(summary: ResourceSummary) {
  return [
    { id: 'water', name: 'Water', color: '#4bb6ff', days: summary.waterDays },
    { id: 'food', name: 'Food', color: '#45d978', days: summary.foodDays },
    { id: 'medical', name: 'Medical', color: '#f5b52e', days: summary.medicalExpiringCount > 0 ? 30 : 45 },
    { id: 'fuel', name: 'Fuel', color: '#ff594f', days: summary.fuelDays },
  ]
}

export function getItemStatus(item: InventoryItem, now = new Date()): ResourceStatus {
  const days = getDaysUntilExpiry(item, now)
  if (days !== undefined && days < 0) return 'CRITICAL'
  if (days !== undefined && days <= 30) return 'WATCH'
  const minimum = getRowMinimum(item)
  if (minimum !== undefined && item.quantity < minimum) return 'LOW'
  return 'OK'
}

export function getStoredValue(item: InventoryItem) {
  if (item.category === 'food') {
    const calories = Math.round(item.quantity * (item.caloriesPerUnit ?? 0))
    return item.caloriesPerUnit
      ? `${calories.toLocaleString()} kcal`
      : `${formatNumber(item.quantity)} ${item.unit} food, calories unknown`
  }
  if (item.category === 'water') {
    const litres = item.quantity * getLitresPerUnit(item)
    return litres > 0
      ? `${formatNumber(litres)} L usable water`
      : `${formatNumber(item.quantity)} ${item.unit} treatment supply`
  }
  if (item.category === 'fuel') {
    const litres = item.quantity * getLitresPerUnit(item)
    return litres > 0
      ? `${formatNumber(litres)} L fuel`
      : `${formatNumber(item.quantity)} ${item.unit} fuel supply`
  }
  return `${formatNumber(item.quantity)} ${item.unit}`
}

export function getDaysUntilExpiry(item: InventoryItem, now = new Date()) {
  if (!item.expiryDate) return undefined
  const today = new Date(now.toISOString().slice(0, 10))
  const expiry = new Date(`${item.expiryDate}T00:00:00`)
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000)
}

export function getCategoryReadiness(
  category: InventoryCategory,
  items: InventoryItem[],
  summary: ResourceSummary,
  settings?: HouseholdSettings,
) {
  const targetDays = settings?.targetBufferDays ?? 14
  if (category === 'water') return readinessFromDays(summary.waterDays, targetDays)
  if (category === 'food') return readinessFromDays(summary.foodDays, targetDays)
  if (category === 'fuel' || category === 'energy') return readinessFromDays(summary.fuelDays, targetDays)
  if (category === 'medical') {
    if (summary.medicalStatus === 'CRITICAL') return 35
    if (summary.medicalStatus === 'WATCH') return 60
    return 82
  }
  const relevant = items.filter((item) => item.category === category)
  if (relevant.length === 0) return 0
  const low = relevant.filter((item) => getItemStatus(item) !== 'OK').length
  return Math.max(25, Math.round(((relevant.length - low) / relevant.length) * 100))
}

export function statusFromPercent(value: number): ResourceStatus | 'GOOD' {
  if (value >= 70) return 'GOOD'
  if (value >= 50) return 'WATCH'
  if (value >= 30) return 'LOW'
  return 'CRITICAL'
}

export function formatDays(days: number) {
  if (!Number.isFinite(days)) return '0'
  return days < 10 ? days.toFixed(1).replace('.0', '') : Math.round(days).toString()
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function readinessFromDays(days: number, targetDays: number) {
  return Math.min(100, Math.round((days / Math.max(1, targetDays)) * 100))
}

function divide(total: number, dailyNeed: number) {
  return dailyNeed > 0 ? total / dailyNeed : 0
}

function getRowMinimum(item: InventoryItem) {
  return item.minThreshold ?? item.minQuantity
}
