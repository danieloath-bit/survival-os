import { supplyCatalog } from '../data/supplyCatalog'
import type { InventoryCategory, InventoryItem, PlanRequirement, SupplyCatalogItem } from '../types'
import { getLitresPerUnit, isCountUnit } from './units'

export function normalizeSupplyName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(purifying|purifier)\b/g, 'purification')
    .replace(/\b(tabs)\b/g, 'tablets')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getCatalogItemById(id?: string) {
  if (!id) return undefined
  return supplyCatalog.find((item) => item.id === id)
}

export function findCatalogMatches(query: string) {
  const normalized = normalizeSupplyName(query)
  if (!normalized) return []
  return supplyCatalog
    .map((item) => ({ item, score: scoreCatalogItem(item, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.canonicalName.localeCompare(b.item.canonicalName))
    .slice(0, 8)
    .map((entry) => entry.item)
}

export function findBestCatalogMatch(input: string) {
  const normalized = normalizeSupplyName(input)
  if (!normalized) return undefined
  return supplyCatalog.find((item) => catalogNames(item).some((name) => normalizeSupplyName(name) === normalized))
}

export function itemMatchesCatalog(item: InventoryItem, catalogItem: SupplyCatalogItem) {
  if (item.catalogItemId) return item.catalogItemId === catalogItem.id
  const normalized = normalizeSupplyName(item.displayName ?? item.name)
  return catalogNames(catalogItem).some((name) => normalizeSupplyName(name) === normalized)
}

export function itemMatchesRequirement(item: InventoryItem, requirement: PlanRequirement) {
  const itemName = normalizeSupplyName(item.displayName ?? item.name)
  const requirementNames = [requirement.itemName, requirement.label]
    .filter((name): name is string => Boolean(name))
    .map(normalizeSupplyName)
  if (requirementNames.includes(itemName)) return true

  const requirementCatalog = getCatalogItemById(requirement.catalogItemId)
  if (requirementCatalog) return itemMatchesCatalog(item, requirementCatalog)

  const itemCatalog = getCatalogItemById(item.catalogItemId) ?? findBestCatalogMatch(item.displayName ?? item.name)
  if (itemCatalog && requirement.itemName) {
    const requiredName = normalizeSupplyName(requirement.itemName)
    return catalogNames(itemCatalog).some((name) => normalizeSupplyName(name) === requiredName)
  }

  if (isSpecificRequirement(requirement)) return false
  return Boolean(requirement.category && item.category === requirement.category)
}

export function itemValueType(item: InventoryItem) {
  return getCatalogItemById(item.catalogItemId)?.valueType ?? findBestCatalogMatch(item.displayName ?? item.name)?.valueType
}

export function getInventoryCategoryForCatalogItem(catalogItem?: SupplyCatalogItem): InventoryCategory | undefined {
  if (!catalogItem) return undefined
  switch (catalogItem.valueType) {
    case 'potable_water':
    case 'water_treatment':
    case 'water_filter':
      return 'water'
    case 'calories':
      return 'food'
    case 'fuel_litres':
    case 'fuel_canister':
      return 'fuel'
    case 'medical':
      return 'medical'
    case 'hygiene':
      return 'hygiene'
    case 'communications':
      return 'communications'
    case 'power':
      return 'energy'
    case 'shelter':
      return 'shelter'
    case 'tool':
    case 'document':
    case 'navigation':
      return 'tools'
    default:
      return catalogItem.category
  }
}

export function normalizeInventoryItem(item: InventoryItem) {
  const catalogItem = getCatalogItemById(item.catalogItemId)
  if (!catalogItem) return item
  return {
    ...item,
    category: getInventoryCategoryForCatalogItem(catalogItem) ?? catalogItem.category,
  }
}

export function isPotableWaterItem(item: InventoryItem) {
  const valueType = itemValueType(item)
  return (
    valueType === 'potable_water' &&
    (getLitresPerUnit(item) > 0 || item.unit.trim().toLowerCase() === 'l')
  )
}

export function isFuelLitresItem(item: InventoryItem) {
  const valueType = itemValueType(item)
  return (
    (valueType === 'fuel_litres' || valueType === 'fuel_canister' || valueType === undefined) &&
    item.category === 'fuel' &&
    getLitresPerUnit(item) > 0
  )
}

export function isWaterTreatmentItem(item: InventoryItem) {
  return itemValueType(item) === 'water_treatment'
}

export function isWaterFilterItem(item: InventoryItem) {
  return itemValueType(item) === 'water_filter'
}

export function canCountForRequirement(item: InventoryItem, requirement: PlanRequirement) {
  if (!requirement.unit) return true
  return item.unit === requirement.unit || (isCountUnit(item.unit) && isCountUnit(requirement.unit))
}

function scoreCatalogItem(item: SupplyCatalogItem, normalizedQuery: string) {
  const names = catalogNames(item).map(normalizeSupplyName)
  if (names.some((name) => name === normalizedQuery)) return 100
  if (names.some((name) => name.startsWith(normalizedQuery))) return 80
  if (names.some((name) => name.includes(normalizedQuery))) return 60
  if (item.tags.some((tag) => normalizeSupplyName(tag).includes(normalizedQuery))) return 30
  return 0
}

function catalogNames(item: SupplyCatalogItem) {
  return [item.canonicalName, ...item.aliases]
}

function isSpecificRequirement(requirement: PlanRequirement) {
  return Boolean(requirement.catalogItemId || requirement.itemName)
}
