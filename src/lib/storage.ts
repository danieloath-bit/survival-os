import { defaultAppSettings, seedInventory, seedPlans } from '../data/seed'
import { db } from './db'
import type {
  ActiveScenario,
  AppSettings,
  EmergencyPlan,
  IgnoredDuplicateGroup,
  IncidentLogEntry,
  InventoryItem,
  KnowledgeResource,
  MapLocation,
  MapPackMetadata,
  StoredDocument,
  UserInventoryAlias,
} from '../types'
import { normalizeInventoryItem, normalizeSupplyName } from './catalog'

const INVENTORY_KEY = 'survival-os.inventory'
const SETTINGS_KEY = 'survival-os.settings'
const PLANS_KEY = 'survival-os.plans'
const ALIASES_KEY = 'survival-os.inventory-aliases'
const ACTIVE_SCENARIO_KEY = 'survival-os.active-scenario'
const INCIDENT_LOG_KEY = 'survival-os.incident-log'
const IGNORED_DUPLICATES_KEY = 'survival-os.ignored-duplicates'
const DOCUMENTS_KEY = 'survival-os.documents'
const MAP_LOCATIONS_KEY = 'survival-os.map-locations'
const MAP_PACK_METADATA_KEY = 'survival-os.map-pack-metadata'
const KNOWLEDGE_KEY = 'survival-os.knowledge-resources'

export function loadInventory(): InventoryItem[] {
  const raw = localStorage.getItem(INVENTORY_KEY)
  if (!raw) {
    saveInventory(seedInventory)
    return seedInventory
  }

  try {
    const parsed = JSON.parse(raw) as InventoryItem[]
    if (!Array.isArray(parsed)) {
      saveInventory(seedInventory)
      return seedInventory
    }
    const normalized = parsed.map(normalizeInventoryItem)
    if (JSON.stringify(normalized) !== raw) {
      saveInventory(normalized)
    }
    return normalized
  } catch {
    saveInventory(seedInventory)
    return seedInventory
  }
}

export function saveInventory(items: InventoryItem[]) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(items.map(normalizeInventoryItem)))
}

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) {
    saveSettings(defaultAppSettings)
    return defaultAppSettings
  }

  try {
    return { ...defaultAppSettings, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    saveSettings(defaultAppSettings)
    return defaultAppSettings
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function resetToSeedData() {
  saveInventory(seedInventory)
  saveSettings(defaultAppSettings)
  saveActiveScenario(undefined)
  saveIncidentLog([])
  saveIgnoredDuplicateGroups([])
  return { items: seedInventory, settings: defaultAppSettings }
}

export function loadPlans(): EmergencyPlan[] {
  const raw = localStorage.getItem(PLANS_KEY)
  if (!raw) {
    savePlans(seedPlans)
    return seedPlans
  }

  try {
    const parsed = JSON.parse(raw) as Partial<EmergencyPlan>[]
    if (!Array.isArray(parsed)) {
      savePlans(seedPlans)
      return seedPlans
    }
    return mergeSeedPlanDefinitions(parsed)
  } catch {
    savePlans(seedPlans)
    return seedPlans
  }
}

export function savePlans(plans: EmergencyPlan[]) {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans))
}

export function resetPlansToSeed() {
  savePlans(seedPlans)
  return seedPlans
}

export function loadUserAliases(): UserInventoryAlias[] {
  const raw = localStorage.getItem(ALIASES_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as UserInventoryAlias[]
  } catch {
    return []
  }
}

export function saveUserAliases(aliases: UserInventoryAlias[]) {
  localStorage.setItem(ALIASES_KEY, JSON.stringify(aliases.slice(0, 300)))
}

export function loadActiveScenario(): ActiveScenario | undefined {
  const raw = localStorage.getItem(ACTIVE_SCENARIO_KEY)
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as ActiveScenario
  } catch {
    return undefined
  }
}

export function saveActiveScenario(activeScenario?: ActiveScenario) {
  if (!activeScenario) {
    localStorage.removeItem(ACTIVE_SCENARIO_KEY)
    return
  }
  localStorage.setItem(ACTIVE_SCENARIO_KEY, JSON.stringify(activeScenario))
}

export function loadIncidentLog(): IncidentLogEntry[] {
  const raw = localStorage.getItem(INCIDENT_LOG_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<IncidentLogEntry>[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (entry): entry is IncidentLogEntry =>
          Boolean(
            entry &&
              typeof entry.id === 'string' &&
              typeof entry.planId === 'string' &&
              typeof entry.timestamp === 'string' &&
              typeof entry.type === 'string' &&
              typeof entry.message === 'string',
          ),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  } catch {
    return []
  }
}

export function saveIncidentLog(entries: IncidentLogEntry[]) {
  localStorage.setItem(INCIDENT_LOG_KEY, JSON.stringify(entries.slice(0, 500)))
}

export function loadIgnoredDuplicateGroups(): IgnoredDuplicateGroup[] {
  const raw = localStorage.getItem(IGNORED_DUPLICATES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<IgnoredDuplicateGroup>[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is IgnoredDuplicateGroup =>
        Boolean(
          entry &&
            typeof entry.catalogItemId === 'string' &&
            typeof entry.fingerprint === 'string' &&
            typeof entry.ignoredAt === 'string',
        ),
    )
  } catch {
    return []
  }
}

export function saveIgnoredDuplicateGroups(groups: IgnoredDuplicateGroup[]) {
  localStorage.setItem(IGNORED_DUPLICATES_KEY, JSON.stringify(groups.slice(0, 300)))
}

export function loadMapLocations(): MapLocation[] {
  const raw = localStorage.getItem(MAP_LOCATIONS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<MapLocation>[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isMapLocation)
  } catch {
    return []
  }
}

export function saveMapLocations(locations: MapLocation[]) {
  localStorage.setItem(MAP_LOCATIONS_KEY, JSON.stringify(locations.slice(0, 500)))
}

export function loadMapPackMetadata(): MapPackMetadata | undefined {
  const raw = localStorage.getItem(MAP_PACK_METADATA_KEY)
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Partial<MapPackMetadata>
    if (!isMapPackMetadata(parsed)) return undefined
    return parsed
  } catch {
    return undefined
  }
}

export function saveMapPackMetadata(metadata: MapPackMetadata | undefined) {
  if (!metadata) {
    localStorage.removeItem(MAP_PACK_METADATA_KEY)
    return
  }
  localStorage.setItem(MAP_PACK_METADATA_KEY, JSON.stringify(metadata))
}

export function loadKnowledgeResources(): KnowledgeResource[] {
  const raw = localStorage.getItem(KNOWLEDGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<KnowledgeResource>[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isKnowledgeResource)
  } catch {
    return []
  }
}

export function saveKnowledgeResources(resources: KnowledgeResource[]) {
  localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(resources.filter(isKnowledgeResource).slice(0, 500)))
}

export async function loadMapPackHandle(): Promise<FileSystemFileHandle | undefined> {
  try {
    return (await db.mapPackHandles.get('active'))?.handle
  } catch {
    return undefined
  }
}

export async function saveMapPackHandle(handle: FileSystemFileHandle | undefined) {
  try {
    if (!handle) {
      await db.mapPackHandles.delete('active')
      return
    }
    await db.mapPackHandles.put({ id: 'active', handle })
  } catch {
    // Some browsers/private sessions cannot persist file handles.
  }
}

export async function loadDocuments(): Promise<StoredDocument[]> {
  const raw = localStorage.getItem(DOCUMENTS_KEY)
  const legacy = parseStoredDocuments(raw)
  if (legacy.length > 0 && (await db.documents.count()) === 0) {
    await db.documents.bulkPut(legacy)
    localStorage.removeItem(DOCUMENTS_KEY)
  }

  return db.documents.orderBy('createdAt').reverse().toArray()
}

export async function saveDocuments(documents: StoredDocument[]) {
  await db.transaction('rw', db.documents, async () => {
    await db.documents.clear()
    if (documents.length > 0) await db.documents.bulkPut(documents)
  })
}

function parseStoredDocuments(raw: string | null): StoredDocument[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDocument>[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isStoredDocument)
  } catch {
    return []
  }
}

function isStoredDocument(value: Partial<StoredDocument>): value is StoredDocument {
  return Boolean(
    value &&
      typeof value.id === 'string' &&
      typeof value.name === 'string' &&
      typeof value.mimeType === 'string' &&
      (value.kind === 'pdf' || value.kind === 'image' || value.kind === 'text') &&
      (value.tag === 'ID' || value.tag === 'medical' || value.tag === 'insurance' || value.tag === 'other') &&
      typeof value.dataUrl === 'string' &&
      typeof value.size === 'number' &&
      typeof value.createdAt === 'string',
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
      Number.isFinite(value.longitude) &&
      Number.isFinite(value.latitude) &&
      typeof value.createdAt === 'string' &&
      typeof value.updatedAt === 'string',
  )
}

function isMapPackMetadata(value: Partial<MapPackMetadata>): value is MapPackMetadata {
  return Boolean(
    value &&
      value.id === 'active' &&
      typeof value.fileName === 'string' &&
      typeof value.fileSize === 'number' &&
      typeof value.selectedAt === 'string' &&
      (value.persistence === 'remembered' ||
        value.persistence === 'session_only' ||
        value.persistence === 'needs_reselect'),
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

export function addOrUpdateUserAlias(
  aliases: UserInventoryAlias[],
  entry: {
    text: string
    catalogItemId?: string
    category?: InventoryItem['category']
    unit?: string
  },
) {
  const normalizedText = normalizeSupplyName(entry.text)
  if (!normalizedText) return aliases
  const now = new Date().toISOString()
  const existing = aliases.find((alias) => alias.normalizedText === normalizedText)
  const next = existing
    ? aliases.map((alias) =>
        alias.normalizedText === normalizedText
          ? {
              ...alias,
              catalogItemId: entry.catalogItemId ?? alias.catalogItemId,
              category: entry.category ?? alias.category,
              unit: entry.unit ?? alias.unit,
              lastUsedAt: now,
              usageCount: alias.usageCount + 1,
            }
          : alias,
      )
    : [
        {
          id: `alias-${crypto.randomUUID()}`,
          text: entry.text,
          normalizedText,
          catalogItemId: entry.catalogItemId,
          category: entry.category,
          unit: entry.unit,
          lastUsedAt: now,
          usageCount: 1,
        },
        ...aliases,
      ]
  return next.sort((a, b) => b.usageCount - a.usageCount || b.lastUsedAt.localeCompare(a.lastUsedAt)).slice(0, 300)
}

function mergeSeedPlanDefinitions(savedPlans: Partial<EmergencyPlan>[]) {
  return seedPlans.map((seedPlan) => {
    const savedPlan = savedPlans.find((plan) => plan.id === seedPlan.id)
    if (!savedPlan) return seedPlan
    const savedTasks = Array.isArray(savedPlan.tasks) ? savedPlan.tasks : []
    return {
      ...seedPlan,
      tasks: seedPlan.tasks.map((seedTask) => {
        const savedTask = savedTasks.find((task) => task.id === seedTask.id)
        return savedTask
          ? {
              ...seedTask,
              completed: savedTask.completed,
              linkedMapLocationIds: Array.isArray(savedTask.linkedMapLocationIds)
                ? savedTask.linkedMapLocationIds.filter((id): id is string => typeof id === 'string')
                : seedTask.linkedMapLocationIds,
            }
          : seedTask
      }),
      linkedMapLocationIds: Array.isArray(savedPlan.linkedMapLocationIds)
        ? savedPlan.linkedMapLocationIds.filter((id): id is string => typeof id === 'string')
        : seedPlan.linkedMapLocationIds,
    }
  })
}
