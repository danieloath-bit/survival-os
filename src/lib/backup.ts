import { defaultAppSettings, seedInventory, seedPlans } from '../data/seed'
import type {
  ActiveScenario,
  AppSettings,
  BackupPayload,
  EmergencyPlan,
  IgnoredDuplicateGroup,
  IncidentLogEntry,
  InventoryItem,
  KnowledgeResource,
  MapLocation,
  MapPackMetadata,
  StoredDocument,
} from '../types'
import { normalizeInventoryItem } from './catalog'

type DocumentMetadata = Pick<StoredDocument, 'id' | 'name' | 'mimeType' | 'kind' | 'tag' | 'size' | 'createdAt'>

export function createBackupPayload({
  activeScenario,
  documentMetadata = [],
  ignoredDuplicateGroups,
  incidentLog,
  items,
  knowledgeResources = [],
  mapLocations,
  mapPackMetadata,
  plans,
  settings,
}: {
  activeScenario?: ActiveScenario
  documentMetadata?: DocumentMetadata[]
  ignoredDuplicateGroups: IgnoredDuplicateGroup[]
  incidentLog: IncidentLogEntry[]
  items: InventoryItem[]
  knowledgeResources?: KnowledgeResource[]
  mapLocations: MapLocation[]
  mapPackMetadata?: MapPackMetadata
  plans: EmergencyPlan[]
  settings: AppSettings
}): BackupPayload {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    items: items.map(normalizeInventoryItem),
    plans,
    mapLocations: mapLocations.filter(isMapLocation),
    mapPackMetadata: normalizeMapPackMetadata(mapPackMetadata),
    settings,
    activeScenario,
    incidentLog,
    ignoredDuplicateGroups,
    documentMetadata: documentMetadata.filter(isDocumentMetadata),
    knowledgeResources: knowledgeResources.filter(isKnowledgeResource),
  }
}

export function parseBackupPayload(input: unknown): BackupPayload {
  const source = isRecord(input) ? input : {}
  const settings = isRecord(source.settings)
    ? { ...defaultAppSettings, ...source.settings }
    : defaultAppSettings

  return {
    version: 2,
    exportedAt: typeof source.exportedAt === 'string' ? source.exportedAt : new Date().toISOString(),
    items: Array.isArray(source.items)
      ? (source.items as InventoryItem[]).map(normalizeInventoryItem)
      : seedInventory,
    plans: Array.isArray(source.plans) ? (source.plans as EmergencyPlan[]) : seedPlans,
    mapLocations: Array.isArray(source.mapLocations)
      ? (source.mapLocations as Partial<MapLocation>[]).filter(isMapLocation)
      : [],
    mapPackMetadata: normalizeMapPackMetadata(source.mapPackMetadata),
    settings: clampSettings(settings),
    activeScenario: isActiveScenario(source.activeScenario) ? source.activeScenario : undefined,
    incidentLog: Array.isArray(source.incidentLog)
      ? (source.incidentLog as Partial<IncidentLogEntry>[]).filter(isIncidentLogEntry)
      : [],
    ignoredDuplicateGroups: Array.isArray(source.ignoredDuplicateGroups)
      ? (source.ignoredDuplicateGroups as Partial<IgnoredDuplicateGroup>[]).filter(isIgnoredDuplicateGroup)
      : [],
    documentMetadata: Array.isArray(source.documentMetadata)
      ? (source.documentMetadata as Partial<DocumentMetadata>[]).filter(isDocumentMetadata)
      : [],
    knowledgeResources: Array.isArray(source.knowledgeResources)
      ? (source.knowledgeResources as Partial<KnowledgeResource>[]).filter(isKnowledgeResource)
      : [],
  }
}

export function clampSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    householdPeople: clampNumber(settings.householdPeople, 1, 50),
    childrenCount: clampNumber(settings.childrenCount ?? 0, 0, 30),
    petsCount: clampNumber(settings.petsCount ?? 0, 0, 50),
    caloriesPerPersonPerDay: clampNumber(settings.caloriesPerPersonPerDay, 800, 6000),
    waterLitresPerPersonPerDay: clampNumber(settings.waterLitresPerPersonPerDay, 1, 25),
    fuelLitresPerDay: clampNumber(settings.fuelLitresPerDay, 0.1, 100),
    targetBufferDays: clampNumber(settings.targetBufferDays, 1, 365),
    criticalBelowDays: clampNumber(settings.criticalBelowDays ?? 3, 0.5, 30),
    lowBelowDays: clampNumber(settings.lowBelowDays ?? 7, 1, 60),
    watchBelowDays: clampNumber(settings.watchBelowDays ?? 14, 1, 120),
    goodAboveDays: clampNumber(settings.goodAboveDays ?? 14, 1, 120),
  }
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : min
  return Math.min(max, Math.max(min, number))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function isActiveScenario(value: unknown): value is ActiveScenario {
  return isRecord(value) && typeof value.planId === 'string' && typeof value.activatedAt === 'string'
}

function isIncidentLogEntry(value: Partial<IncidentLogEntry>): value is IncidentLogEntry {
  return Boolean(
    value &&
      typeof value.id === 'string' &&
      typeof value.planId === 'string' &&
      typeof value.timestamp === 'string' &&
      typeof value.type === 'string' &&
      typeof value.message === 'string',
  )
}

function isIgnoredDuplicateGroup(value: Partial<IgnoredDuplicateGroup>): value is IgnoredDuplicateGroup {
  return Boolean(
    value &&
      typeof value.catalogItemId === 'string' &&
      typeof value.fingerprint === 'string' &&
      typeof value.ignoredAt === 'string',
  )
}

function isMapLocation(value: Partial<MapLocation>): value is MapLocation {
  return Boolean(
    value &&
      typeof value.id === 'string' &&
      typeof value.name === 'string' &&
      typeof value.type === 'string' &&
      typeof value.longitude === 'number' &&
      typeof value.latitude === 'number' &&
      typeof value.createdAt === 'string' &&
      typeof value.updatedAt === 'string',
  )
}

function normalizeMapPackMetadata(value: unknown): MapPackMetadata | undefined {
  if (!isRecord(value)) return undefined
  if (
    value.id !== 'active' ||
    typeof value.fileName !== 'string' ||
    typeof value.fileSize !== 'number' ||
    typeof value.selectedAt !== 'string'
  ) {
    return undefined
  }
  return {
    id: 'active',
    fileName: value.fileName,
    fileSize: value.fileSize,
    selectedAt: value.selectedAt,
    persistence: 'needs_reselect',
    tileType: value.tileType === 'vector' || value.tileType === 'raster' || value.tileType === 'unknown' ? value.tileType : undefined,
    sourceLayers: Array.isArray(value.sourceLayers)
      ? value.sourceLayers.filter((layer): layer is string => typeof layer === 'string')
      : undefined,
  }
}

function isDocumentMetadata(value: Partial<DocumentMetadata>): value is DocumentMetadata {
  return Boolean(
    value &&
      typeof value.id === 'string' &&
      typeof value.name === 'string' &&
      typeof value.mimeType === 'string' &&
      (value.kind === 'pdf' || value.kind === 'image' || value.kind === 'text') &&
      (value.tag === 'ID' || value.tag === 'medical' || value.tag === 'insurance' || value.tag === 'other') &&
      typeof value.size === 'number' &&
      typeof value.createdAt === 'string',
  )
}

function isKnowledgeResource(value: Partial<KnowledgeResource>): value is KnowledgeResource {
  return Boolean(
    value &&
      typeof value.id === 'string' &&
      typeof value.title === 'string' &&
      typeof value.category === 'string' &&
      (value.sourceType === 'note' || value.sourceType === 'link' || value.sourceType === 'document') &&
      typeof value.createdAt === 'string' &&
      typeof value.updatedAt === 'string',
  )
}
