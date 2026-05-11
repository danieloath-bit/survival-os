export type Region = 'AU_NSW' | 'US'

export type DateLabelType =
  | 'use_by'
  | 'best_before'
  | 'sell_by'
  | 'packed_on'
  | 'opened_on'
  | 'unknown'

export type SafetyStatus =
  | 'ok'
  | 'use_soon'
  | 'past_quality'
  | 'do_not_use'
  | 'check_manually'
  | 'unknown'

export type InventoryCategory =
  | 'water'
  | 'food'
  | 'medical'
  | 'fuel'
  | 'energy'
  | 'shelter'
  | 'communications'
  | 'hygiene'
  | 'tools'
  | 'other'

export type InventoryItem = {
  id: string
  name: string
  displayName?: string
  catalogItemId?: string
  category: InventoryCategory
  quantity: number
  unit: string
  caloriesPerUnit?: number
  litresPerUnit?: number
  expiryDate?: string
  location?: string
  minThreshold?: number
  notes?: string
  locationId?: string
  dateLabelType?: DateLabelType
  dateValue?: string
  openedDate?: string
  potableLitresPerUnit?: number
  minQuantity?: number
  createdAt?: string
  updatedAt?: string
}

export type Location = {
  id: string
  name: string
  parentId?: string
}

export type HouseholdSettings = {
  householdPeople: number
  childrenCount?: number
  petsCount?: number
  caloriesPerPersonPerDay: number
  waterLitresPerPersonPerDay: number
  fuelLitresPerDay: number
  targetBufferDays: number
  criticalBelowDays?: number
  lowBelowDays?: number
  watchBelowDays?: number
  goodAboveDays?: number
}

export type AppSettings = HouseholdSettings & {
  region: Region
}

export type ResourceStatus = 'OK' | 'WATCH' | 'LOW' | 'CRITICAL'

export type DashboardAlert = {
  id: string
  severity: 'critical' | 'low' | 'watch' | 'info'
  category: InventoryCategory
  title: string
  action: string
  age: string
}

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low'

export type ActionSource = 'resource' | 'plan' | 'expiry' | 'task'

export type DashboardAction = {
  id: string
  title: string
  reason: string
  priority: ActionPriority
  source: ActionSource
  fromActiveScenario?: boolean
  taskPhase?: PlanExecutionPhase
  relatedCatalogItemId?: string
  suggestedQuantity?: number
  suggestedUnit?: string
  planId?: string
  taskId?: string
}

export type ActiveScenario = {
  planId: string
  activatedAt: string
}

export type IncidentLogType =
  | 'note'
  | 'task_completed'
  | 'item_added'
  | 'scenario_started'
  | 'scenario_ended'

export type IncidentLogEntry = {
  id: string
  planId: string
  timestamp: string
  type: IncidentLogType
  message: string
}

export type ResourceSummary = {
  waterDays: number
  foodDays: number
  fuelDays: number
  totalWaterLitres: number
  totalFoodCalories: number
  totalFuelLitres: number
  waterStatus: ResourceStatus
  foodStatus: ResourceStatus
  fuelStatus: ResourceStatus
  medicalStatus: ResourceStatus
  medicalExpiringCount: number
  medicalExpiredCount: number
}

export type PlanPriority = 'critical' | 'high' | 'medium' | 'low'
export type PlanExecutionPhase = 'now' | 'next' | 'later'
export type PlanTimingPhase = 'Immediate' | 'First Hour' | 'First 24 Hours' | 'Ongoing'

export type PlanRequirement = {
  id: string
  label: string
  catalogItemId?: string
  category?: InventoryCategory
  itemName?: string
  minQuantity?: number
  unit?: string
  notes?: string
}

export type PlanTask = {
  id: string
  title: string
  description?: string
  phase?: PlanExecutionPhase | PlanTimingPhase
  timing?: PlanTimingPhase
  priority: PlanPriority
  completed: boolean
  linkedRequirementId?: string
  linkedMapLocationIds?: string[]
}

export type EmergencyPlan = {
  id: string
  name: string
  summary: string
  category: 'power' | 'water' | 'shelter' | 'medical' | 'evacuation' | 'communications'
  trigger: string
  priority: PlanPriority
  requirements: PlanRequirement[]
  tasks: PlanTask[]
  linkedMapLocationIds?: string[]
  notes?: string
}

export type RequirementGap = {
  requirement: PlanRequirement
  currentAmount: number
  requiredAmount: number
  deficit: number
  met: boolean
}

export type PlanReadiness = {
  planId: string
  readiness: number
  preparednessReadiness: number
  responseProgress: number
  requirementCoverage: number
  taskCompletion: number
  missing: RequirementGap[]
}

export type KnowledgeSourceType = 'note' | 'link' | 'document'

export type KnowledgeResource = {
  id: string
  title: string
  category: string
  sourceType: KnowledgeSourceType
  description?: string
  url?: string
  documentId?: string
  createdAt: string
  updatedAt: string
}

export type BackupPayload = {
  version: 2
  exportedAt: string
  items: InventoryItem[]
  plans?: EmergencyPlan[]
  locations?: Location[]
  mapLocations?: MapLocation[]
  mapPackMetadata?: MapPackMetadata
  settings: AppSettings
  activeScenario?: ActiveScenario
  incidentLog?: IncidentLogEntry[]
  ignoredDuplicateGroups?: IgnoredDuplicateGroup[]
  documentMetadata?: Array<Pick<StoredDocument, 'id' | 'name' | 'mimeType' | 'kind' | 'tag' | 'size' | 'createdAt'>>
  knowledgeResources?: KnowledgeResource[]
}

export type SupplyValueType =
  | 'potable_water'
  | 'water_treatment'
  | 'water_filter'
  | 'calories'
  | 'fuel_litres'
  | 'fuel_canister'
  | 'count'
  | 'medical'
  | 'hygiene'
  | 'document'
  | 'tool'
  | 'power'
  | 'shelter'
  | 'communications'
  | 'navigation'
  | 'unknown'

export type SupplyCatalogItem = {
  id: string
  canonicalName: string
  category: InventoryCategory
  subcategory?: string
  aliases: string[]
  tags: string[]
  defaultUnit: string
  valueType: SupplyValueType
  isConsumable: boolean
  isPerishable: boolean
  allowCustomAliases: boolean
}

export type UserInventoryAlias = {
  id: string
  text: string
  normalizedText: string
  catalogItemId?: string
  category?: InventoryCategory
  unit?: string
  lastUsedAt: string
  usageCount: number
}

export type IgnoredDuplicateGroup = {
  catalogItemId: string
  fingerprint: string
  ignoredAt: string
}

export type StoredDocumentTag = 'ID' | 'medical' | 'insurance' | 'other'

export type StoredDocumentKind = 'pdf' | 'image' | 'text'

export type StoredDocument = {
  id: string
  name: string
  mimeType: string
  kind: StoredDocumentKind
  tag: StoredDocumentTag
  dataUrl: string
  textContent?: string
  size: number
  createdAt: string
}

export type MapLocationType =
  | 'home'
  | 'rally'
  | 'water'
  | 'medical'
  | 'fuel'
  | 'shelter'
  | 'hazard'
  | 'communications'
  | 'other'

export type MapLocation = {
  id: string
  name: string
  type: MapLocationType
  longitude: number
  latitude: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export type MapPackPersistence = 'remembered' | 'session_only' | 'needs_reselect'

export type MapPackMetadata = {
  id: 'active'
  fileName: string
  fileSize: number
  selectedAt: string
  persistence: MapPackPersistence
  pmtilesUrl?: string
  tileType?: 'vector' | 'raster' | 'unknown'
  sourceLayers?: string[]
}
