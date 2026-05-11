import type {
  AppSettings,
  DateLabelType,
  InventoryItem,
  Location,
  Region,
  SafetyStatus,
} from '../types'

export const defaultSettings: AppSettings = {
  region: 'AU_NSW',
  householdPeople: 2,
  caloriesPerPersonPerDay: 2100,
  waterLitresPerPersonPerDay: 4,
  fuelLitresPerDay: 3.6,
  targetBufferDays: 7,
  criticalBelowDays: 3,
  lowBelowDays: 7,
  watchBelowDays: 14,
  goodAboveDays: 14,
}

export const defaultLocations: Location[] = [
  { id: 'pantry', name: 'Pantry' },
  { id: 'fridge', name: 'Fridge' },
  { id: 'freezer', name: 'Freezer' },
  { id: 'garage', name: 'Garage' },
]

export const dateLabelNames: Record<DateLabelType, string> = {
  use_by: 'Use-by',
  best_before: 'Best-before',
  sell_by: 'Sell-by',
  packed_on: 'Packed-on',
  opened_on: 'Opened-on',
  unknown: 'Unknown',
}

export const statusLabels: Record<SafetyStatus, string> = {
  ok: 'OK',
  use_soon: 'Use soon',
  past_quality: 'Past quality date',
  do_not_use: 'Do not use',
  check_manually: 'Check manually',
  unknown: 'Unknown',
}

export function todayIso(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function daysBetween(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T00:00:00`)
  const to = new Date(`${toIso}T00:00:00`)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

export function getDaysUntil(item: InventoryItem, nowIso = todayIso()) {
  if (!item.dateValue) return undefined
  return daysBetween(nowIso, item.dateValue)
}

export function getSafetyStatus(
  item: InventoryItem,
  region: Region,
  nowIso = todayIso(),
): SafetyStatus {
  if (!item.dateValue && !item.openedDate) return 'unknown'

  const daysUntil = getDaysUntil(item, nowIso)

  if (item.dateLabelType === 'unknown') {
    return 'check_manually'
  }

  if (item.dateLabelType === 'opened_on' || !item.dateValue) {
    return 'check_manually'
  }

  if (daysUntil === undefined) return 'unknown'

  if (region === 'AU_NSW' && item.dateLabelType === 'use_by') {
    if (daysUntil < 0) return 'do_not_use'
    if (daysUntil <= 7) return 'use_soon'
    return 'ok'
  }

  if (region === 'US' && item.name.toLowerCase().includes('infant formula')) {
    if (daysUntil < 0) return 'do_not_use'
    if (daysUntil <= 7) return 'use_soon'
    return 'ok'
  }

  if (item.dateLabelType === 'best_before' || item.dateLabelType === 'sell_by') {
    if (daysUntil < 0) return 'past_quality'
    if (daysUntil <= 30) return 'use_soon'
    return 'ok'
  }

  if (item.dateLabelType === 'packed_on') return 'check_manually'

  if (daysUntil < 0) return region === 'US' ? 'past_quality' : 'check_manually'
  if (daysUntil <= 14) return 'use_soon'
  return 'ok'
}

export function calculateFoodDays(items: InventoryItem[], settings: AppSettings) {
  const calories = items.reduce(
    (total, item) => total + item.quantity * (item.caloriesPerUnit ?? 0),
    0,
  )
  const dailyNeed = settings.householdPeople * settings.caloriesPerPersonPerDay
  return dailyNeed > 0 ? calories / dailyNeed : 0
}

export function calculateWaterDays(items: InventoryItem[], settings: AppSettings) {
  const litres = items.reduce(
    (total, item) => total + item.quantity * (item.potableLitresPerUnit ?? 0),
    0,
  )
  const dailyNeed = settings.householdPeople * settings.waterLitresPerPersonPerDay
  return dailyNeed > 0 ? litres / dailyNeed : 0
}

export function getLowStockItems(items: InventoryItem[]) {
  return items.filter(
    (item) => item.minQuantity !== undefined && item.quantity <= item.minQuantity,
  )
}

export function getExpiringWithin(
  items: InventoryItem[],
  days: number,
  nowIso = todayIso(),
) {
  return items.filter((item) => {
    const daysUntil = getDaysUntil(item, nowIso)
    return daysUntil !== undefined && daysUntil >= 0 && daysUntil <= days
  })
}

export function getRotationItems(
  items: InventoryItem[],
  settings: AppSettings,
  nowIso = todayIso(),
) {
  const priority: Record<SafetyStatus, number> = {
    do_not_use: 0,
    use_soon: 1,
    past_quality: 2,
    check_manually: 3,
    unknown: 4,
    ok: 5,
  }

  return [...items].sort((a, b) => {
    const aStatus = getSafetyStatus(a, settings.region, nowIso)
    const bStatus = getSafetyStatus(b, settings.region, nowIso)
    const byStatus = priority[aStatus] - priority[bStatus]
    if (byStatus !== 0) return byStatus

    const aDays = getDaysUntil(a, nowIso) ?? Number.POSITIVE_INFINITY
    const bDays = getDaysUntil(b, nowIso) ?? Number.POSITIVE_INFINITY
    if (aDays !== bDays) return aDays - bDays

    return (a.openedDate ?? '9999-12-31').localeCompare(
      b.openedDate ?? '9999-12-31',
    )
  })
}

export function getLocationName(locations: Location[], locationId: string) {
  return locations.find((location) => location.id === locationId)?.name ?? locationId
}

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}
