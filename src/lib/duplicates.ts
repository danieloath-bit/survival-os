import { getCatalogItemById } from './catalog'
import { classifyUnit, normalizeUnit } from './units'
import type { IgnoredDuplicateGroup, InventoryItem } from '../types'

export type DuplicateCandidate = {
  catalogItemId: string
  itemIds: string[]
  itemCount: number
  fingerprint: string
  mergeable: boolean
  reviewReason?: string
}

export function getDuplicateCandidates(
  items: InventoryItem[],
  ignoredGroups: IgnoredDuplicateGroup[] = [],
): DuplicateCandidate[] {
  const groups = new Map<string, InventoryItem[]>()
  for (const item of items) {
    if (!item.catalogItemId) continue
    const existing = groups.get(item.catalogItemId) ?? []
    existing.push(item)
    groups.set(item.catalogItemId, existing)
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([catalogItemId, group]) => {
      const compatibility = getCompatibility(group)
      return {
        catalogItemId,
        itemIds: group.map((item) => item.id),
        itemCount: group.length,
        fingerprint: getDuplicateGroupFingerprint(group),
        mergeable: compatibility.mergeable,
        reviewReason: compatibility.reason,
      }
    })
    .filter((candidate) => !isIgnoredDuplicateCandidate(candidate, ignoredGroups))
}

export function mergeDuplicateGroup(items: InventoryItem[], catalogItemId: string) {
  const duplicates = items.filter((item) => item.catalogItemId === catalogItemId)
  if (duplicates.length < 2) {
    return { items, merged: false, reason: 'No duplicates found.' }
  }

  const compatibility = getCompatibility(duplicates)
  if (!compatibility.mergeable) {
    return { items, merged: false, reason: compatibility.reason ?? 'Review required.' }
  }

  const [base, ...rest] = duplicates
  const strategy = getMergeStrategy(duplicates)
  const quantity =
    strategy === 'volume_to_litres'
      ? duplicates.reduce((sum, item) => sum + item.quantity * getLitresFactor(item), 0)
      : duplicates.reduce((sum, item) => sum + item.quantity, 0)
  const mergedNotes = combineNotes(duplicates)
  const mergedLocation = combineLocation(duplicates)
  const mergedExpiry = earliestDate(duplicates.map((item) => item.expiryDate).filter(Boolean) as string[])
  const unit = strategy === 'volume_to_litres' ? 'L' : base.unit
  const catalog = getCatalogItemById(catalogItemId)
  const merged: InventoryItem = {
    ...base,
    name: catalog?.canonicalName ?? base.name,
    displayName: base.displayName ?? base.name,
    quantity: Number(quantity.toFixed(2)),
    unit,
    litresPerUnit: strategy === 'volume_to_litres' ? 1 : base.litresPerUnit,
    location: mergedLocation,
    expiryDate: mergedExpiry,
    notes: mergedNotes || undefined,
    minThreshold: Math.max(...duplicates.map((item) => item.minThreshold ?? 0)) || undefined,
    updatedAt: new Date().toISOString(),
  }

  const restIds = new Set(rest.map((item) => item.id))
  const next = items
    .filter((item) => !restIds.has(item.id))
    .map((item) => (item.id === base.id ? merged : item))

  return { items: next, merged: true }
}

function getCompatibility(group: InventoryItem[]) {
  const strategy = getMergeStrategy(group)
  if (strategy === 'blocked') {
    return { mergeable: false, reason: 'Review required: unit mismatch.' }
  }

  const caloriesSet = new Set(group.map((item) => item.caloriesPerUnit ?? null))
  if (caloriesSet.size > 1) {
    return { mergeable: false, reason: 'Review required: calories per unit mismatch.' }
  }

  const litresSet = new Set(group.map((item) => item.litresPerUnit ?? null))
  if (strategy !== 'volume_to_litres' && litresSet.size > 1) {
    return { mergeable: false, reason: 'Review required: litres per unit mismatch.' }
  }

  return { mergeable: true as const }
}

export function ignoreDuplicateCandidate(
  ignoredGroups: IgnoredDuplicateGroup[],
  candidate: DuplicateCandidate,
): IgnoredDuplicateGroup[] {
  const next: IgnoredDuplicateGroup = {
    catalogItemId: candidate.catalogItemId,
    fingerprint: candidate.fingerprint,
    ignoredAt: new Date().toISOString(),
  }
  return [
    next,
    ...ignoredGroups.filter(
      (group) =>
        group.catalogItemId !== candidate.catalogItemId ||
        group.fingerprint !== candidate.fingerprint,
    ),
  ].slice(0, 300)
}

function isIgnoredDuplicateCandidate(
  candidate: DuplicateCandidate,
  ignoredGroups: IgnoredDuplicateGroup[],
) {
  return ignoredGroups.some(
    (group) =>
      group.catalogItemId === candidate.catalogItemId &&
      group.fingerprint === candidate.fingerprint,
  )
}

function getDuplicateGroupFingerprint(group: InventoryItem[]) {
  return group
    .map((item) =>
      [
        item.id,
        item.catalogItemId ?? '',
        normalizeUnit(item.unit),
        item.quantity,
        item.litresPerUnit ?? '',
        item.caloriesPerUnit ?? '',
      ].join(':'),
    )
    .sort()
    .join('|')
}

function canonicalMergeUnit(unit: string) {
  const normalized = normalizeUnit(unit)
  const kind = classifyUnit(normalized)
  if (kind === 'volume' && isLitreUnit(normalized)) return 'volume:l'
  if (kind === 'volume' && isMillilitreUnit(normalized)) return 'volume:ml'
  if (kind === 'count' && normalized.endsWith('s')) return normalized.slice(0, -1)
  return normalized
}

function getMergeStrategy(group: InventoryItem[]) {
  const normalizedUnits = new Set(group.map((item) => canonicalMergeUnit(item.unit)))
  if (normalizedUnits.size === 1) return 'direct' as const
  const canConvertAll = group.every((item) => canConvertToLitres(item))
  if (canConvertAll) return 'volume_to_litres' as const
  return 'blocked' as const
}

function canConvertToLitres(item: InventoryItem) {
  const normalized = normalizeUnit(item.unit)
  if (isLitreUnit(normalized) || isMillilitreUnit(normalized)) return true
  return item.litresPerUnit !== undefined
}

function getLitresFactor(item: InventoryItem) {
  const normalized = normalizeUnit(item.unit)
  if (isLitreUnit(normalized)) return 1
  if (isMillilitreUnit(normalized)) return 0.001
  return item.litresPerUnit ?? 0
}

function isLitreUnit(unit: string) {
  return unit === 'l' || unit === 'litre' || unit === 'litres' || unit === 'liter' || unit === 'liters'
}

function isMillilitreUnit(unit: string) {
  return unit === 'ml' || unit === 'millilitre' || unit === 'millilitres' || unit === 'milliliter' || unit === 'milliliters'
}

function combineNotes(items: InventoryItem[]) {
  const notes = items.map((item) => item.notes?.trim()).filter((note): note is string => Boolean(note))
  return [...new Set(notes)].join('\n')
}

function combineLocation(items: InventoryItem[]) {
  const locations = [...new Set(items.map((item) => item.location?.trim()).filter(Boolean))]
  if (locations.length === 0) return undefined
  if (locations.length === 1) return locations[0]
  return 'Multiple'
}

function earliestDate(dates: string[]) {
  if (dates.length === 0) return undefined
  return [...dates].sort((a, b) => a.localeCompare(b))[0]
}
