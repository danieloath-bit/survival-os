import type { InventoryItem } from '../types'

export type UnitClass = 'volume' | 'count' | 'weight' | 'energy' | 'fuel' | 'unknown'

const volumeUnits = new Set(['l', 'litre', 'litres', 'liter', 'liters', 'ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'])
const countUnits = new Set([
  'unit',
  'count',
  'pack',
  'packs',
  'box',
  'pair',
  'roll',
  'rolls',
  'cell',
  'battery',
  'batteries',
  'bottle',
  'bottles',
  'tablet',
  'tablets',
  'dose',
  'doses',
  'can',
  'cans',
])
const weightUnits = new Set(['kg', 'g'])
const energyUnits = new Set(['kcal', 'cal'])
const fuelUnits = new Set(['l equivalent'])

export function normalizeUnit(unit: string) {
  return unit.trim().toLowerCase()
}

export function classifyUnit(unit: string): UnitClass {
  const normalized = normalizeUnit(unit)
  if (volumeUnits.has(normalized)) return 'volume'
  if (countUnits.has(normalized)) return 'count'
  if (weightUnits.has(normalized)) return 'weight'
  if (energyUnits.has(normalized)) return 'energy'
  if (fuelUnits.has(normalized)) return 'fuel'
  return 'unknown'
}

export function isVolumeUnit(unit: string) {
  return classifyUnit(unit) === 'volume'
}

export function isCountUnit(unit: string) {
  return classifyUnit(unit) === 'count'
}

export function getLitresPerUnit(item: InventoryItem) {
  if (item.litresPerUnit !== undefined) return item.litresPerUnit
  return isVolumeUnit(item.unit) ? 1 : 0
}
