import {
  AlertTriangle,
  Bell,
  BookOpen,
  Box,
  BriefcaseMedical,
  CalendarDays,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Database,
  Droplets,
  ExternalLink,
  FileText,
  Fuel,
  Gauge,
  Home,
  Image as ImageIcon,
  Map as MapIcon,
  MapPinned,
  Moon,
  NotebookPen,
  PackagePlus,
  Radio,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Sun,
  Trash2,
  Utensils,
  Upload,
  Zap,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import { FileSource, PMTiles, Protocol, TileType } from 'pmtiles'
import 'maplibre-gl/dist/maplibre-gl.css'
import './App.css'
import { seedPlans } from './data/seed'
import type {
  ActiveScenario,
  AppSettings,
  DashboardAlert,
  DashboardAction,
  EmergencyPlan,
  IgnoredDuplicateGroup,
  IncidentLogEntry,
  IncidentLogType,
  InventoryCategory,
  InventoryItem,
  KnowledgeResource,
  KnowledgeSourceType,
  MapLocation,
  MapLocationType,
  MapPackMetadata,
  PlanTask,
  RequirementGap,
  ResourceStatus,
  StoredDocument,
  StoredDocumentKind,
  StoredDocumentTag,
  SupplyCatalogItem,
  UserInventoryAlias,
} from './types'
import {
  formatDays,
  getDaysUntilExpiry,
  getCategoryReadiness,
  getDashboardAlerts,
  getDepletionSeries,
  getItemStatus,
  getNextFailurePoint,
  getResourceSummary,
  getStoredValue,
  statusFromPercent,
} from './lib/readiness'
import {
  executionPhases,
  getTaskExecutionPhase,
  getTaskPlanningPhase,
  getPlanReadiness,
  getPriorityStatus,
  getRecommendedPlan,
  planPhases,
  resetPlanTasks,
} from './lib/plans'
import {
  loadInventory,
  loadIgnoredDuplicateGroups,
  loadIncidentLog,
  loadDocuments,
  loadKnowledgeResources,
  loadMapLocations,
  loadMapPackHandle,
  loadMapPackMetadata,
  loadPlans,
  loadSettings,
  loadActiveScenario,
  resetPlansToSeed,
  resetToSeedData,
  saveActiveScenario,
  saveIgnoredDuplicateGroups,
  saveInventory,
  saveIncidentLog,
  saveDocuments,
  saveKnowledgeResources,
  saveMapLocations,
  saveMapPackHandle,
  saveMapPackMetadata,
  savePlans,
  saveSettings,
  saveUserAliases,
  loadUserAliases,
  addOrUpdateUserAlias,
} from './lib/storage'
import { isVolumeUnit } from './lib/units'
import { supplyCatalog } from './data/supplyCatalog'
import {
  findBestCatalogMatch,
  findCatalogMatches,
  getCatalogItemById,
  getInventoryCategoryForCatalogItem,
  normalizeInventoryItem,
  normalizeSupplyName,
} from './lib/catalog'
import { getDashboardActions } from './lib/actions'
import { clampSettings, createBackupPayload, parseBackupPayload } from './lib/backup'
import {
  getDuplicateCandidates,
  ignoreDuplicateCandidate,
  mergeDuplicateGroup,
  type DuplicateCandidate,
} from './lib/duplicates'

type Page =
  | 'dashboard'
  | 'inventory'
  | 'plans'
  | 'maps'
  | 'documents'
  | 'knowledge'
  | 'settings'

type DrawerKind =
  | 'depletion'
  | 'alerts'
  | 'start-plan'
  | 'upload-document'
  | 'new-note'
  | 'open-plan'
  | 'item'
  | null

type ThemeMode = 'dark' | 'light'

type BrowserFilePicker = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean
    types?: Array<{ description: string; accept: Record<string, string[]> }>
  }) => Promise<FileSystemFileHandle[]>
}

type MapLocationForm = {
  name: string
  type: MapLocationType
  latitude: string
  longitude: string
  notes: string
}

type MapPointFilter = 'all' | 'evacuation' | 'water' | 'medical' | 'communications' | 'hazards' | 'shelter'

type ItemForm = {
  id?: string
  name: string
  catalogItemId: string
  category: InventoryCategory
  quantity: string
  unit: string
  caloriesPerUnit: string
  litresPerUnit: string
  expiryDate: string
  location: string
  minThreshold: string
  notes: string
}

type ScenarioSummary = {
  planName: string
  duration: string
  completedTasks: number
  totalTasks: number
  noteCount: number
}

type PendingPlanItem = {
  planName: string
  itemLabel: string
}

type ResourceCardData = {
  id: 'water' | 'food' | 'medical' | 'fuel' | 'overall'
  name: string
  icon: 'water' | 'food' | 'medical' | 'fuel' | 'overall'
  days: number
  stored: string
  status: ResourceStatus
  color: string
  valueLabel: string
  trend: number[]
}

const categories: InventoryCategory[] = [
  'water',
  'food',
  'medical',
  'fuel',
  'energy',
  'shelter',
  'communications',
  'hygiene',
  'tools',
  'other',
]

const navItems = [
  ['dashboard', 'Dashboard', Home],
  ['inventory', 'Inventory', Box],
  ['plans', 'Plans', ClipboardList],
  ['maps', 'Maps', MapIcon],
  ['documents', 'Documents', FileText],
  ['knowledge', 'Knowledge', BookOpen],
  ['settings', 'Settings', Settings],
] as const

const emptyForm: ItemForm = {
  name: '',
  catalogItemId: '',
  category: 'food',
  quantity: '1',
  unit: 'unit',
  caloriesPerUnit: '',
  litresPerUnit: '',
  expiryDate: '',
  location: 'Pantry',
  minThreshold: '',
  notes: '',
}

const emptyMapLocationForm: MapLocationForm = {
  name: '',
  type: 'home',
  latitude: '',
  longitude: '',
  notes: '',
}

const mapLocationTypes: Array<{ type: MapLocationType; label: string }> = [
  { type: 'home', label: 'Home' },
  { type: 'rally', label: 'Rally point' },
  { type: 'water', label: 'Water' },
  { type: 'medical', label: 'Medical' },
  { type: 'fuel', label: 'Fuel' },
  { type: 'shelter', label: 'Shelter' },
  { type: 'hazard', label: 'Hazard' },
  { type: 'communications', label: 'Communications' },
  { type: 'other', label: 'Other' },
]

const mapPointFilters: Array<{ id: MapPointFilter; label: string; types: MapLocationType[] }> = [
  { id: 'all', label: 'All', types: [] },
  { id: 'evacuation', label: 'Evacuation', types: ['home', 'rally', 'shelter', 'fuel'] },
  { id: 'water', label: 'Water', types: ['water'] },
  { id: 'medical', label: 'Medical', types: ['medical'] },
  { id: 'communications', label: 'Communications', types: ['communications'] },
  { id: 'hazards', label: 'Hazards', types: ['hazard'] },
  { id: 'shelter', label: 'Shelter', types: ['shelter', 'home', 'rally'] },
]

const knowledgeCategories = [
  'First Aid',
  'Water',
  'Food',
  'Power',
  'Communications',
  'Shelter',
  'Sanitation',
  'Repairs',
  'Local Info',
  'Other',
]

let pmtilesProtocolRegistered = false
let pmtilesProtocol: Protocol | null = null

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('survival-os.theme') === 'light' ? 'light' : 'dark'))
  const [page, setPage] = useState<Page>('dashboard')
  const [items, setItems] = useState(() => loadInventory())
  const [plans, setPlans] = useState(() => loadPlans())
  const [settings, setSettings] = useState(() => loadSettings())
  const [aliases, setAliases] = useState(() => loadUserAliases())
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | undefined>(() => loadActiveScenario())
  const [incidentLog, setIncidentLog] = useState<IncidentLogEntry[]>(() => loadIncidentLog())
  const [ignoredDuplicateGroups, setIgnoredDuplicateGroups] = useState(() => loadIgnoredDuplicateGroups())
  const [documents, setDocuments] = useState<StoredDocument[]>([])
  const [documentsLoaded, setDocumentsLoaded] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [knowledgeResources, setKnowledgeResources] = useState<KnowledgeResource[]>(() => loadKnowledgeResources())
  const [mapLocations, setMapLocations] = useState<MapLocation[]>(() => loadMapLocations())
  const [selectedMapLocationId, setSelectedMapLocationId] = useState<string | null>(null)
  const [mapLocationForm, setMapLocationForm] = useState<MapLocationForm>(emptyMapLocationForm)
  const [mapPack, setMapPack] = useState<MapPackMetadata | undefined>(() => normalizeLoadedMapPack(loadMapPackMetadata()))
  const [mapPackError, setMapPackError] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState('power-outage')
  const [drawer, setDrawer] = useState<DrawerKind>(null)
  const [notice, setNotice] = useState('')
  const [lastBackupAt, setLastBackupAt] = useState(() => localStorage.getItem('survival-os.last-backup-at') ?? '')
  const [scenarioSummary, setScenarioSummary] = useState<ScenarioSummary | null>(null)
  const [headerClock, setHeaderClock] = useState(() => new Date())
  const [form, setForm] = useState<ItemForm>(emptyForm)
  const [pendingPlanItem, setPendingPlanItem] = useState<PendingPlanItem | null>(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false)

  useEffect(() => {
    localStorage.setItem('survival-os.theme', theme)
  }, [theme])
  useEffect(() => saveInventory(items), [items])
  useEffect(() => savePlans(plans), [plans])
  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => saveUserAliases(aliases), [aliases])
  useEffect(() => saveActiveScenario(activeScenario), [activeScenario])
  useEffect(() => saveIncidentLog(incidentLog), [incidentLog])
  useEffect(() => saveIgnoredDuplicateGroups(ignoredDuplicateGroups), [ignoredDuplicateGroups])
  useEffect(() => saveKnowledgeResources(knowledgeResources), [knowledgeResources])
  useEffect(() => saveMapLocations(mapLocations), [mapLocations])
  useEffect(() => saveMapPackMetadata(mapPack), [mapPack])
  useEffect(() => {
    let cancelled = false
    async function restoreMapPackHandle() {
      const metadata = loadMapPackMetadata()
      if (!metadata || metadata.persistence !== 'remembered') return
      const handle = await loadMapPackHandle()
      if (!handle || cancelled) {
        setMapPack({ ...metadata, persistence: 'needs_reselect', pmtilesUrl: undefined })
        return
      }
      try {
        const file = await handle.getFile()
        const nextMetadata = await registerPmtilesFile(file, 'remembered', metadata.selectedAt)
        if (!cancelled) {
          setMapPack(nextMetadata)
          setMapPackError('')
        }
      } catch {
        if (!cancelled) {
          setMapPack({ ...metadata, persistence: 'needs_reselect', pmtilesUrl: undefined })
          setMapPackError('Map pack needs to be selected again before it can be used.')
        }
      }
    }
    restoreMapPackHandle()
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    let cancelled = false
    loadDocuments()
      .then((loadedDocuments) => {
        if (cancelled) return
        setDocuments(loadedDocuments)
        setDocumentsLoaded(true)
      })
      .catch(() => setDocumentsLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    if (documentsLoaded) saveDocuments(documents).catch(() => undefined)
  }, [documents, documentsLoaded])
  useEffect(() => {
    if (lastBackupAt) localStorage.setItem('survival-os.last-backup-at', lastBackupAt)
  }, [lastBackupAt])
  useEffect(() => {
    const timer = window.setInterval(() => setHeaderClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const summary = useMemo(() => getResourceSummary(items, settings), [items, settings])
  const alerts = useMemo(
    () => getDashboardAlerts(summary, items, settings),
    [items, settings, summary],
  )
  const nextFailure = useMemo(() => getNextFailurePoint(summary), [summary])
  const depletionSeries = useMemo(() => getDepletionSeries(summary), [summary])
  const recommendedPlan = useMemo(
    () => getRecommendedPlan(plans, items, settings),
    [items, plans, settings],
  )
  const activePlan = useMemo(
    () => plans.find((plan) => plan.id === activeScenario?.planId),
    [activeScenario?.planId, plans],
  )
  const dashboardPlan = activePlan ?? recommendedPlan
  const recommendedPlanReadiness = useMemo(
    () => getPlanReadiness(dashboardPlan, items, settings),
    [dashboardPlan, items, settings],
  )
  const dashboardActions = useMemo(
    () =>
      getDashboardActions({
        activeScenario,
        activePlan: dashboardPlan,
        items,
        planReadiness: recommendedPlanReadiness,
        settings,
        summary,
      }),
    [activeScenario, dashboardPlan, items, recommendedPlanReadiness, settings, summary],
  )
  const readinessAlerts = useMemo(
    () => makeDrawerAlerts(alerts, dashboardActions),
    [alerts, dashboardActions],
  )

  const readiness = useMemo(
    () => [
      makeReadiness('Water', 'water', 'water', items, summary, settings),
      makeReadiness('Food', 'food', 'food', items, summary, settings),
      makeReadiness('Shelter', 'shelter', 'shelter', items, summary, settings),
      makeReadiness('Medical', 'medical', 'medical', items, summary, settings),
      makeReadiness('Energy', 'energy', 'energy', items, summary, settings),
      makeReadiness('Communications', 'communications', 'comms', items, summary, settings),
    ],
    [items, settings, summary],
  )

  const overallReadiness = Math.round(
    readiness.reduce((total, item) => total + item.value, 0) / readiness.length,
  )
  const overallStatus = statusFromPercent(overallReadiness)
  const resources = useMemo<ResourceCardData[]>(
    () => [
      {
        id: 'water',
        name: 'Water',
        icon: 'water',
        days: summary.waterDays,
        stored: `${summary.totalWaterLitres} L stored`,
        status: summary.waterStatus,
        color: '#4bb6ff',
        valueLabel: `${formatDays(summary.waterDays)} days`,
        trend: trendFromDays(summary.waterDays),
      },
      {
        id: 'food',
        name: 'Food',
        icon: 'food',
        days: summary.foodDays,
        stored: `${Math.round(summary.totalFoodCalories).toLocaleString()} kcal stored`,
        status: summary.foodStatus,
        color: '#45d978',
        valueLabel: `${formatDays(summary.foodDays)} days`,
        trend: trendFromDays(summary.foodDays),
      },
      {
        id: 'fuel',
        name: 'Fuel',
        icon: 'fuel',
        days: summary.fuelDays,
        stored: `${summary.totalFuelLitres} L stored`,
        status: summary.fuelStatus,
        color: '#ff594f',
        valueLabel: `${formatDays(summary.fuelDays)} days`,
        trend: trendFromDays(summary.fuelDays),
      },
      {
        id: 'overall',
        name: 'Overall',
        icon: 'overall',
        days: overallReadiness,
        stored: 'Inventory, plans and supplies',
        status: overallStatus === 'GOOD' ? 'OK' : overallStatus,
        color: '#7dd3fc',
        valueLabel: `${overallReadiness}%`,
        trend: [62, 64, 66, 67, 69, 70, overallReadiness],
      },
    ],
    [overallReadiness, overallStatus, summary],
  )

  const duplicateCandidates = useMemo(
    () => getDuplicateCandidates(items, ignoredDuplicateGroups),
    [ignoredDuplicateGroups, items],
  )
  const duplicateByItemId = useMemo(() => {
    const map = new globalThis.Map<string, DuplicateCandidate>()
    for (const candidate of duplicateCandidates) {
      for (const id of candidate.itemIds) {
        map.set(id, candidate)
      }
    }
    return map
  }, [duplicateCandidates])

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      const status = getItemStatus(item)
      const needsAttention = getItemAttentionReasons(item, duplicateByItemId.get(item.id)).length > 0
      const matchesQuery = [item.name, item.category, item.location, item.notes]
        .join(' ')
        .toLowerCase()
        .includes(needle)
      return (
        matchesQuery &&
        (categoryFilter === 'all' || item.category === categoryFilter) &&
        (statusFilter === 'all' || status === statusFilter) &&
        (locationFilter === 'all' || item.location === locationFilter) &&
        (!needsAttentionOnly || needsAttention)
      )
    })
  }, [categoryFilter, duplicateByItemId, items, locationFilter, needsAttentionOnly, query, statusFilter])

  const locations = [
    ...new Set(items.map((item) => item.location).filter((location): location is string => Boolean(location))),
  ]

  function exportBackup() {
    const payload = createBackupPayload({
      activeScenario,
      ignoredDuplicateGroups,
      incidentLog,
      items,
      knowledgeResources,
      mapLocations,
      mapPackMetadata: mapPack,
      documentMetadata: documents.map(toDocumentMetadata),
      plans,
      settings,
    })
    downloadBackup(payload)
    setLastBackupAt(payload.exportedAt)
    showNotice('Local backup exported.')
  }

  function showNotice(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2600)
  }

  function addIncidentLogEntry(
    planId: string,
    type: IncidentLogType,
    message: string,
  ) {
    setIncidentLog((current) => [
      {
        id: `log-${crypto.randomUUID()}`,
        planId,
        timestamp: new Date().toISOString(),
        type,
        message,
      },
      ...current,
    ])
  }

  function openAddItem() {
    setForm(emptyForm)
    setPendingPlanItem(null)
    setPage('inventory')
    setDrawer('item')
  }

  function openMissingItem(gap: RequirementGap, planName: string) {
    const unit = gap.requirement.unit ?? 'unit'
    const category = gap.requirement.category ?? 'other'
    const catalogItem = getCatalogItemById(gap.requirement.catalogItemId)
    const catalogCategory = getInventoryCategoryForCatalogItem(catalogItem) ?? catalogItem?.category ?? category
    setForm({
      ...emptyForm,
      name: catalogItem?.canonicalName ?? gap.requirement.label,
      catalogItemId: catalogItem?.id ?? '',
      category: catalogCategory,
      quantity: formatQuantityInput(gap.deficit || 1),
      unit: catalogItem?.defaultUnit ?? unit,
      litresPerUnit: unit === 'L' && (category === 'water' || category === 'fuel') ? '1' : '',
      location: defaultLocationForCategory(catalogCategory),
      notes: `Added from ${planName} plan. Required to close missing readiness gap.`,
    })
    setPendingPlanItem({ planName, itemLabel: gap.requirement.label })
    setPage('inventory')
    setDrawer('item')
  }

  function openCatalogSupply(
    catalogItemId?: string,
    quantity = 1,
    unit?: string,
    notes = "Added from Today's Priorities.",
  ) {
    const catalogItem = getCatalogItemById(catalogItemId)
    if (!catalogItem) {
      openAddItem()
      return
    }
    const catalogCategory = getInventoryCategoryForCatalogItem(catalogItem) ?? catalogItem.category
    setForm(applyCatalogToForm(
      {
        ...emptyForm,
        quantity: formatQuantityInput(quantity || 1),
        unit: unit ?? catalogItem.defaultUnit,
        location: defaultLocationForCategory(catalogCategory),
        notes,
      },
      catalogItem,
      true,
    ))
    setPendingPlanItem(null)
    setPage('inventory')
    setDrawer('item')
  }

  function openEditItem(item: InventoryItem) {
    setPendingPlanItem(null)
    setForm({
      id: item.id,
      name: item.name,
      catalogItemId: item.catalogItemId ?? findBestCatalogMatch(item.name)?.id ?? '',
      category: item.category,
      quantity: String(item.quantity),
      unit: item.unit,
      caloriesPerUnit: item.caloriesPerUnit ? String(item.caloriesPerUnit) : '',
      litresPerUnit: item.litresPerUnit ? String(item.litresPerUnit) : '',
      expiryDate: item.expiryDate ?? '',
      location: item.location ?? '',
      minThreshold: item.minThreshold ? String(item.minThreshold) : '',
      notes: item.notes ?? '',
    })
    setDrawer('item')
  }

  function saveItem(event: FormEvent) {
    event.preventDefault()
    const catalogItem = getCatalogItemById(form.catalogItemId) ?? findBestCatalogMatch(form.name)
    const catalogCategory = getInventoryCategoryForCatalogItem(catalogItem) ?? form.category
    const item: InventoryItem = normalizeInventoryItem({
      id: form.id ?? `item-${crypto.randomUUID()}`,
      name: form.name.trim(),
      displayName: form.name.trim(),
      catalogItemId: form.catalogItemId || catalogItem?.id,
      category: catalogCategory,
      quantity: Number(form.quantity) || 0,
      unit: form.unit.trim() || 'unit',
      caloriesPerUnit: form.caloriesPerUnit ? Number(form.caloriesPerUnit) : undefined,
      litresPerUnit: form.litresPerUnit
        ? Number(form.litresPerUnit)
        : inferLitresPerUnit(form.category, form.unit),
      expiryDate: form.expiryDate || undefined,
      location: form.location.trim() || 'Unassigned',
      minThreshold: form.minThreshold ? Number(form.minThreshold) : undefined,
      notes: form.notes.trim() || undefined,
    })
    if (!item.name) return
    setItems((current) =>
      form.id ? current.map((entry) => (entry.id === form.id ? item : entry)) : [...current, item],
    )
    setAliases((current) =>
      addOrUpdateUserAlias(current, {
        text: item.name,
        catalogItemId: item.catalogItemId,
        category: item.category,
        unit: item.unit,
      }),
    )
    setDrawer(null)
    const pending = pendingPlanItem
    setPendingPlanItem(null)
    if (!form.id && activeScenario) {
      addIncidentLogEntry(
        activeScenario.planId,
        'item_added',
        `${item.name} added (${formatQuantityInput(item.quantity)} ${item.unit})`,
      )
    }
    showNotice(
      pending
        ? `Added ${item.name}. Readiness recalculated.`
        : 'Inventory updated. Dashboard recalculated.',
    )
  }

  function deleteItem(id?: string) {
    if (!id) return
    const item = items.find((entry) => entry.id === id)
    if (item && !window.confirm(`Delete inventory item "${item.name}"?`)) return
    setItems((current) => current.filter((item) => item.id !== id))
    setDrawer(null)
    showNotice('Item deleted. Readiness recalculated.')
  }

  function resetDemoData() {
    if (!window.confirm('Restore demo inventory? This replaces current inventory with seed data, restores default settings, and clears active scenario logs.')) return
    const reset = resetToSeedData()
    setItems(reset.items)
    setSettings(reset.settings)
    setActiveScenario(undefined)
    setIncidentLog([])
    setIgnoredDuplicateGroups([])
    showNotice('Demo state restored.')
  }

  function mergeInventoryDuplicates(catalogItemId: string) {
    setItems((current) => {
      const result = mergeDuplicateGroup(current, catalogItemId)
      if (!result.merged) {
        showNotice(result.reason ?? 'Merge could not be completed.')
        return current
      }
      showNotice('Duplicate inventory rows merged. Readiness recalculated.')
      return result.items
    })
  }

  function keepDuplicateSeparate(candidate: DuplicateCandidate) {
    setIgnoredDuplicateGroups((current) => ignoreDuplicateCandidate(current, candidate))
    showNotice('Duplicate warning hidden. Items kept separate.')
  }

  function openPlaceholder(target: Page, nextDrawer: DrawerKind) {
    setPage(target)
    setDrawer(target === 'documents' && nextDrawer === 'upload-document' ? null : nextDrawer)
  }

  async function addDocuments(files: FileList | File[], tag: StoredDocumentTag) {
    const nextDocuments = await Promise.all(
      Array.from(files)
        .filter((file) => getDocumentKind(file) !== undefined)
        .map(async (file) => {
          const kind = getDocumentKind(file) as StoredDocumentKind
          return {
            id: `doc-${crypto.randomUUID()}`,
            name: file.name,
            mimeType: file.type || getFallbackMimeType(file.name, kind),
            kind,
            tag,
            dataUrl: await readFileAsDataUrl(file),
            textContent: kind === 'text' ? await file.text() : undefined,
            size: file.size,
            createdAt: new Date().toISOString(),
          }
        }),
    )
    if (nextDocuments.length === 0) {
      showNotice('No supported documents selected.')
      return
    }
    setDocuments((current) => [...nextDocuments, ...current])
    setSelectedDocumentId(nextDocuments[0].id)
    showNotice(`${nextDocuments.length} document${nextDocuments.length === 1 ? '' : 's'} stored locally.`)
  }

  function deleteDocument(id: string) {
    setDocuments((current) => current.filter((document) => document.id !== id))
    setSelectedDocumentId((current) => (current === id ? null : current))
    showNotice('Document deleted.')
  }

  function updateDocumentTag(id: string, tag: StoredDocumentTag) {
    setDocuments((current) => current.map((document) => (document.id === id ? { ...document, tag } : document)))
    showNotice('Document category updated.')
  }

  function addKnowledgeResource(resource: Omit<KnowledgeResource, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    setKnowledgeResources((current) => [
      {
        ...resource,
        id: `knowledge-${crypto.randomUUID()}`,
        createdAt: now,
        updatedAt: now,
      },
      ...current,
    ])
    showNotice('Knowledge resource saved locally.')
  }

  function deleteKnowledgeResource(id: string) {
    const resource = knowledgeResources.find((entry) => entry.id === id)
    if (resource && !window.confirm(`Delete knowledge resource "${resource.title}"?`)) return
    setKnowledgeResources((current) => current.filter((entry) => entry.id !== id))
    showNotice('Knowledge resource deleted.')
  }

  function openKnowledgeDocument(documentId: string) {
    setSelectedDocumentId(documentId)
    setPage('documents')
  }

  function addMapLocation(event: FormEvent) {
    event.preventDefault()
    const latitude = Number(mapLocationForm.latitude)
    const longitude = Number(mapLocationForm.longitude)
    const name = mapLocationForm.name.trim()
    if (!name) {
      showNotice('Enter a point name.')
      return
    }
    if (mapLocations.some((location) => normalizeSupplyName(location.name) === normalizeSupplyName(name))) {
      showNotice('A saved point already uses that name.')
      return
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      showNotice('Enter valid latitude and longitude numbers.')
      return
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      showNotice('Latitude must be -90 to 90. Longitude must be -180 to 180.')
      return
    }
    const now = new Date().toISOString()
    const location: MapLocation = {
      id: `map-${crypto.randomUUID()}`,
      name,
      type: mapLocationForm.type,
      latitude,
      longitude,
      notes: mapLocationForm.notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    setMapLocations((current) => [location, ...current])
    setSelectedMapLocationId(location.id)
    setMapLocationForm(emptyMapLocationForm)
    showNotice('Map point saved locally.')
  }

  function deleteMapLocation(id: string) {
    const location = mapLocations.find((entry) => entry.id === id)
    if (location && !window.confirm(`Delete saved point "${location.name}"?`)) return
    setMapLocations((current) => current.filter((location) => location.id !== id))
    setSelectedMapLocationId((current) => (current === id ? null : current))
    showNotice('Map point deleted.')
  }

  function useExampleMapLocations() {
    const now = new Date().toISOString()
    const examples: MapLocation[] = [
      { id: `map-${crypto.randomUUID()}`, name: 'Home base', type: 'home', latitude: -33.8688, longitude: 151.2093, notes: 'Primary household location.', createdAt: now, updatedAt: now },
      { id: `map-${crypto.randomUUID()}`, name: 'Neighbourhood rally point', type: 'rally', latitude: -33.8668, longitude: 151.2153, notes: 'Meet here if phones are down.', createdAt: now, updatedAt: now },
      { id: `map-${crypto.randomUUID()}`, name: 'Backup water pickup', type: 'water', latitude: -33.8722, longitude: 151.204, notes: 'Check access before relying on this point.', createdAt: now, updatedAt: now },
      { id: `map-${crypto.randomUUID()}`, name: 'Fuel stop', type: 'fuel', latitude: -33.8615, longitude: 151.1995, createdAt: now, updatedAt: now },
      { id: `map-${crypto.randomUUID()}`, name: 'Flood-prone underpass', type: 'hazard', latitude: -33.875, longitude: 151.213, notes: 'Avoid during heavy rain.', createdAt: now, updatedAt: now },
    ]
    setMapLocations((current) => [...examples, ...current])
    setSelectedMapLocationId(examples[0].id)
    showNotice('Example map points added.')
  }

  function clearMapLocations() {
    if (!window.confirm('Clear all saved map points? Plan task links may show missing map points until you relink them.')) return
    setMapLocations([])
    setSelectedMapLocationId(null)
    showNotice('Saved map points cleared.')
  }

  async function importMapPack() {
    setMapPackError('')
    const picker = window as BrowserFilePicker
    if (picker.showOpenFilePicker) {
      try {
        const [handle] = await picker.showOpenFilePicker({
          multiple: false,
          types: [{ description: 'PMTiles map pack', accept: { 'application/octet-stream': ['.pmtiles'] } }],
        })
        if (!handle) return
        const file = await handle.getFile()
        if (!isPmtilesFile(file)) {
          setMapPackError('Select a .pmtiles map pack.')
          return
        }
        const metadata = await registerPmtilesFile(file, 'remembered')
        await saveMapPackHandle(handle)
        setMapPack(metadata)
        showNotice('Map pack loaded. Saved points remain local overlays.')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setMapPackError('Could not load that map pack. Blank map mode is still available.')
      }
      return
    }
    document.getElementById('map-pack-file-input')?.click()
  }

  async function importMapPackFromInput(file: File | undefined) {
    if (!file) return
    setMapPackError('')
    if (!isPmtilesFile(file)) {
      setMapPackError('Select a .pmtiles map pack.')
      return
    }
    try {
      const metadata = await registerPmtilesFile(file, 'session_only')
      await saveMapPackHandle(undefined)
      setMapPack(metadata)
      showNotice('Map pack loaded for this browser session.')
    } catch {
      setMapPack(undefined)
      setMapPackError('Could not load that map pack. Blank map mode is still available.')
    }
  }

  async function removeMapPack() {
    if (mapPack && !window.confirm(`Remove map pack "${mapPack.fileName}"? Saved points will stay available.`)) return
    setMapPack(undefined)
    setMapPackError('')
    await saveMapPackHandle(undefined)
    showNotice('Map pack removed. Saved points still work.')
  }

  function handleMapPackRenderError() {
    setMapPack((current) => (current ? { ...current, pmtilesUrl: undefined } : current))
    setMapPackError('Map background could not be rendered. Saved points are still available on the blank map.')
  }

  function openPlan(planId = recommendedPlan.id) {
    setSelectedPlanId(planId)
    setPage('plans')
    setDrawer(null)
  }

  function activatePlan(planId: string) {
    if (activeScenario && activeScenario.planId !== planId) {
      const currentPlan = plans.find((entry) => entry.id === activeScenario.planId)
      const nextPlan = plans.find((entry) => entry.id === planId)
      if (!window.confirm(`Activate ${nextPlan?.name ?? 'this plan'}? This will replace ${currentPlan?.name ?? 'the current scenario'} as the active scenario.`)) {
        return
      }
    }
    setActiveScenario({
      planId,
      activatedAt: new Date().toISOString(),
    })
    addIncidentLogEntry(planId, 'scenario_started', 'Scenario activated')
    setSelectedPlanId(planId)
    showNotice('Scenario activated.')
  }

  function deactivatePlan() {
    if (!activeScenario) return
    const plan = plans.find((entry) => entry.id === activeScenario.planId)
    if (!window.confirm('End this scenario?')) return
    const completedTasks = plan?.tasks.filter((task) => task.completed).length ?? 0
    const totalTasks = plan?.tasks.length ?? 0
    const noteCount = incidentLog.filter((entry) => entry.planId === activeScenario.planId && entry.type === 'note').length
    setScenarioSummary({
      planName: plan?.name ?? 'Scenario',
      duration: formatDuration(activeScenario.activatedAt, new Date().toISOString()),
      completedTasks,
      totalTasks,
      noteCount,
    })
    addIncidentLogEntry(activeScenario.planId, 'scenario_ended', 'Scenario ended')
    setActiveScenario(undefined)
    showNotice('Scenario deactivated.')
  }

  function updatePlanTask(planId: string, taskId: string, completed: boolean) {
    let completedTaskName = ''
    setPlans((current) =>
      current.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              tasks: plan.tasks.map((task) =>
                task.id === taskId
                  ? (() => {
                      if (completed && !task.completed && activeScenario?.planId === planId) {
                        completedTaskName = task.title
                      }
                      return { ...task, completed }
                    })()
                  : task,
              ),
            }
          : plan,
      ),
    )
    if (completedTaskName) {
      addIncidentLogEntry(planId, 'task_completed', `Task completed: ${completedTaskName}`)
    }
  }

  function updatePlanTaskMapPoint(planId: string, taskId: string, mapLocationId: string) {
    setPlans((current) =>
      current.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              tasks: plan.tasks.map((task) =>
                task.id === taskId
                  ? { ...task, linkedMapLocationIds: mapLocationId ? [mapLocationId] : undefined }
                  : task,
              ),
            }
          : plan,
      ),
    )
    showNotice(mapLocationId ? 'Map point linked to task.' : 'Map point link removed.')
  }

  function openMapLocation(locationId: string) {
    setSelectedMapLocationId(locationId)
    setPage('maps')
    setDrawer(null)
  }

  function openPlanMapPoints(planId: string) {
    const plan = plans.find((entry) => entry.id === planId)
    const firstLinkedPoint = plan ? getLinkedMapLocationIdsForPlan(plan).find((id) => mapLocations.some((location) => location.id === id)) : undefined
    if (firstLinkedPoint) setSelectedMapLocationId(firstLinkedPoint)
    setPage('maps')
    setDrawer(null)
  }

  function handleDashboardAction(action: DashboardAction) {
    if (action.source === 'task' && action.planId && action.taskId) {
      updatePlanTask(action.planId, action.taskId, true)
      showNotice('Priority task marked done.')
      return
    }
    if ((action.source === 'resource' || action.source === 'plan') && action.relatedCatalogItemId) {
      openCatalogSupply(
        action.relatedCatalogItemId,
        action.suggestedQuantity,
        action.suggestedUnit,
        `Added from Today's Priorities. Reason: ${action.reason}`,
      )
      return
    }
    if (action.planId) {
      openPlan(action.planId)
      return
    }
    setPage('inventory')
  }

  function resetSelectedPlanTasks() {
    if (!window.confirm('Reset checklist completion for this plan? Supplies and map links stay unchanged.')) return
    setPlans((current) =>
      current.map((plan) =>
        plan.id === selectedPlanId ? resetPlanTasks(plan) : plan,
      ),
    )
    showNotice('Plan checklist reset.')
  }

  function resetPlanDemoData() {
    if (!window.confirm('Restore demo scenario plans? This replaces current plans and resets checklist completion and plan links.')) return
    const seed = resetPlansToSeed()
    setPlans(seed)
    setSelectedPlanId('power-outage')
    showNotice('Seed plans restored.')
  }

  function addIncidentNote(planId: string, note: string) {
    const text = note.trim()
    if (!text) return
    addIncidentLogEntry(planId, 'note', text)
    showNotice('Incident note saved.')
  }

  return (
    <div className={`survival-os ${theme === 'light' ? 'light-theme' : 'dark-theme'}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Shield size={26} />
          </div>
          <div>
            <strong>Survival OS</strong>
            <span>Local Preparedness System</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Primary">
          {navItems.map(([id, label, Icon]) => (
            <button
              className={page === id ? 'active' : ''}
              type="button"
              key={id}
              onClick={() => setPage(id)}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </nav>

        <div className="overall-readiness">
          <span>Overall readiness</span>
          <strong>{overallReadiness}%</strong>
          <b>{overallStatus}</b>
          <div className="track">
            <i style={{ width: `${overallReadiness}%` }} />
          </div>
          <p>Inventory-driven readiness from local supplies.</p>
          <button type="button" onClick={() => openPlan(recommendedPlan.id)}>
            View Readiness Report <ChevronRight size={16} />
          </button>
        </div>

        <div className="local-mode">
          <span />
          <strong>LOCAL MODE</strong>
          <p>All data stored on this device</p>
        </div>
      </aside>

      <main className="dashboard">
        <header className="header">
          <div>
            <h1>{page === 'dashboard' ? 'Dashboard' : page}</h1>
            <p>{page === 'inventory' ? 'Inventory drives every readiness calculation' : 'Household Readiness Overview'}</p>
          </div>
          <div className="system-bar">
            <span>
              <b>Local only</b> <i />
            </span>
            <span>{formatHeaderClock(headerClock)}</span>
            <button
              type="button"
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button type="button" aria-label="Alerts" className="bell" onClick={() => setDrawer('alerts')}>
              <Bell size={18} />
              <em>{readinessAlerts.length}</em>
            </button>
            <button type="button" aria-label="Settings" onClick={() => setPage('settings')}>
              <Settings size={18} />
            </button>
          </div>
        </header>

        {page === 'dashboard' && (
          <>
            <DashboardView
              alerts={alerts}
              actions={dashboardActions}
              activeScenario={activeScenario}
              nextFailure={nextFailure}
              onAddSupply={openAddItem}
              onOpenPlan={openPlan}
              onOpenDrawer={setDrawer}
              onPlaceholder={openPlaceholder}
              onBackup={exportBackup}
              onDashboardAction={handleDashboardAction}
              onDeactivateScenario={deactivatePlan}
              plan={dashboardPlan}
              plans={plans}
              planReadiness={recommendedPlanReadiness}
              readiness={readiness}
              resources={resources}
              lastBackupAt={lastBackupAt}
              documentsCount={documents.length}
              duplicateByItemId={duplicateByItemId}
              incidentLog={incidentLog}
              items={items}
              knowledgeCount={knowledgeResources.length}
              mapLocations={mapLocations}
              mapPack={mapPack}
            />
          </>
        )}

        {page === 'inventory' && (
          <InventoryPage
            categoryFilter={categoryFilter}
            duplicateByItemId={duplicateByItemId}
            duplicateCandidates={duplicateCandidates}
            filteredItems={filteredItems}
            items={items}
            locationFilter={locationFilter}
            locations={locations}
            onAdd={openAddItem}
            onEdit={openEditItem}
            onKeepDuplicateSeparate={keepDuplicateSeparate}
            onMergeDuplicate={mergeInventoryDuplicates}
            needsAttentionOnly={needsAttentionOnly}
            onReset={resetDemoData}
            query={query}
            settings={settings}
            setCategoryFilter={setCategoryFilter}
            setLocationFilter={setLocationFilter}
            setNeedsAttentionOnly={setNeedsAttentionOnly}
            setQuery={setQuery}
            setStatusFilter={setStatusFilter}
            statusFilter={statusFilter}
            summary={summary}
          />
        )}

        {page === 'plans' && (
          <PlansPage
            inventory={items}
            onAddMissingItem={openMissingItem}
            onPrint={() => showNotice('Print checklist workflow ready for local export.')}
            onResetAll={resetPlanDemoData}
            onResetSelected={resetSelectedPlanTasks}
            onSelectPlan={setSelectedPlanId}
            onOpenMapLocation={openMapLocation}
            onOpenPlanMapPoints={openPlanMapPoints}
            onLinkTaskMapPoint={updatePlanTaskMapPoint}
            onToggleTask={updatePlanTask}
            plans={plans}
            selectedPlanId={selectedPlanId}
            settings={settings}
            activeScenario={activeScenario}
            mapLocations={mapLocations}
            onActivatePlan={activatePlan}
            onDeactivatePlan={deactivatePlan}
            incidentLog={incidentLog}
            onAddIncidentNote={addIncidentNote}
            onDeleteIncidentLogEntry={(entryId) => {
              if (!window.confirm('Delete this incident log entry? This removes it from local history.')) return
              setIncidentLog((current) => current.filter((entry) => entry.id !== entryId))
              showNotice('Incident log entry deleted.')
            }}
          />
        )}

        {page === 'settings' && (
          <SettingsPage
            items={items}
            onImport={(payload) => {
              setItems(payload.items.map(normalizeInventoryItem))
              setPlans(payload.plans ?? seedPlans)
              setMapLocations(payload.mapLocations ?? [])
              setSelectedMapLocationId(null)
              setMapPack(payload.mapPackMetadata)
              setMapPackError(payload.mapPackMetadata ? 'Map pack details were restored. Select the PMTiles file again to restore the map background.' : '')
              saveMapPackHandle(undefined).catch(() => undefined)
              setKnowledgeResources(payload.knowledgeResources ?? [])
              setSettings(payload.settings)
              setActiveScenario(payload.activeScenario)
              setIncidentLog(payload.incidentLog ?? [])
              setIgnoredDuplicateGroups(payload.ignoredDuplicateGroups ?? [])
              setLastBackupAt(payload.exportedAt)
              showNotice(getImportResultMessage(payload))
            }}
            onReset={() => {
              if (!window.confirm('Restore demo state? This replaces inventory, plans, settings, map points, knowledge resources, active scenario and logs. Uploaded documents stay on this device.')) return
              const reset = resetToSeedData()
              const resetPlans = resetPlansToSeed()
              setItems(reset.items)
              setSettings(reset.settings)
              setPlans(resetPlans)
              setMapLocations([])
              setSelectedMapLocationId(null)
              setMapPack(undefined)
              setMapPackError('')
              saveMapPackHandle(undefined).catch(() => undefined)
              setKnowledgeResources([])
              setActiveScenario(undefined)
              setIncidentLog([])
              setIgnoredDuplicateGroups([])
              showNotice('Demo state restored.')
            }}
            plans={plans}
            settings={settings}
            setSettings={setSettings}
            summary={summary}
            activeScenario={activeScenario}
            ignoredDuplicateGroups={ignoredDuplicateGroups}
            incidentLog={incidentLog}
            mapLocations={mapLocations}
            mapPackMetadata={mapPack}
            documentMetadata={documents.map(toDocumentMetadata)}
            knowledgeResources={knowledgeResources}
            lastBackupAt={lastBackupAt}
            onBackupCreated={setLastBackupAt}
          />
        )}

        {page === 'maps' && (
          <MapsPage
            form={mapLocationForm}
            activeScenario={activeScenario}
            locations={mapLocations}
            mapPack={mapPack}
            mapPackError={mapPackError}
            onAddLocation={addMapLocation}
            onChangeForm={setMapLocationForm}
            onClearAll={clearMapLocations}
            onDeleteLocation={deleteMapLocation}
            onImportMapPack={importMapPack}
            onImportMapPackFromInput={importMapPackFromInput}
            onMapPackRenderError={handleMapPackRenderError}
            onRemoveMapPack={removeMapPack}
            onSelectLocation={setSelectedMapLocationId}
            onUseExamples={useExampleMapLocations}
            plans={plans}
            selectedLocationId={selectedMapLocationId}
            theme={theme}
          />
        )}

        {page === 'documents' && (
          <DocumentsPage
            documents={documents}
            onAddDocuments={addDocuments}
            onDeleteDocument={deleteDocument}
            onSelectDocument={setSelectedDocumentId}
            onUpdateDocumentTag={updateDocumentTag}
            selectedDocumentId={selectedDocumentId}
          />
        )}

        {page === 'knowledge' && (
          <KnowledgePage
            documents={documents}
            onAddResource={addKnowledgeResource}
            onDeleteResource={deleteKnowledgeResource}
            onOpenDocument={openKnowledgeDocument}
            resources={knowledgeResources}
          />
        )}

        {page !== 'dashboard' && page !== 'inventory' && page !== 'plans' && page !== 'settings' && page !== 'maps' && page !== 'documents' && page !== 'knowledge' && <PlaceholderPage page={page} />}
      </main>

      {notice && <div className="notice">{notice}</div>}
      {scenarioSummary && (
        <div className="drawer-backdrop" role="presentation" onClick={() => setScenarioSummary(null)}>
          <aside className="drawer summary-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <span>Scenario ended</span>
                <h2>{scenarioSummary.planName}</h2>
              </div>
              <button type="button" onClick={() => setScenarioSummary(null)}>Close</button>
            </div>
            <div className="settings-readout">
              <span>Duration: {scenarioSummary.duration}</span>
              <span>Tasks: {scenarioSummary.completedTasks} / {scenarioSummary.totalTasks}</span>
              <span>Notes: {scenarioSummary.noteCount}</span>
            </div>
          </aside>
        </div>
      )}
      {drawer && (
        <Drawer
          form={form}
          kind={drawer}
          pendingPlanItem={pendingPlanItem}
          aliases={aliases}
          alerts={alerts}
          actions={dashboardActions}
          depletionSeries={depletionSeries}
          onClose={() => {
            setDrawer(null)
            if (pendingPlanItem) setPendingPlanItem(null)
          }}
          onDelete={() => deleteItem(form.id)}
          onFormChange={setForm}
          nextFailure={nextFailure}
          onSaveItem={saveItem}
        />
      )}
    </div>
  )
}

function DashboardView({
  actions,
  activeScenario,
  alerts,
  documentsCount,
  duplicateByItemId,
  incidentLog,
  items,
  knowledgeCount,
  nextFailure,
  mapLocations,
  mapPack,
  onAddSupply,
  onBackup,
  onDashboardAction,
  onDeactivateScenario,
  onOpenPlan,
  onOpenDrawer,
  onPlaceholder,
  plan,
  plans,
  planReadiness,
  readiness,
  resources,
  lastBackupAt,
}: {
  actions: DashboardAction[]
  activeScenario?: ActiveScenario
  alerts: DashboardAlert[]
  documentsCount: number
  duplicateByItemId: Map<string, DuplicateCandidate>
  incidentLog: IncidentLogEntry[]
  items: InventoryItem[]
  knowledgeCount: number
  nextFailure: { name: string; days: number }
  mapLocations: MapLocation[]
  mapPack?: MapPackMetadata
  onAddSupply: () => void
  onBackup: () => void
  onDashboardAction: (action: DashboardAction) => void
  onDeactivateScenario: () => void
  onOpenPlan: (planId?: string) => void
  onOpenDrawer: (drawer: DrawerKind) => void
  onPlaceholder: (page: Page, drawer: DrawerKind) => void
  plan: EmergencyPlan
  plans: EmergencyPlan[]
  planReadiness: ReturnType<typeof getPlanReadiness>
  readiness: ReturnType<typeof makeReadiness>[]
  resources: ResourceCardData[]
  lastBackupAt: string
}) {
  const activeNowTask = activeScenario
    ? plan.tasks.find((task) => !task.completed && getTaskExecutionPhase(task) === 'now')
    : undefined
  const activeLinkedPoints = activeScenario ? getLinkedMapLocationsForPlan(plan, mapLocations) : []
  const attentionItems = items
    .map((item) => ({ item, reasons: getItemAttentionReasons(item, duplicateByItemId.get(item.id)) }))
    .filter((entry) => entry.reasons.length > 0)
    .slice(0, 5)
  const recentActivity = sortIncidentLogEntries(incidentLog).slice(0, 4)
  return (
    <>
      <section className="resource-grid" aria-label="Critical resources">
        {resources.map((resource) => (
          <ResourceCard resource={resource} key={resource.id} />
        ))}
      </section>

      <section className="content-grid">
        <div className="left-column">
          <ActionQueue actions={actions} onAction={onDashboardAction} />

          <Panel className="next-failure-panel">
            <div className="next-failure-copy">
              <span>Next failure</span>
              <strong>{nextFailure.name}</strong>
              <em>{formatDays(nextFailure.days)} days remaining</em>
            </div>
            <MiniChart
              color={getFailureColor(nextFailure.name)}
              points={trendFromDays(nextFailure.days)}
            />
            <p>{getFailureActionText(nextFailure)}</p>
            <button type="button" onClick={() => onOpenDrawer('depletion')}>
              View Details <ChevronRight size={16} />
            </button>
          </Panel>

          {activeScenario ? (
            <Panel className="active-scenario-banner">
              <div className="active-scenario-copy">
                <span>Active Scenario</span>
                <strong>{plan.name}</strong>
                <em>{activeNowTask ? `Next NOW task: ${activeNowTask.title}` : 'No incomplete NOW tasks'}</em>
                <em>{activeLinkedPoints.length} linked map point{activeLinkedPoints.length === 1 ? '' : 's'} / activated {formatRelativeAge(activeScenario.activatedAt)}</em>
              </div>
              <div className="active-scenario-actions">
                <button type="button" onClick={() => onOpenPlan(plan.id)}>Open active plan</button>
                <button type="button" className="muted" onClick={onDeactivateScenario}>Deactivate</button>
              </div>
            </Panel>
          ) : (
            <Panel className="empty-state compact-empty dashboard-no-scenario">
              <strong>No active scenario</strong>
              <span>Open scenario plans when you need to move from planning into execution mode.</span>
              <button type="button" className="compact-button" onClick={() => onOpenPlan(plan.id)}>Open scenario plan</button>
            </Panel>
          )}

          <div className="bottom-grid">
            <Panel>
              <PanelHeader
                title="Readiness by Category"
                subtitle="Current status of critical categories"
              />
              <div className="readiness-list">
                {readiness.map((item) => (
                  <ReadinessRow item={item} key={item.label} />
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Active / Recommended Plan" />
              <div className="scenario">
                <div className="scenario-head">
                  <div className="scenario-icon">
                    <Zap size={31} />
                  </div>
                  <div>
                    <h2>{plan.name}</h2>
                    <span>Readiness</span>
                  </div>
                  <strong>{planReadiness.readiness}%</strong>
                </div>
                <div className="scenario-meter">
                  <i style={{ width: `${planReadiness.readiness}%` }} />
                </div>
                <h3>Summary</h3>
                <p>{plan.summary}</p>
                <h3>Missing Critical Items</h3>
                <div className="missing-tags">
                  {planReadiness.missing.slice(0, 3).map((gap) => (
                    <span key={gap.requirement.id}>
                      {gap.requirement.label}: need {gap.deficit} more
                    </span>
                  ))}
                  {planReadiness.missing.length === 0 && <span>Core requirements met</span>}
                </div>
                <button type="button" className="open-plan" onClick={() => onOpenPlan(plan.id)}>
                  Open Plan <ChevronRight size={17} />
                </button>
              </div>
            </Panel>
          </div>
        </div>

        <div className="right-column">
          <Panel>
            <PanelHeader title="Needs Attention" subtitle="Inventory items with clear follow-up reasons" />
            {attentionItems.length > 0 ? (
              <div className="dashboard-attention-list">
                {attentionItems.map(({ item, reasons }) => (
                  <button type="button" key={item.id} onClick={() => onPlaceholder('inventory', null)}>
                    <strong>{item.name}</strong>
                    <span>{reasons.join(' / ')}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty">
                <strong>No inventory attention items</strong>
                <span>No expired, duplicate, below-minimum, or missing-detail items found.</span>
              </div>
            )}
          </Panel>

          <Panel>
            <div className="section-title row-title">
              <h2>
                Critical Alerts <span>{alerts.length}</span>
              </h2>
              <button type="button" onClick={() => onOpenDrawer('alerts')}>
                View all <ChevronRight size={16} />
              </button>
            </div>
            <div className="alerts">
              {alerts.slice(0, 4).map((alert) => (
                <AlertRow alert={alert} key={alert.id} />
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Quick Actions" />
            <div className="actions-grid">
              <ActionButton icon={<PackagePlus size={22} />} title="Add Supply" text="Add inventory item" onClick={onAddSupply} />
              <ActionButton icon={<Gauge size={22} />} title="Start Plan" text="Open scenario plan" onClick={() => onOpenPlan(plan.id)} />
              <ActionButton icon={<Upload size={22} />} title="Upload Document" text="Add to vault" onClick={() => onPlaceholder('documents', 'upload-document')} />
              <ActionButton icon={<NotebookPen size={22} />} title="New Note" text="Add to knowledge" onClick={() => onPlaceholder('knowledge', null)} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Map, Files & References" subtitle="Local context for where to go and what to open" />
            <div className="dashboard-snapshot-grid">
              <span><strong>{mapLocations.length}</strong> saved map points</span>
              <span><strong>{activeLinkedPoints.length}</strong> linked active-plan points</span>
              <span><strong>{getDashboardMapPackLabel(mapPack)}</strong> map pack</span>
              <span><strong>{documentsCount}</strong> household documents</span>
              <span><strong>{knowledgeCount}</strong> knowledge resources</span>
            </div>
            <p className="dashboard-helper-copy">Documents = household files. Knowledge = general references.</p>
            <p className="dashboard-helper-copy">Backups include app data and document details, not original document files or PMTiles files.</p>
          </Panel>

          <Panel>
            <PanelHeader title="Recent Activity" subtitle="What changed recently" />
            <div className="task-list">
              {recentActivity.length > 0 ? (
                recentActivity.map((entry) => (
                  <div className="task recent-activity-row" key={entry.id}>
                    <div>
                      <span className={`incident-type-pill ${entry.type}`}>{formatIncidentLogType(entry.type)}</span>
                      <strong>{entry.message}</strong>
                      <span>{formatIncidentPlanName(entry, plans)}</span>
                    </div>
                    <em>{formatRelativeAge(entry.timestamp)}</em>
                  </div>
                ))
              ) : (
                <div className="empty-state compact-empty">
                  <strong>No recent incident activity</strong>
                  <span>Scenario actions and notes will appear here when a plan is active.</span>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </section>

      <footer className="footer">
        <span>
          <Database size={14} /> Last backup: {lastBackupAt ? formatLogTimestamp(lastBackupAt) : 'Never'}
        </span>
        <span>
          <CalendarDays size={14} /> Next backup: Recommended
        </span>
        <button type="button" onClick={onBackup}>
          <Database size={14} /> Create Backup
        </button>
      </footer>
    </>
  )
}

function InventoryPage({
  categoryFilter,
  duplicateByItemId,
  duplicateCandidates,
  filteredItems,
  items,
  locationFilter,
  locations,
  onAdd,
  onEdit,
  onKeepDuplicateSeparate,
  onMergeDuplicate,
  needsAttentionOnly,
  onReset,
  query,
  settings,
  setCategoryFilter,
  setLocationFilter,
  setNeedsAttentionOnly,
  setQuery,
  setStatusFilter,
  statusFilter,
  summary,
}: {
  categoryFilter: string
  duplicateByItemId: Map<string, DuplicateCandidate>
  duplicateCandidates: DuplicateCandidate[]
  filteredItems: InventoryItem[]
  items: InventoryItem[]
  locationFilter: string
  locations: string[]
  onAdd: () => void
  onEdit: (item: InventoryItem) => void
  onKeepDuplicateSeparate: (candidate: DuplicateCandidate) => void
  onMergeDuplicate: (catalogItemId: string) => void
  needsAttentionOnly: boolean
  onReset: () => void
  query: string
  settings: AppSettings
  setCategoryFilter: (value: string) => void
  setLocationFilter: (value: string) => void
  setNeedsAttentionOnly: (value: boolean) => void
  setQuery: (value: string) => void
  setStatusFilter: (value: string) => void
  statusFilter: string
  summary: ReturnType<typeof getResourceSummary>
}) {
  const categoryOrder: InventoryCategory[] = [
    'water',
    'food',
    'medical',
    'fuel',
    'energy',
    'communications',
    'hygiene',
    'shelter',
    'tools',
    'other',
  ]
  const groupedRows = categoryOrder
    .map((category) => ({
      category,
      items: filteredItems.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <section className="inventory-page">
      <div className="inventory-summary">
        <Metric label="Water" value={`${formatDays(summary.waterDays)} days`} />
        <Metric label="Food" value={`${formatDays(summary.foodDays)} days`} />
        <Metric label="Fuel" value={`${formatDays(summary.fuelDays)} days`} />
        <Metric label="Items tracked" value={String(items.length)} />
      </div>

      <Panel>
        {duplicateCandidates.length > 0 && (
          <div className="inventory-duplicates-banner">
            <strong>{duplicateCandidates.length} merge candidates found</strong>
            <p>Items are grouped when they share the same catalog match. Merge only combines safe, compatible units; otherwise review or keep them separate.</p>
            <div className="duplicate-actions">
              {duplicateCandidates.map((candidate) => {
                const catalog = getCatalogItemById(candidate.catalogItemId)
                return (
                  <div className="duplicate-action-row" key={candidate.catalogItemId}>
                    <span>
                      {catalog?.canonicalName ?? candidate.catalogItemId} ({candidate.itemCount})
                      <em>Same catalog match</em>
                    </span>
                    {candidate.mergeable ? (
                      <span className="duplicate-row-actions">
                        <button
                          type="button"
                          className="compact-button"
                          onClick={() => onMergeDuplicate(candidate.catalogItemId)}
                        >
                          Merge
                        </button>
                        <button
                          type="button"
                          className="compact-button muted"
                          onClick={() => onKeepDuplicateSeparate(candidate)}
                        >
                          Keep separate
                        </button>
                      </span>
                    ) : (
                      <span className="duplicate-row-actions">
                        <em>{candidate.reviewReason ?? 'Review required'}</em>
                        <button
                          type="button"
                          className="compact-button muted"
                          onClick={() => onKeepDuplicateSeparate(candidate)}
                        >
                          Keep separate
                        </button>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <div className="inventory-toolbar">
          <div className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search inventory" />
          </div>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.currentTarget.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)}>
            <option value="all">All statuses</option>
            {['OK', 'WATCH', 'LOW', 'CRITICAL'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={locationFilter} onChange={(event) => setLocationFilter(event.currentTarget.value)}>
            <option value="all">All locations</option>
            {locations.map((location) => <option key={location} value={location}>{location}</option>)}
          </select>
          <button
            type="button"
            className={needsAttentionOnly ? 'compact-button attention-toggle' : 'compact-button muted'}
            onClick={() => setNeedsAttentionOnly(!needsAttentionOnly)}
          >
            Needs attention
          </button>
          <button type="button" className="compact-button" onClick={onAdd}>
            <PackagePlus size={17} /> Add item
          </button>
          <button type="button" className="compact-button muted" onClick={onReset}>
            <RotateCcw size={17} /> Restore Demo Inventory
          </button>
        </div>
        {needsAttentionOnly && (
          <p className="inventory-filter-note">
            Showing items that are expired, expiring soon, below an item minimum, possible duplicates, or missing useful stored-value details.
          </p>
        )}

        <div className="inventory-table-wrap">
          {items.length === 0 ? (
            <div className="empty-state">
              <strong>No inventory items yet.</strong>
              <span>Add water, food, medical, power, or communication supplies.</span>
              <button type="button" className="compact-button" onClick={onAdd}>Add item</button>
            </div>
          ) : groupedRows.length === 0 ? (
            <div className="empty-state">
              <strong>No inventory items match these filters.</strong>
              <span>Adjust search, category, status, location, or needs-attention filters.</span>
            </div>
          ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Stored Value</th>
                <th>Expiry</th>
                <th>Location</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((group) => {
                const categorySummary = getCategoryHeaderSummary(group.category, items, summary, settings)
                return (
                  <Fragment key={group.category}>
                    <tr className="inventory-category-row">
                      <td colSpan={8}>
                        <span className="inventory-category-main">{group.category}</span>
                        <span className="inventory-category-summary">
                          <span className="inventory-category-metric">{categorySummary.metric}</span>
                          <span className={`status-pill ${categorySummary.status.toLowerCase()}`}>
                            {categorySummary.status}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {group.items.map((item) => {
                      const duplicateCandidate = duplicateByItemId.get(item.id)
                      const attentionReasons = getItemAttentionReasons(item, duplicateCandidate)
                      return (
                      <tr key={item.id} onClick={() => onEdit(item)}>
                        <td>
                          <strong>{item.name}</strong>
                          <span className="match-subtext">{getItemMatchLabel(item)}</span>
                          {duplicateCandidate && (
                            <span className="duplicate-subtext">
                              <span className="duplicate-label">
                                {duplicateCandidate.mergeable ? 'Possible duplicate' : 'Duplicate review required'}
                              </span>
                            </span>
                          )}
                        </td>
                        <td>{item.category}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit}</td>
                        <td>{getStoredValue(item)}</td>
                        <td>{item.expiryDate ?? 'No expiry'}</td>
                        <td className="location-cell">{item.location ?? 'Unassigned'}</td>
                        <td>
                          <StatusPill status={getItemStatus(item)} />
                          {attentionReasons.length > 0 && (
                            <span className="attention-reasons">
                              {attentionReasons.join(' / ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    )})}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          )}
        </div>
      </Panel>
    </section>
  )
}

function PlansPage({
  activeScenario,
  incidentLog,
  onActivatePlan,
  onAddIncidentNote,
  onDeleteIncidentLogEntry,
  inventory,
  onAddMissingItem,
  onDeactivatePlan,
  onPrint,
  onResetAll,
  onResetSelected,
  onSelectPlan,
  onOpenMapLocation,
  onOpenPlanMapPoints,
  onLinkTaskMapPoint,
  onToggleTask,
  plans,
  selectedPlanId,
  settings,
  mapLocations,
}: {
  activeScenario?: ActiveScenario
  incidentLog: IncidentLogEntry[]
  onActivatePlan: (planId: string) => void
  onAddIncidentNote: (planId: string, note: string) => void
  onDeleteIncidentLogEntry: (entryId: string) => void
  inventory: InventoryItem[]
  onAddMissingItem: (gap: RequirementGap, planName: string) => void
  onDeactivatePlan: () => void
  onPrint: () => void
  onResetAll: () => void
  onResetSelected: () => void
  onSelectPlan: (planId: string) => void
  onOpenMapLocation: (locationId: string) => void
  onOpenPlanMapPoints: (planId: string) => void
  onLinkTaskMapPoint: (planId: string, taskId: string, mapLocationId: string) => void
  onToggleTask: (planId: string, taskId: string, completed: boolean) => void
  plans: EmergencyPlan[]
  selectedPlanId: string
  settings: AppSettings
  mapLocations: MapLocation[]
}) {
  const [incidentNoteText, setIncidentNoteText] = useState('')
  const [incidentLogExpanded, setIncidentLogExpanded] = useState(false)
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null)
  const incidentNoteRef = useRef<HTMLInputElement>(null)
  if (plans.length === 0) {
    return (
      <section className="plans-page">
        <Panel>
          <div className="empty-state">
            <strong>No scenario plans yet.</strong>
            <span>Create or restore plans for water, power, evacuation, medical, or communication scenarios.</span>
          </div>
        </Panel>
      </section>
    )
  }
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0]
  const activePlan = activeScenario ? plans.find((plan) => plan.id === activeScenario.planId) : undefined
  const selectedReadiness = getPlanReadiness(selectedPlan, inventory, settings)
  const planScores = plans.map((plan) => ({
    plan,
    readiness: getPlanReadiness(plan, inventory, settings),
  }))
  const weakestPlan = [...planScores].sort(
    (a, b) => a.readiness.readiness - b.readiness.readiness,
  )[0]
  const averageReadiness = Math.round(
    planScores.reduce((total, item) => total + item.readiness.readiness, 0) /
      Math.max(1, planScores.length),
  )
  const nextActions = selectedPlan.tasks
    .filter((task) => !task.completed)
    .sort((a, b) => {
      if (activeScenario?.planId === selectedPlan.id) {
        const executionRank = { now: 0, next: 1, later: 2 }
        const phaseGap = executionRank[getTaskExecutionPhase(a)] - executionRank[getTaskExecutionPhase(b)]
        if (phaseGap !== 0) return phaseGap
      }
      return priorityRank(a.priority) - priorityRank(b.priority)
    })
    .slice(0, 3)
  const primaryAction = getPrimaryPlanAction(selectedReadiness.missing, nextActions)
  const isActivePlan = activeScenario?.planId === selectedPlan.id
  const selectedIncidentLog = sortIncidentLogEntries(incidentLog.filter((entry) => entry.planId === selectedPlan.id))
  const visibleIncidentLog = selectedIncidentLog.slice(0, 8)
  const linkedPlanLocations = getLinkedMapLocationsForPlan(selectedPlan, mapLocations)
  const linkedMapSummary = getLinkedMapSummary(selectedPlan, mapLocations)
  const recommendedPlanId = weakestPlan.plan.id

  return (
    <section className="plans-page">
      <div className="inventory-summary">
        <Metric label="Total plans" value={String(plans.length)} />
        <Metric label="Highest risk" value={weakestPlan.plan.name} />
        <Metric label="Average readiness" value={`${averageReadiness}%`} />
        <Metric label="Active scenario" value={activePlan?.name ?? 'None'} />
      </div>

      <section className="plans-grid">
        <Panel className="plan-list-panel">
          <PanelHeader title="Scenario Plans" subtitle="Select the active emergency procedure" />
          <div className="plan-list">
            {planScores.map(({ plan, readiness }) => {
              const isSelected = plan.id === selectedPlan.id
              const isActive = activeScenario?.planId === plan.id
              const isRecommended = recommendedPlanId === plan.id
              const preparednessLabel = readiness.missing.length > 0 ? 'Needs supplies' : 'Ready'
              return (
                <div
                className={isSelected ? 'plan-list-item active' : 'plan-list-item'}
                key={plan.id}
                onClick={() => onSelectPlan(plan.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectPlan(plan.id)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="plan-card-copy">
                  <span className="plan-card-category">{plan.category}</span>
                  <strong>{plan.name}</strong>
                  <span>{plan.trigger}</span>
                  <div className="plan-state-tags">
                    <span className={isActive ? 'plan-state-tag active' : 'plan-state-tag'}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className={readiness.missing.length > 0 ? 'plan-state-tag needs' : 'plan-state-tag ready'}>
                      {preparednessLabel}
                    </span>
                    {isRecommended && <span className="plan-state-tag recommended">Recommended</span>}
                  </div>
                </div>
                <div className="plan-list-meta">
                  <b>{readiness.preparednessReadiness}%</b>
                  <span className="plan-list-score-label">Preparedness</span>
                  {isActive ? (
                    <>
                      <span className="plan-toggle-button active" aria-label="Active now">
                        Active now
                      </span>
                      <button
                        className="plan-toggle-button muted"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeactivatePlan()
                        }}
                        type="button"
                      >
                        Deactivate
                      </button>
                    </>
                  ) : (
                    <button
                      className="plan-toggle-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onActivatePlan(plan.id)
                      }}
                      type="button"
                    >
                      Activate Plan
                    </button>
                  )}
                  <StatusPill status={getPriorityStatus(plan.priority)} />
                </div>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel className="plan-detail-panel">
          <div className="plan-detail-head">
            <div>
              <span className="plan-category">{selectedPlan.category}</span>
              <h2>{selectedPlan.name}</h2>
              <p>{selectedPlan.summary}</p>
            </div>
            <div className="plan-score">
              <strong>{selectedReadiness.preparednessReadiness}%</strong>
              <span className="plan-score-label">Preparedness</span>
              <StatusPill status={statusFromPercent(selectedReadiness.preparednessReadiness)} />
              {isActivePlan && (
                <span className="plan-score-secondary">
                  Response Progress: {selectedReadiness.responseProgress}%
                </span>
              )}
            </div>
          </div>

          <div className="plan-trigger">
            <strong>Trigger</strong>
            <span>{selectedPlan.trigger}</span>
          </div>

          {linkedPlanLocations.length > 0 && (
            <div className="plan-map-links">
              <strong>Linked map points</strong>
              <div>
                {linkedPlanLocations.map((location) => (
                  <button key={location.id} type="button" onClick={() => onOpenMapLocation(location.id)}>
                    {getMapLocationLabel(location.type)}: {location.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="plan-activation-row">
            {activeScenario?.planId === selectedPlan.id ? (
              <>
                <StatusPill status="GOOD" />
                <span className="plan-activation-label">Active now</span>
                <button type="button" className="muted deactivate-button" onClick={onDeactivatePlan}>
                  Deactivate
                </button>
              </>
            ) : (
              <>
                <button type="button" className="compact-button" onClick={() => onActivatePlan(selectedPlan.id)}>
                  Activate scenario
                </button>
                <span className="plan-activation-help">
                  Use this when the incident is happening and you need checklist guidance.
                </span>
              </>
            )}
          </div>

          <div className="scenario-meter plan-meter">
            <i style={{ width: `${selectedReadiness.preparednessReadiness}%` }} />
          </div>

          {isActivePlan && (
            <div className="active-map-summary">
              <div>
                <strong>Linked map points</strong>
                {linkedMapSummary.total > 0 ? (
                  <span>
                    {linkedMapSummary.total} linked / {linkedMapSummary.hazards} hazards / {linkedMapSummary.practical} rally, shelter, water or medical
                  </span>
                ) : (
                  <span>No map points linked yet. You can link saved map points to tasks while editing this plan.</span>
                )}
              </div>
              <button type="button" disabled={linkedMapSummary.total === 0} onClick={() => onOpenPlanMapPoints(selectedPlan.id)}>
                Open linked points in Maps
              </button>
            </div>
          )}

          <div className="plan-section">
            <h3>Checklist</h3>
            <div className="phase-list">
              {(isActivePlan ? executionPhases : planPhases).map((phase) => {
                const phaseTasks = selectedPlan.tasks.filter((task) =>
                  isActivePlan ? getTaskExecutionPhase(task) === phase : getTaskPlanningPhase(task) === phase,
                )
                if (phaseTasks.length === 0) return null
                return (
                  <div className="phase-group" key={phase}>
                    <h4>{isActivePlan ? String(phase).toUpperCase() : phase}</h4>
                    {phaseTasks.map((task) => {
                      const linkedGap = selectedReadiness.missing.find(
                        (gap) => gap.requirement.id === task.linkedRequirementId,
                      )
                      const linkedMapLocations = getLinkedMapLocationsForTask(task, mapLocations)
                      const hasMissingMapLink = Boolean(task.linkedMapLocationIds?.length && linkedMapLocations.length === 0)
                      const isLinkingTask = linkingTaskId === task.id
                      return (
                        <div className={task.completed ? 'plan-task completed' : 'plan-task'} key={task.id}>
                          <input
                            checked={task.completed}
                            onChange={(event) =>
                              onToggleTask(selectedPlan.id, task.id, event.currentTarget.checked)
                            }
                            type="checkbox"
                          />
                          <span className="plan-task-copy">
                            <strong className="task-title">{task.title}</strong>
                            {task.description && <em className="task-description">{task.description}</em>}
                            {linkedGap && (
                              <em className="task-warning">
                                Linked warning: {linkedGap.requirement.label} is below target
                              </em>
                            )}
                            {linkedMapLocations.length > 0 && (
                              <div className="task-map-links">
                                {linkedMapLocations.map((location) => (
                                  <span className="task-map-chip" key={location.id}>
                                    <span>Map point: {location.name}</span>
                                    <button type="button" onClick={() => onOpenMapLocation(location.id)}>
                                      Open in Maps
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {hasMissingMapLink && (
                              <div className="task-map-links missing">
                                <span>Map point missing</span>
                                <button type="button" onClick={() => onLinkTaskMapPoint(selectedPlan.id, task.id, '')}>
                                  Unlink
                                </button>
                              </div>
                            )}
                          </span>
                          <span className="task-side-controls">
                            <b className={`priority ${task.priority}`}>{task.priority}</b>
                            <span className="task-completion-state">{task.completed ? 'Complete' : 'Pending'}</span>
                            {isLinkingTask || linkedMapLocations.length > 0 || hasMissingMapLink ? (
                              <select
                                aria-label={`Link map point for ${task.title}`}
                                className="task-map-select"
                                value={task.linkedMapLocationIds?.[0] ?? ''}
                                onChange={(event) => {
                                  onLinkTaskMapPoint(selectedPlan.id, task.id, event.currentTarget.value)
                                  setLinkingTaskId(null)
                                }}
                              >
                                <option value="">No map point</option>
                                {mapLocations.map((location) => (
                                  <option key={location.id} value={location.id}>
                                    {location.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button
                                className="task-link-map-toggle"
                                disabled={mapLocations.length === 0}
                                onClick={() => setLinkingTaskId(task.id)}
                                type="button"
                              >
                                {mapLocations.length === 0 ? 'No saved points' : 'Link map point'}
                              </button>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {(isActivePlan || selectedIncidentLog.length > 0) && (
            <div className="plan-section incident-log-section">
              <div className="incident-log-head">
                <div>
                  <h3>Incident Log</h3>
                  <span>
                    {selectedIncidentLog.length} entries / {isActivePlan ? 'stored locally' : 'past activity'}
                  </span>
                </div>
                <div className="incident-log-actions">
                  {isActivePlan && (
                    <button
                      type="button"
                      className="incident-log-toggle"
                      onClick={() => {
                        setIncidentLogExpanded(true)
                        window.setTimeout(() => incidentNoteRef.current?.focus(), 0)
                      }}
                    >
                      Add note
                    </button>
                  )}
                  <button
                    type="button"
                    className="incident-log-toggle"
                    onClick={() => setIncidentLogExpanded((value) => !value)}
                  >
                    {incidentLogExpanded ? 'Collapse' : 'Expand'}
                    <ChevronDown size={14} className={incidentLogExpanded ? 'rotate' : ''} />
                  </button>
                </div>
              </div>
              {incidentLogExpanded && (
                <>
                  {isActivePlan && (
                    <div className="incident-note-row">
                      <input
                        placeholder="Add a short note about what happened..."
                        ref={incidentNoteRef}
                        value={incidentNoteText}
                        onChange={(event) => setIncidentNoteText(event.currentTarget.value)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!incidentNoteText.trim()) return
                          onAddIncidentNote(selectedPlan.id, incidentNoteText)
                          setIncidentNoteText('')
                        }}
                      >
                        Save note
                      </button>
                    </div>
                  )}
                  <div className="incident-log-list">
                    {visibleIncidentLog.length === 0 && (
                      <div className="incident-log-item">
                        <strong>No events recorded</strong>
                      </div>
                    )}
                    {visibleIncidentLog.map((entry) => {
                      const isSystemEntry = entry.type === 'scenario_started' || entry.type === 'scenario_ended'
                      return (
                        <div className={isSystemEntry ? 'incident-log-item muted' : 'incident-log-item'} key={entry.id}>
                          <div>
                            <span className={`incident-type-pill ${entry.type}`}>{formatIncidentLogType(entry.type)}</span>
                            <strong>{entry.message}</strong>
                            <span>{selectedPlan.name}</span>
                          </div>
                          <div className="incident-log-meta">
                            <time>{formatLogTimestamp(entry.timestamp)}</time>
                            <button
                              type="button"
                              className="incident-log-delete"
                              onClick={() => onDeleteIncidentLogEntry(entry.id)}
                              aria-label={`Delete incident log entry: ${entry.message}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="plan-section">
            <h3>Required Supplies</h3>
            <div className="requirement-grid">
              {selectedPlan.requirements.map((requirement) => {
                const gap = selectedReadiness.missing.find((item) => item.requirement.id === requirement.id)
                return (
                  <div className={gap ? 'requirement-card missing' : 'requirement-card'} key={requirement.id}>
                    <strong>{requirement.label}</strong>
                    <span>
                      {gap
                        ? `Need ${gap.deficit}${requirement.unit ? ` ${requirement.unit}` : ''} more`
                        : 'Ready'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {selectedPlan.notes && (
            <div className="plan-notes">
              <strong>Notes</strong>
              <p>{selectedPlan.notes}</p>
            </div>
          )}
        </Panel>

        <div className="plan-rail">
          <Panel>
            <PanelHeader title="Next Action" />
            <div className="primary-action">
              <AlertTriangle size={18} />
              <strong>{primaryAction}</strong>
              <span>Recommended from current inventory and checklist state.</span>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Missing Critical Items" />
            <div className="missing-list">
              {selectedReadiness.missing.length === 0 && (
                <div className="missing-row ready">
                  <strong>Core requirements met</strong>
                  <span>No missing supplies for this plan.</span>
                </div>
              )}
              {selectedReadiness.missing.map((gap) => (
                <div className="missing-row" key={gap.requirement.id}>
                  <div className="missing-row-head">
                    <strong>{gap.requirement.label}</strong>
                    <StatusPill status={gap.deficit >= gap.requiredAmount * 0.5 ? 'CRITICAL' : 'LOW'} />
                  </div>
                  <dl>
                    <div>
                      <dt>Need</dt>
                      <dd>{formatAmount(gap.requiredAmount, gap.requirement.unit)}</dd>
                    </div>
                    <div>
                      <dt>Have</dt>
                      <dd>{formatAmount(gap.currentAmount, gap.requirement.unit)}</dd>
                    </div>
                    <div>
                      <dt>Missing</dt>
                      <dd>{formatAmount(gap.deficit, gap.requirement.unit)}</dd>
                    </div>
                  </dl>
                  <button
                    className="missing-add-button"
                    type="button"
                    onClick={() => onAddMissingItem(gap, selectedPlan.name)}
                  >
                    Add missing item
                  </button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Next Checklist Steps" />
            <div className="next-actions">
              {nextActions.map((task) => {
                const linkedLocation = task.linkedMapLocationIds?.[0]
                  ? mapLocations.find((location) => location.id === task.linkedMapLocationIds?.[0])
                  : undefined
                return (
                  <div className="next-action" key={task.id}>
                    <div className="next-action-head">
                      <span className="next-action-meta">
                        <b className={`priority ${task.priority}`}>{task.priority}</b>
                        <span className="next-action-divider">{'·'}</span>
                        {isActivePlan ? getTaskExecutionPhase(task).toUpperCase() : getTaskPlanningPhase(task)}
                      </span>
                    </div>
                    <strong>{task.title}</strong>
                    {linkedLocation && (
                      <button type="button" className="next-action-map-link" onClick={() => onOpenMapLocation(linkedLocation.id)}>
                        Open in Maps
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Quick Actions" />
            <div className="drawer-actions plan-actions">
              <button
                type="button"
                onClick={() => {
                  const gap = selectedReadiness.missing[0]
                  if (gap) onAddMissingItem(gap, selectedPlan.name)
                }}
              >
                Add missing item
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Print checklist? This does not change plan data.')) onPrint()
                }}
              >
                Print checklist
              </button>
              <button type="button" onClick={onResetSelected}>Reset plan tasks</button>
              <button className="danger-action" type="button" onClick={onResetAll}>Restore demo plans</button>
            </div>
          </Panel>
        </div>
      </section>
    </section>
  )
}

function PlaceholderPage({ page }: { page: Page }) {
  return (
    <Panel>
      <div className="placeholder-page">
        <h2>{page}</h2>
        <p>This section is wired into navigation and ready for the next build pass.</p>
      </div>
    </Panel>
  )
}

function MapsPage({
  form,
  activeScenario,
  locations,
  mapPack,
  mapPackError,
  onAddLocation,
  onChangeForm,
  onClearAll,
  onDeleteLocation,
  onImportMapPack,
  onImportMapPackFromInput,
  onMapPackRenderError,
  onRemoveMapPack,
  onSelectLocation,
  onUseExamples,
  plans,
  selectedLocationId,
  theme,
}: {
  form: MapLocationForm
  activeScenario?: ActiveScenario
  locations: MapLocation[]
  mapPack?: MapPackMetadata
  mapPackError: string
  onAddLocation: (event: FormEvent) => void
  onChangeForm: (form: MapLocationForm) => void
  onClearAll: () => void
  onDeleteLocation: (id: string) => void
  onImportMapPack: () => void
  onImportMapPackFromInput: (file: File | undefined) => void
  onMapPackRenderError: () => void
  onRemoveMapPack: () => void
  onSelectLocation: (id: string) => void
  onUseExamples: () => void
  plans: EmergencyPlan[]
  selectedLocationId: string | null
  theme: ThemeMode
}) {
  const [pointFilter, setPointFilter] = useState<MapPointFilter>('all')
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const locationsRef = useRef(locations)
  const selectedLocationIdRef = useRef(selectedLocationId)
  const mapPackUrlRef = useRef(mapPack?.pmtilesUrl)
  const onMapPackRenderErrorRef = useRef(onMapPackRenderError)
  const activePlan = activeScenario ? plans.find((plan) => plan.id === activeScenario.planId) : undefined
  const relevantLocations = activePlan ? getRelevantMapLocationsForPlan(activePlan, locations) : []
  const activePlanLinkedMapKey = activePlan ? getLinkedMapLocationIdsForPlan(activePlan).join('|') : ''
  const activePlanLinkedMapIds = new Set(activePlanLinkedMapKey ? activePlanLinkedMapKey.split('|') : [])
  const filteredLocations = useMemo(() => filterMapLocations(locations, pointFilter), [locations, pointFilter])
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null
  const visibleLocationCount = filteredLocations.length
  const mapStyle = useMemo(
    () => (mapPack?.pmtilesUrl ? makePmtilesMapStyle(mapPack.pmtilesUrl, theme, mapPack) : makeBlankMapStyle(theme)),
    [mapPack, theme],
  )
  const center = selectedLocation
    ? ([selectedLocation.longitude, selectedLocation.latitude] as [number, number])
    : getMapCenter(locations)

  useEffect(() => {
    locationsRef.current = filteredLocations
    selectedLocationIdRef.current = selectedLocationId
    mapPackUrlRef.current = mapPack?.pmtilesUrl
    onMapPackRenderErrorRef.current = onMapPackRenderError
  }, [filteredLocations, mapPack?.pmtilesUrl, onMapPackRenderError, selectedLocationId])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    registerPmtilesProtocol()
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center,
      zoom: locations.length > 0 ? 11 : 2,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('error', (event) => {
      if (event.error && mapPackUrlRef.current) onMapPackRenderErrorRef.current()
    })
    map.on('load', () => {
      updateMapLocations(map, locationsRef.current, selectedLocationIdRef.current, mapIdSetFromKey(activePlanLinkedMapKey))
      map.on('click', 'saved-locations-hit', (event) => {
        const id = event.features?.[0]?.properties?.id
        if (typeof id === 'string') onSelectLocation(id)
      })
      map.on('mouseenter', 'saved-locations-hit', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'saved-locations-hit', () => {
        map.getCanvas().style.cursor = ''
      })
    })
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setStyle(mapStyle)
    mapRef.current.once('style.load', () => {
      updateMapLocations(mapRef.current, locationsRef.current, selectedLocationIdRef.current, mapIdSetFromKey(activePlanLinkedMapKey))
    })
  }, [activePlanLinkedMapKey, mapStyle])

  useEffect(() => {
    updateMapLocations(mapRef.current, filteredLocations, selectedLocationId, mapIdSetFromKey(activePlanLinkedMapKey))
  }, [activePlanLinkedMapKey, filteredLocations, selectedLocationId])

  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return
    mapRef.current.easeTo({
      center: [selectedLocation.longitude, selectedLocation.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 12),
      duration: 500,
    })
  }, [selectedLocation])

  return (
    <section className="maps-page">
      <Panel className="map-status-panel">
        <PanelHeader title="Operational Map" subtitle="Map points are saved locally. The map background comes from your imported PMTiles file." />
        <div className="map-status-grid">
          <span>MapLibre renders the map. Offline use requires an imported local map pack.</span>
          <span>Backups include saved points and map pack details, not the PMTiles file itself.</span>
          <span>{mapPack ? `Loaded: ${mapPack.fileName}` : 'No map pack loaded'}</span>
          <span>Saved points still work without a background map</span>
          <span>If your browser cannot remember the file, you may need to select it again next time.</span>
        </div>
        <div className="map-pack-card">
          <div>
            <strong>{mapPack ? mapPack.fileName : 'No map pack loaded'}</strong>
            <span>
              {mapPack
                ? `${formatBytes(mapPack.fileSize)} / ${getMapPackPersistenceLabel(mapPack.persistence)}`
                : 'Blank/local-safe mode is active.'}
            </span>
            {mapPack?.persistence === 'needs_reselect' && <em>Select this file again to restore the background map.</em>}
            {mapPackError && <em className="map-pack-error">{mapPackError}</em>}
            {!mapPack?.pmtilesUrl && mapPack && <em>Saved points remain visible on the blank map until the pack is reselected.</em>}
          </div>
          <div>
            <button type="button" className="map-import-button" onClick={onImportMapPack}>
              Import map pack
            </button>
            {mapPack && (
              <button type="button" className="map-import-button map-remove-button" onClick={onRemoveMapPack}>
                Remove map pack
              </button>
            )}
          </div>
        </div>
        <input
          id="map-pack-file-input"
          type="file"
          accept=".pmtiles"
          hidden
          onChange={(event) => {
            onImportMapPackFromInput(event.currentTarget.files?.[0])
            event.currentTarget.value = ''
          }}
        />
      </Panel>

      <Panel className="map-filter-panel">
        <div className="section-title row-title">
          <div>
            <h2>Map Filters</h2>
            <p>Use saved points to answer where to go, what to avoid, and where supplies or help are located.</p>
          </div>
        </div>
        <div className="map-filter-buttons">
          {mapPointFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={pointFilter === filter.id ? 'active' : ''}
              aria-pressed={pointFilter === filter.id}
              onClick={() => setPointFilter(filter.id)}
            >
              {filter.label}
              <span>{filterMapLocations(locations, filter.id).length}</span>
            </button>
          ))}
        </div>
        <div className="map-relevance-card">
          {activePlan ? (
            <>
              <strong>Relevant to active plan: {activePlan.name}</strong>
              {relevantLocations.length > 0 ? (
                <div className="map-relevant-list">
                  {relevantLocations.slice(0, 6).map((location) => (
                    <button key={location.id} type="button" onClick={() => { setPointFilter('all'); onSelectLocation(location.id) }}>
                      <span>{getMapLocationLabel(location.type)}</span>
                      <strong>{location.name}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <span>No saved points match this plan category yet.</span>
              )}
            </>
          ) : (
            <span>No active plan. Saved points are still available for planning.</span>
          )}
        </div>
      </Panel>

      <section className="maps-layout">
        <Panel className="map-panel">
          <div
            className="map-canvas"
            ref={mapContainerRef}
            role="img"
            aria-label={`Operational map showing ${visibleLocationCount} saved point${visibleLocationCount === 1 ? '' : 's'}`}
          />
        </Panel>

        <div className="map-side-panel">
          <Panel>
            <PanelHeader title="Add Location" subtitle="Store practical household map points" />
            <form className="map-location-form" onSubmit={onAddLocation}>
              <label>Name<input value={form.name} placeholder="Home, rally point, water pickup" onChange={(event) => onChangeForm({ ...form, name: event.currentTarget.value })} required /></label>
              <label>Type<select value={form.type} onChange={(event) => onChangeForm({ ...form, type: event.currentTarget.value as MapLocationType })}>{mapLocationTypes.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select></label>
              <div className="form-grid">
                <label>Latitude<input type="number" min="-90" max="90" step="0.000001" value={form.latitude} placeholder="-33.868800" onChange={(event) => onChangeForm({ ...form, latitude: event.currentTarget.value })} required /></label>
                <label>Longitude<input type="number" min="-180" max="180" step="0.000001" value={form.longitude} placeholder="151.209300" onChange={(event) => onChangeForm({ ...form, longitude: event.currentTarget.value })} required /></label>
              </div>
              <label>Notes<textarea rows={3} value={form.notes} placeholder="Access notes, risks, contact details" onChange={(event) => onChangeForm({ ...form, notes: event.currentTarget.value })} /></label>
              <button type="submit" className="drawer-primary">Save location</button>
            </form>
          </Panel>

          <Panel>
            <div className="section-title row-title">
              <h2>Saved Points <span>{locations.length}</span></h2>
              <button type="button" onClick={onUseExamples}>Add demo points</button>
            </div>
            {locations.length === 0 ? (
              <div className="empty-state compact-empty">
                <strong>No saved points</strong>
                <span>Add home, rally, water, medical, fuel, shelter, hazard or communications points.</span>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="empty-state compact-empty">
                <strong>No points match this filter</strong>
                <span>Switch to All or add a saved point for this category.</span>
              </div>
            ) : (
              <div className="map-location-list">
                {filteredLocations.map((location) => (
                  <MapLocationRow
                    key={location.id}
                    linkedToActivePlan={activePlanLinkedMapIds.has(location.id)}
                    location={location}
                    onCopy={() => copyCoordinates(location)}
                    onDelete={() => onDeleteLocation(location.id)}
                    onSelect={() => onSelectLocation(location.id)}
                    selected={location.id === selectedLocationId}
                  />
                ))}
              </div>
            )}
            {locations.length > 0 && (
              <button type="button" className="compact-button muted map-clear-button" onClick={onClearAll}>
                Clear all saved points
              </button>
            )}
          </Panel>
        </div>
      </section>
    </section>
  )
}

function MapLocationRow({
  linkedToActivePlan,
  location,
  onCopy,
  onDelete,
  onSelect,
  selected,
}: {
  linkedToActivePlan: boolean
  location: MapLocation
  onCopy: () => void
  onDelete: () => void
  onSelect: () => void
  selected: boolean
}) {
  return (
    <div className={selected ? 'map-location-row active' : 'map-location-row'}>
      <button type="button" onClick={onSelect}>
        {renderMapLocationIcon(location.type)}
        <span>
          <strong>{location.name}</strong>
          <em>{getMapLocationLabel(location.type)} / {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</em>
          {linkedToActivePlan && <small className="map-linked-note">Linked to active plan</small>}
          {location.notes && <small>{location.notes}</small>}
        </span>
      </button>
      <div>
        <button type="button" onClick={onCopy}>Copy coordinates</button>
        <button type="button" className="map-delete-button" onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

function DocumentsPage({
  documents,
  onAddDocuments,
  onDeleteDocument,
  onSelectDocument,
  onUpdateDocumentTag,
  selectedDocumentId,
}: {
  documents: StoredDocument[]
  onAddDocuments: (files: FileList | File[], tag: StoredDocumentTag) => Promise<void>
  onDeleteDocument: (id: string) => void
  onSelectDocument: (id: string | null) => void
  onUpdateDocumentTag: (id: string, tag: StoredDocumentTag) => void
  selectedDocumentId: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [tag, setTag] = useState<StoredDocumentTag>('other')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? null
  const pendingDeleteDocument = documents.find((document) => document.id === pendingDeleteId) ?? null

  return (
    <section className="documents-page">
      <Panel className="documents-toolbar">
        <div>
          <PanelHeader title="Documents" subtitle="Household files stored locally on this device/browser" />
          <p>Use this for insurance PDFs, ID scans, medication lists, emergency contacts, pet records, property documents, checklists, screenshots and TXT notes.</p>
          <p className="document-backup-note">Backups include document details, not original files. Keep your own copy of important documents.</p>
        </div>
        <div className="document-upload-controls">
          <select value={tag} onChange={(event) => setTag(event.currentTarget.value as StoredDocumentTag)}>
            <option value="ID">ID</option>
            <option value="medical">Medical</option>
            <option value="insurance">Insurance</option>
            <option value="other">Other</option>
          </select>
          <button type="button" onClick={() => inputRef.current?.click()}>
            <Upload size={16} /> Upload files
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,text/plain,.txt,.pdf,.jpg,.jpeg,.png"
            multiple
            hidden
            onChange={(event) => {
              if (event.currentTarget.files) {
                onAddDocuments(event.currentTarget.files, tag).catch(() => undefined)
              }
              event.currentTarget.value = ''
            }}
          />
        </div>
      </Panel>

      <section className="documents-layout">
        <Panel className="document-list-panel">
          {documents.length === 0 ? (
            <div className="empty-state">
              <strong>No household documents saved yet.</strong>
              <span>Add local copies of household emergency files for quick access on this device/browser.</span>
              <button type="button" className="compact-button" onClick={() => inputRef.current?.click()}>
                Upload files
              </button>
            </div>
          ) : (
            <div className="document-list">
              {documents.map((document) => {
                const Icon = getDocumentIcon(document.kind)
                return (
                  <button
                    type="button"
                    className={document.id === selectedDocumentId ? 'document-row active' : 'document-row'}
                    key={document.id}
                    onClick={() => onSelectDocument(document.id)}
                  >
                    <Icon size={18} />
                    <span>
                      <strong>{document.name}</strong>
                      <em>{document.kind.toUpperCase()} / {formatBytes(document.size)} / Added {formatShortDate(document.createdAt)}</em>
                    </span>
                    <b>{document.tag}</b>
                  </button>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel className="document-viewer-panel">
          {selectedDocument ? (
            <>
              <div className="document-viewer-head">
                <div>
                  <span>{selectedDocument.tag}</span>
                  <h2>{selectedDocument.name}</h2>
                </div>
                <div>
                  <button type="button" className="compact-button muted" onClick={() => onSelectDocument(null)}>Close</button>
                  <select
                    className="document-tag-editor"
                    value={selectedDocument.tag}
                    onChange={(event) => onUpdateDocumentTag(selectedDocument.id, event.currentTarget.value as StoredDocumentTag)}
                  >
                    <option value="ID">ID</option>
                    <option value="medical">Medical</option>
                    <option value="insurance">Insurance</option>
                    <option value="other">Other</option>
                  </select>
                  <button type="button" className="drawer-danger compact-danger" onClick={() => setPendingDeleteId(selectedDocument.id)}>
                    <Trash2 size={15} /> Delete
                  </button>
                </div>
              </div>
              <DocumentViewer document={selectedDocument} />
            </>
          ) : (
            <div className="empty-state">
          <strong>Select a document</strong>
          <span>Open a household file without leaving the readiness workspace. Files stay local to this device/browser.</span>
          <span>Backups restore document details only, not original files.</span>
        </div>
          )}
        </Panel>
      </section>
      {pendingDeleteDocument && (
        <div className="confirm-popover-backdrop" role="presentation" onClick={() => setPendingDeleteId(null)}>
          <div className="confirm-popover" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <span>Confirm delete</span>
            <strong>{pendingDeleteDocument.name}</strong>
            <p>This removes the locally stored copy from Survival OS. It does not delete any separate copy you keep elsewhere.</p>
            <div>
              <button type="button" className="compact-button muted" onClick={() => setPendingDeleteId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="drawer-danger compact-danger"
                onClick={() => {
                  onDeleteDocument(pendingDeleteDocument.id)
                  setPendingDeleteId(null)
                }}
              >
                <Trash2 size={15} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function DocumentViewer({ document }: { document: StoredDocument }) {
  if (document.kind === 'pdf') {
    return (
      <div className="document-pdf-shell">
        <iframe className="document-frame" src={document.dataUrl} title={document.name} />
      </div>
    )
  }
  if (document.kind === 'image') {
    return (
      <div className="document-image-viewer">
        <img src={document.dataUrl} alt={document.name} />
      </div>
    )
  }
  return <pre className="document-text-viewer">{document.textContent ?? ''}</pre>
}

function KnowledgePage({
  documents,
  onAddResource,
  onDeleteResource,
  onOpenDocument,
  resources,
}: {
  documents: StoredDocument[]
  onAddResource: (resource: Omit<KnowledgeResource, 'id' | 'createdAt' | 'updatedAt'>) => void
  onDeleteResource: (id: string) => void
  onOpenDocument: (id: string) => void
  resources: KnowledgeResource[]
}) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(knowledgeCategories[0])
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>('note')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [documentId, setDocumentId] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    onAddResource({
      title: trimmedTitle,
      category,
      sourceType,
      description: description.trim() || undefined,
      url: sourceType === 'link' ? url.trim() || undefined : undefined,
      documentId: sourceType === 'document' ? documentId || undefined : undefined,
    })
    setTitle('')
    setDescription('')
    setUrl('')
    setDocumentId('')
    setSourceType('note')
    setCategory(knowledgeCategories[0])
  }

  return (
    <section className="knowledge-page">
      <Panel className="knowledge-intro">
        <div>
          <PanelHeader title="Knowledge" subtitle="General preparedness reference material" />
          <p>Knowledge is for general reference material. Use Documents for your household files.</p>
          <p>Save first aid guides, water purification notes, food storage references, power outage guides, communications guides, sanitation references and local emergency info.</p>
          <p>Knowledge resources are backed up. Linked document files may need to be restored separately.</p>
          <p className="document-backup-note">Offline packs, full-text search, and AI-assisted lookup can be added later.</p>
        </div>
      </Panel>

      <div className="knowledge-layout">
        <Panel className="knowledge-form-panel">
          <PanelHeader title="Add Reference" subtitle="Saved locally on this device/browser" />
          <form className="knowledge-form" onSubmit={submit}>
            <label>
              Title
              <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="Water purification field notes" />
            </label>
            <div className="knowledge-form-grid">
              <label>
                Category
                <select value={category} onChange={(event) => setCategory(event.currentTarget.value)}>
                  {knowledgeCategories.map((entry) => <option key={entry}>{entry}</option>)}
                </select>
              </label>
              <label>
                Source type
                <select value={sourceType} onChange={(event) => setSourceType(event.currentTarget.value as KnowledgeSourceType)}>
                  <option value="note">Note</option>
                  <option value="link">Link</option>
                  <option value="document">Document</option>
                </select>
              </label>
            </div>
            {sourceType === 'link' && (
              <label>
                URL
                <input value={url} onChange={(event) => setUrl(event.currentTarget.value)} placeholder="https://example.org/reference" />
              </label>
            )}
            {sourceType === 'document' && (
              <label>
                Linked document
                <select value={documentId} onChange={(event) => setDocumentId(event.currentTarget.value)}>
                  <option value="">No document linked</option>
                  {documents.map((document) => (
                    <option value={document.id} key={document.id}>{document.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Description
              <textarea value={description} onChange={(event) => setDescription(event.currentTarget.value)} placeholder="Short notes, source context, or what this helps with." />
            </label>
            <button type="submit" className="drawer-primary">Save reference</button>
          </form>
        </Panel>

        <Panel className="knowledge-list-panel">
          {resources.length === 0 ? (
            <div className="empty-state">
              <strong>No reference material saved yet.</strong>
              <span>Use Knowledge for general reference material. Use Documents for your household files.</span>
            </div>
          ) : (
            <div className="knowledge-groups">
              {knowledgeCategories
                .map((entry) => ({
                  category: entry,
                  resources: resources.filter((resource) => resource.category === entry),
                }))
                .filter((group) => group.resources.length > 0)
                .map((group) => (
                  <section className="knowledge-category" key={group.category}>
                    <h2>{group.category} <span>{group.resources.length}</span></h2>
                    <div className="knowledge-card-grid">
                      {group.resources.map((resource) => (
                        <KnowledgeCard
                          documents={documents}
                          key={resource.id}
                          onDelete={() => onDeleteResource(resource.id)}
                          onOpenDocument={onOpenDocument}
                          resource={resource}
                        />
                      ))}
                    </div>
                  </section>
                ))}
            </div>
          )}
        </Panel>
      </div>
    </section>
  )
}

function KnowledgeCard({
  documents,
  onDelete,
  onOpenDocument,
  resource,
}: {
  documents: StoredDocument[]
  onDelete: () => void
  onOpenDocument: (id: string) => void
  resource: KnowledgeResource
}) {
  const linkedDocument = resource.documentId ? documents.find((document) => document.id === resource.documentId) : undefined
  const safeUrl = resource.url ? getSafeKnowledgeUrl(resource.url) : ''

  return (
    <article className="knowledge-card">
      <div className="knowledge-card-head">
        <span>{formatKnowledgeSourceType(resource.sourceType)}</span>
        <em>Added {formatShortDate(resource.createdAt)}</em>
      </div>
      <h3>{resource.title}</h3>
      {resource.description && <p>{resource.description}</p>}
      {resource.sourceType === 'document' && (
        linkedDocument ? (
          <>
            <span className="knowledge-source-detail">Linked document: {linkedDocument.name}</span>
            <button type="button" className="compact-button" onClick={() => onOpenDocument(linkedDocument.id)}>
              <FileText size={15} /> Open document
            </button>
          </>
        ) : (
          <strong className="knowledge-missing">Linked document missing.</strong>
        )
      )}
      {resource.sourceType === 'link' && (
        safeUrl ? (
          <>
            <span className="knowledge-source-detail">{safeUrl}</span>
            <a className="compact-button knowledge-link" href={safeUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} /> Open URL
            </a>
          </>
        ) : (
          <span className="knowledge-muted">{resource.url ? 'Saved URL is not a valid http(s) link.' : 'No URL saved.'}</span>
        )
      )}
      <button type="button" className="compact-button muted" onClick={onDelete}>
        <Trash2 size={15} /> Delete
      </button>
    </article>
  )
}

function SettingsPage({
  activeScenario,
  ignoredDuplicateGroups,
  incidentLog,
  items,
  knowledgeResources,
  lastBackupAt,
  mapLocations,
  mapPackMetadata,
  documentMetadata,
  onBackupCreated,
  onImport,
  onReset,
  plans,
  settings,
  setSettings,
  summary,
}: {
  activeScenario?: ActiveScenario
  ignoredDuplicateGroups: IgnoredDuplicateGroup[]
  incidentLog: IncidentLogEntry[]
  items: InventoryItem[]
  knowledgeResources: KnowledgeResource[]
  lastBackupAt: string
  mapLocations: MapLocation[]
  mapPackMetadata?: MapPackMetadata
  documentMetadata: ReturnType<typeof toDocumentMetadata>[]
  onBackupCreated: (timestamp: string) => void
  onImport: (payload: ReturnType<typeof parseBackupPayload>) => void
  onReset: () => void
  plans: EmergencyPlan[]
  settings: AppSettings
  setSettings: (settings: AppSettings) => void
  summary: ReturnType<typeof getResourceSummary>
}) {
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState('')
  const targetDays = settings.targetBufferDays ?? 7
  const waterTarget = settings.householdPeople * settings.waterLitresPerPersonPerDay * targetDays
  const foodTarget = settings.householdPeople * settings.caloriesPerPersonPerDay * targetDays
  const fuelTarget = settings.fuelLitresPerDay * targetDays

  function updateNumber(key: keyof AppSettings, value: string) {
    setSettings(clampSettings({ ...settings, [key]: Number(value) }))
  }

  function exportData() {
    const payload = createBackupPayload({
      activeScenario,
      ignoredDuplicateGroups,
      incidentLog,
      items,
      knowledgeResources,
      mapLocations,
      mapPackMetadata,
      documentMetadata,
      plans,
      settings,
    })
    downloadBackup(payload)
    onBackupCreated(payload.exportedAt)
  }

  async function importData(file?: File) {
    if (!file) return
    try {
      const parsed = parseBackupPayload(JSON.parse(await file.text()))
      onImport(parsed)
      setImportError('')
    } catch {
      setImportError('Import failed. The file was not valid JSON.')
    }
  }

  return (
    <section className="settings-page">
      <div className="inventory-summary">
        <Metric label="People" value={String(settings.householdPeople)} />
        <Metric label="Target buffer" value={`${targetDays} days`} />
        <Metric label="Water target" value={`${Math.ceil(waterTarget)} L`} />
        <Metric label="Food target" value={`${Math.ceil(foodTarget).toLocaleString()} kcal`} />
      </div>

      <div className="settings-grid">
        <div className="settings-column">
          <Panel className="settings-card">
            <PanelHeader title="Household Assumptions" subtitle="Used for daily survival demand" />
            <div className="settings-form">
              <SettingNumber label="Household people" value={settings.householdPeople} onChange={(value) => updateNumber('householdPeople', value)} />
              <SettingNumber label="Children / infants" value={settings.childrenCount ?? 0} onChange={(value) => updateNumber('childrenCount', value)} />
              <SettingNumber label="Pets" value={settings.petsCount ?? 0} onChange={(value) => updateNumber('petsCount', value)} />
              <label>
                Region
                <select value={settings.region} onChange={(event) => setSettings({ ...settings, region: event.currentTarget.value as AppSettings['region'] })}>
                  <option value="AU_NSW">Australia / NSW</option>
                  <option value="US">United States</option>
                </select>
              </label>
            </div>
          </Panel>

          <Panel className="settings-card">
            <PanelHeader title="Status Thresholds" subtitle="Resource status bands for dashboard cards" />
            <div className="settings-form threshold-grid">
              <SettingNumber label="Critical below days" value={settings.criticalBelowDays ?? 3} onChange={(value) => updateNumber('criticalBelowDays', value)} step="0.5" />
              <SettingNumber label="Low below days" value={settings.lowBelowDays ?? 7} onChange={(value) => updateNumber('lowBelowDays', value)} step="0.5" />
              <SettingNumber label="Watch below days" value={settings.watchBelowDays ?? 14} onChange={(value) => updateNumber('watchBelowDays', value)} step="0.5" />
              <SettingNumber label="Good above days" value={settings.goodAboveDays ?? 14} onChange={(value) => updateNumber('goodAboveDays', value)} step="0.5" />
            </div>
            <div className="settings-readout">
              <span>Current water: {formatDays(summary.waterDays)} days</span>
              <span>Fuel buffer target: {Math.ceil(fuelTarget)} L</span>
            </div>
          </Panel>

          <Panel className="settings-card privacy-card">
            <PanelHeader title="Local-first Storage" />
            <p>No account. No cloud sync. Data stays on this device unless you export it.</p>
            <p>If browser storage is cleared, local app data and uploaded document files may be removed.</p>
            <div className="privacy-stats">
              <span>{items.length} inventory items</span>
              <span>{plans.length} plans</span>
              <span>{summary.medicalExpiringCount} medical expiry warnings</span>
            </div>
          </Panel>
        </div>

        <div className="settings-column">
          <Panel className="settings-card">
            <PanelHeader title="Consumption Assumptions" subtitle="Dashboard days and alerts update immediately" />
            <div className="settings-form">
              <SettingNumber label="Calories per person / day" value={settings.caloriesPerPersonPerDay} onChange={(value) => updateNumber('caloriesPerPersonPerDay', value)} />
              <p className="settings-helper">Food: kcal per person per day.</p>
              <SettingNumber label="Water litres per person / day" value={settings.waterLitresPerPersonPerDay} onChange={(value) => updateNumber('waterLitresPerPersonPerDay', value)} step="0.1" />
              <p className="settings-helper">Water: litres per person per day.</p>
              <SettingNumber label="Fuel litres per day" value={settings.fuelLitresPerDay} onChange={(value) => updateNumber('fuelLitresPerDay', value)} step="0.1" />
              <p className="settings-helper">Fuel: litres per day or equivalent.</p>
              <SettingNumber label="Target readiness buffer days" value={settings.targetBufferDays} onChange={(value) => updateNumber('targetBufferDays', value)} />
            </div>
            <div className="settings-readout">
              <span>Daily water: {Math.ceil(settings.householdPeople * settings.waterLitresPerPersonPerDay)} L</span>
              <span>Daily food: {(settings.householdPeople * settings.caloriesPerPersonPerDay).toLocaleString()} kcal</span>
              <span>Target fuel: {Math.ceil(fuelTarget)} L</span>
            </div>
          </Panel>

          <Panel className="settings-card">
            <PanelHeader title="Data Management" subtitle="Single local backup for supplies, plans, maps, documents metadata and knowledge" />
            <div className="data-actions">
              <button type="button" onClick={exportData}><Database size={16} /> Export local data</button>
              <button type="button" onClick={() => importInputRef.current?.click()}><Upload size={16} /> Import JSON</button>
              <button type="button" className="danger-action" onClick={onReset}><RotateCcw size={16} /> Restore Demo State</button>
            </div>
            <div className="settings-readout">
              <span>Last backup: {lastBackupAt ? formatLogTimestamp(lastBackupAt) : 'Never'}</span>
            </div>
            <div className="backup-clarity-grid">
              <div>
                <strong>What backups include</strong>
                <ul>
                  <li>Inventory</li>
                  <li>Plans and checklist progress</li>
                  <li>Active scenario</li>
                  <li>Incident log</li>
                  <li>Settings</li>
                  <li>Saved map points</li>
                  <li>Knowledge resources</li>
                  <li>Document details</li>
                </ul>
              </div>
              <div>
                <strong>What backups do not include</strong>
                <ul>
                  <li>Original uploaded document files</li>
                  <li>Imported PMTiles map pack files</li>
                  <li>Browser file permissions/handles</li>
                </ul>
              </div>
            </div>
            {importError && <p className="settings-error">{importError}</p>}
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                importData(event.currentTarget.files?.[0]).catch(() => setImportError('Import failed.'))
                event.currentTarget.value = ''
              }}
            />
          </Panel>
        </div>
      </div>
    </section>
  )
}

function SettingNumber({
  label,
  onChange,
  step = '1',
  value,
}: {
  label: string
  onChange: (value: string) => void
  step?: string
  value: number
}) {
  return (
    <label>
      {label}
      <input type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  )
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>
}

function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

function ResourceCard({ resource }: { resource: ResourceCardData }) {
  return (
    <article className={`resource-card ${resource.status.toLowerCase()}`}>
      <div className="resource-top">
        <ResourceIcon type={resource.icon} />
        <strong>{resource.name}</strong>
        <button type="button" aria-label={`${resource.name} details`}>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="resource-body">
        <div>
          <h2 style={{ color: resource.color }}>{resource.valueLabel}</h2>
          <p>{resource.stored}</p>
          <StatusPill status={resource.status} />
        </div>
        <MiniChart points={resource.trend} color={resource.color} />
      </div>
    </article>
  )
}

function ActionQueue({
  actions,
  onAction,
}: {
  actions: DashboardAction[]
  onAction: (action: DashboardAction) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const primaryAction = actions[0]
  const secondaryActions = expanded ? actions.slice(1) : actions.slice(1, 3)
  return (
    <Panel className="action-queue-panel">
      <div className="section-title row-title">
        <div>
          <h2>Today's Priorities</h2>
          <p>Deterministic actions from supplies, plans, expiry and checklist state</p>
        </div>
        {actions.length > 3 && (
          <button type="button" onClick={() => setExpanded((current) => !current)}>
            {expanded ? 'Show less' : `Show ${actions.length - 3} more`}
          </button>
        )}
      </div>
      {primaryAction ? (
        <>
          <div className={`priority-action primary-action-card ${primaryAction.priority}`}>
            <div>
              <span>DO THIS NOW</span>
              <small>{getActionTypeLabel(primaryAction)}</small>
              <strong>{primaryAction.title}</strong>
              <em>{primaryAction.reason}</em>
            </div>
            <b className={`priority ${primaryAction.priority}`}>{primaryAction.priority}</b>
            <button type="button" onClick={() => onAction(primaryAction)}>
              {getActionButtonLabel(primaryAction)}
            </button>
          </div>
          {secondaryActions.length > 0 && (
            <div className="action-queue">
              {secondaryActions.map((action) => (
                <div className={`priority-action ${action.priority}`} key={action.id}>
                  <div>
                    <span>{getActionTypeLabel(action)}</span>
                    <strong>{action.title}</strong>
                    <em>{action.reason}</em>
                  </div>
                  <b className={`priority ${action.priority}`}>{action.priority}</b>
                  <button type="button" onClick={() => onAction(action)}>
                    {getActionButtonLabel(action)}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="priority-action">
          <div>
            <span>CLEAR</span>
            <strong>No urgent actions</strong>
            <em>Current inventory and active plan have no immediate priority gaps.</em>
          </div>
        </div>
      )}
    </Panel>
  )
}

function getActionTypeLabel(action: DashboardAction) {
  if (action.fromActiveScenario) return 'ACTIVE SCENARIO'
  return action.source.toUpperCase()
}

function getActionButtonLabel(action: DashboardAction) {
  if (action.source === 'task') return 'Mark done'
  if (action.source === 'expiry') return 'View inventory'
  return 'Add item'
}

function makeDrawerAlerts(alerts: DashboardAlert[], actions: DashboardAction[]) {
  const criticalAlerts = alerts.map((alert) => ({
    id: `alert-${alert.id}`,
    priority: alert.severity,
    title: alert.title,
    subtext: alert.action,
  }))
  const actionAlerts = actions
    .filter((action) => action.source === 'plan' || action.source === 'resource' || action.source === 'expiry')
    .map((action) => ({
      id: `action-${action.id}`,
      priority: action.priority,
      title: action.title,
      subtext: action.reason,
    }))
  return uniqueDrawerAlerts([...criticalAlerts, ...actionAlerts])
}

function uniqueDrawerAlerts<T extends { title: string; subtext: string }>(alerts: T[]) {
  const seen = new Set<string>()
  return alerts.filter((alert) => {
    const key = `${alert.title}|${alert.subtext}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function downloadBackup(payload: ReturnType<typeof createBackupPayload>) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `survival-os-backup-${payload.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function toDocumentMetadata(document: StoredDocument) {
  return {
    id: document.id,
    name: document.name,
    mimeType: document.mimeType,
    kind: document.kind,
    tag: document.tag,
    size: document.size,
    createdAt: document.createdAt,
  }
}

function getImportResultMessage(payload: ReturnType<typeof parseBackupPayload>) {
  const parts = ['Local data imported.']
  if ((payload.documentMetadata?.length ?? 0) > 0) {
    parts.push('Document details were restored. Original document files were not included in the backup.')
  }
  if ((payload.mapLocations?.length ?? 0) > 0) parts.push('Your saved points were restored.')
  if ((payload.knowledgeResources?.length ?? 0) > 0) parts.push('Your knowledge references were restored.')
  if (payload.mapPackMetadata) {
    parts.push('Map pack details were restored. Select the PMTiles file again to restore the map background.')
  }
  if (hasMissingMapPointLinks(payload.plans ?? [], payload.mapLocations ?? [])) {
    parts.push('Plan links to missing map points were kept but marked as missing.')
  }
  if (hasMissingKnowledgeDocumentLinks(payload.knowledgeResources ?? [], payload.documentMetadata ?? [])) {
    parts.push('Knowledge links to missing documents were kept but marked as missing.')
  }
  return parts.join(' ')
}

function hasMissingMapPointLinks(plans: EmergencyPlan[], mapLocations: MapLocation[]) {
  const mapIds = new Set(mapLocations.map((location) => location.id))
  return plans.some((plan) => getLinkedMapLocationIdsForPlan(plan).some((id) => !mapIds.has(id)))
}

function hasMissingKnowledgeDocumentLinks(resources: KnowledgeResource[], documents: ReturnType<typeof toDocumentMetadata>[]) {
  const documentIds = new Set(documents.map((document) => document.id))
  return resources.some((resource) => resource.sourceType === 'document' && resource.documentId && !documentIds.has(resource.documentId))
}

function formatKnowledgeSourceType(sourceType: KnowledgeSourceType) {
  if (sourceType === 'note') return 'Note'
  if (sourceType === 'link') return 'Link'
  return 'Document'
}

function getSafeKnowledgeUrl(url: string) {
  try {
    const trimmed = url.trim()
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function ResourceTimeline({ resources }: { resources: ReturnType<typeof getDepletionSeries> }) {
  const width = 760
  const height = 166
  const padding = { top: 12, right: 30, bottom: 28, left: 54 }
  const maxDays = Math.max(35, ...resources.map((resource) => resource.days))
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const yTicks = [30, 20, 10, 0]
  const xTicks = [0, 7, 14, 21, 28, 35]

  function x(day: number) {
    return padding.left + (Math.min(day, maxDays) / maxDays) * chartWidth
  }

  function y(value: number) {
    return padding.top + (1 - value / 30) * chartHeight
  }

  function pathFor(days: number) {
    const safeDays = Math.max(0.1, days)
    return [
      `M ${x(0)} ${y(27)}`,
      `L ${x(safeDays / 2)} ${y(13.5)}`,
      `L ${x(safeDays)} ${y(0)}`,
      `L ${x(maxDays)} ${y(0)}`,
    ].join(' ')
  }

  return (
    <div className="timeline-wrap">
      <div className="legend">
        {resources.map((resource) => (
          <span key={resource.id}>
            <i style={{ background: resource.color }} />
            {resource.name}
          </span>
        ))}
      </div>
      <svg className="timeline-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
            <text x={14} y={y(tick) + 4}>{tick} days</text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={tick}>
            <line className="vertical" x1={x(tick)} x2={x(tick)} y1={padding.top} y2={height - padding.bottom} />
            <text x={x(tick) - 18} y={height - 8}>{tick === 0 ? 'Today' : `${tick} days`}</text>
          </g>
        ))}
        {resources.map((resource, index) => {
          const labelX = x(resource.days) - (index === 0 ? 74 : 20)
          return (
            <g key={resource.id}>
              <path className="resource-line" d={pathFor(resource.days)} stroke={resource.color} />
              <circle cx={x(resource.days)} cy={y(0)} r="5" fill={resource.color} />
              <text className="failure-label" x={labelX} y={y(0) - 18} fill={resource.color}>
                {formatDays(resource.days)} days
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function MiniChart({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const width = 112
  const height = 58
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((point - min) / Math.max(1, max - min)) * (height - 8) - 4
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <svg className="mini-chart" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill={color} opacity="0.14" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  )
}

function ReadinessRow({ item }: { item: ReturnType<typeof makeReadiness> }) {
  return (
    <div className="readiness-row">
      <ResourceIcon type={item.icon} />
      <span>{item.label}</span>
      <div className="track">
        <i style={{ width: `${item.value}%` }} />
      </div>
      <strong>{item.value}%</strong>
      <StatusPill status={item.status} />
    </div>
  )
}

function AlertRow({ alert }: { alert: DashboardAlert }) {
  return (
    <div className="alert-row">
      <ResourceIcon type={alert.category === 'fuel' ? 'fuel' : alert.category === 'medical' ? 'medical' : alert.category === 'food' ? 'food' : 'water'} />
      <div>
        <strong>{alert.title}</strong>
        <span>{alert.action}</span>
      </div>
      <time>{alert.age}</time>
    </div>
  )
}

function ActionButton({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" className="action-button" onClick={onClick}>
      {icon}
      <span>
        <strong>{title}</strong>
        <em>{text}</em>
      </span>
    </button>
  )
}

function Drawer({
  aliases,
  alerts,
  actions,
  depletionSeries,
  form,
  kind,
  nextFailure,
  pendingPlanItem,
  onClose,
  onDelete,
  onFormChange,
  onSaveItem,
}: {
  aliases: UserInventoryAlias[]
  alerts: DashboardAlert[]
  actions: DashboardAction[]
  depletionSeries: ReturnType<typeof getDepletionSeries>
  form: ItemForm
  kind: Exclude<DrawerKind, null>
  nextFailure: { name: string; days: number }
  pendingPlanItem: PendingPlanItem | null
  onClose: () => void
  onDelete: () => void
  onFormChange: (form: ItemForm) => void
  onSaveItem: (event: FormEvent) => void
}) {
  const catalogMatch = getCatalogItemById(form.catalogItemId) ?? findBestCatalogMatch(form.name)
  const catalogMatches = findCatalogMatches(form.name).slice(0, 5)
  const normalizedFormName = normalizeSupplyName(form.name)
  const aliasMatches = aliases
    .filter((alias) => normalizedFormName && alias.normalizedText.includes(normalizedFormName) && alias.text !== form.name)
    .slice(0, 4)

  if (kind === 'item') {
    return (
      <div className="drawer-backdrop" role="presentation" onClick={onClose}>
        <aside className="drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
          <div className="drawer-head">
            <div>
              <span>Inventory item</span>
              <h2>{form.id ? 'Edit Supply' : 'Add Supply'}</h2>
            </div>
            <button type="button" onClick={onClose}>Close</button>
          </div>
          <form className="item-drawer-form" onSubmit={onSaveItem}>
            {pendingPlanItem && (
              <div className="source-note">
                <strong>Adding item from {pendingPlanItem.planName} plan</strong>
                <span>This will improve readiness once saved.</span>
              </div>
            )}
            <label>Name *<input value={form.name} placeholder="Drinking water, rice, power bank" onChange={(event) => {
              const name = event.currentTarget.value
              const match = findBestCatalogMatch(name)
              onFormChange(match ? applyCatalogToForm({ ...form, name }, match, false) : { ...form, name, catalogItemId: '' })
            }} required /></label>
            <div className="catalog-status">
              {catalogMatch ? (
                <span>Matched as: {catalogMatch.canonicalName}</span>
              ) : (
                <span>Custom item. It will be saved to your suggestions, but may not satisfy plan requirements unless matched to a known supply type.</span>
              )}
            </div>
            {(catalogMatches.length > 0 || aliasMatches.length > 0) && (
              <div className="autocomplete-panel">
                {catalogMatches.length > 0 && (
                  <div>
                    <strong>Catalog matches</strong>
                    {catalogMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onFormChange(applyCatalogToForm(form, item, true))}
                      >
                        {item.canonicalName}
                      </button>
                    ))}
                  </div>
                )}
                {aliasMatches.length > 0 && (
                  <div>
                    <strong>Your previous entries</strong>
                    {aliasMatches.map((alias) => (
                      <button
                        key={alias.id}
                        type="button"
                        onClick={() => onFormChange(applyAliasToForm(form, alias))}
                      >
                        {alias.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="form-grid">
              <label>Quantity *<input type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => onFormChange({ ...form, quantity: event.currentTarget.value })} required /></label>
              <label>Unit *<input value={form.unit} placeholder="L, kg, pack, unit" onChange={(event) => onFormChange({ ...form, unit: event.currentTarget.value })} required /></label>
            </div>
            <label>Expiry<input type="date" value={form.expiryDate} onChange={(event) => onFormChange({ ...form, expiryDate: event.currentTarget.value })} /></label>
            <label>Location<input value={form.location} placeholder="Pantry, garage, go bag" onChange={(event) => onFormChange({ ...form, location: event.currentTarget.value })} /></label>
            <label>Notes<textarea rows={4} value={form.notes} placeholder="Storage notes, rotation notes, pack size, or condition" onChange={(event) => onFormChange({ ...form, notes: event.currentTarget.value })} /></label>
            <details className="advanced-details">
              <summary>Advanced details</summary>
              <label>Category<select value={form.category} onChange={(event) => onFormChange({ ...form, category: event.currentTarget.value as InventoryCategory })}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
              <p className="unit-helper">{getInventoryUnitHint(form.category)}</p>
              <label>Match to catalog item<select value={form.catalogItemId} onChange={(event) => {
                const item = getCatalogItemById(event.currentTarget.value)
                onFormChange(item ? applyCatalogToForm(form, item, false) : { ...form, catalogItemId: '' })
              }}>
                <option value="">No catalog match</option>
                {supplyCatalog.map((item) => <option key={item.id} value={item.id}>{item.canonicalName}</option>)}
              </select></label>
              <div className="form-grid">
                <label>Calories / unit<input type="number" value={form.caloriesPerUnit} onChange={(event) => onFormChange({ ...form, caloriesPerUnit: event.currentTarget.value })} /></label>
                <label>Litres / unit<input type="number" step="0.01" value={form.litresPerUnit} onChange={(event) => onFormChange({ ...form, litresPerUnit: event.currentTarget.value })} /></label>
              </div>
              <label>Minimum<input type="number" step="0.01" value={form.minThreshold} onChange={(event) => onFormChange({ ...form, minThreshold: event.currentTarget.value })} /></label>
            </details>
            <button type="submit" className="drawer-primary">Save item</button>
            {form.id && <button type="button" className="drawer-danger" onClick={onDelete}><Trash2 size={16} /> Delete item</button>}
          </form>
        </aside>
      </div>
    )
  }

  if (kind === 'alerts') {
    const liveAlerts = makeDrawerAlerts(alerts, actions)
    return (
      <div className="drawer-backdrop" role="presentation" onClick={onClose}>
        <aside className="drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
          <div className="drawer-head">
            <div>
              <span>Alerts view</span>
              <h2>Generated readiness alerts</h2>
            </div>
            <button type="button" onClick={onClose}>Close</button>
          </div>
          <p>Alerts are derived from current inventory, thresholds, expiry dates, plan gaps and household consumption settings.</p>
          {liveAlerts.length === 0 ? (
            <div className="drawer-empty-state">
              <strong>No active alerts</strong>
              <span>Current inventory and plans have no unresolved alert items.</span>
            </div>
          ) : (
            <div className="drawer-live-alerts">
              {liveAlerts.map((alert) => (
                <div className={`drawer-live-alert ${alert.priority}`} key={alert.id}>
                  <strong>{alert.title}</strong>
                  <span>{alert.subtext}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    )
  }

  if (kind === 'depletion') {
    return (
      <div className="drawer-backdrop" role="presentation" onClick={onClose}>
        <aside className="drawer depletion-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
          <div className="drawer-head">
            <div>
              <span>Resource details</span>
              <h2>Resource Depletion Timeline</h2>
            </div>
            <button type="button" onClick={onClose}>Close</button>
          </div>
          <p>Projected days until water, food, fuel, or medical reserve reaches its failure point.</p>
          <ResourceTimeline resources={depletionSeries} />
          <div className="failure-callout">
            <AlertTriangle size={18} />
            <strong>Next failure point:</strong>
            <span>{nextFailure.name} runs out in {formatDays(nextFailure.days)} days</span>
          </div>
        </aside>
      </div>
    )
  }

  const content = drawerContent[kind]
  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span>{content.label}</span>
            <h2>{content.title}</h2>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </div>
        <p>{content.body}</p>
        <div className="drawer-actions">
          {content.actions.map((action) => <span key={action}>{action}</span>)}
        </div>
      </aside>
    </div>
  )
}

const drawerContent: Record<
  Exclude<DrawerKind, 'item' | null>,
  { label: string; title: string; body: string; actions: string[] }
> = {
  depletion: {
    label: 'Depletion details',
    title: 'Inventory-driven failure points',
    body: 'This panel reflects current water, food and fuel stock after every inventory change.',
    actions: ['Review resource timeline', 'Open Inventory', 'Adjust household settings'],
  },
  alerts: {
    label: 'Alerts view',
    title: 'Generated readiness alerts',
    body: 'Alerts are derived from current inventory, thresholds, expiry dates and household consumption settings.',
    actions: ['Resolve water buffer', 'Check low stock', 'Review expiring medical items'],
  },
  'start-plan': {
    label: 'Scenario runner',
    title: 'Start Plan',
    body: 'Scenario mode will step through trigger conditions, household roles, missing supplies and current readiness gaps.',
    actions: ['Power outage', 'Water contamination', 'Evacuation'],
  },
  'upload-document': {
    label: 'Document vault',
    title: 'Upload Document',
    body: 'Local document storage will attach emergency PDFs, IDs, procedures and printable grab-pack records to this device.',
    actions: ['Choose file', 'Tag document', 'Add to print pack'],
  },
  'new-note': {
    label: 'Knowledge note',
    title: 'New Note',
    body: 'Notes will capture local procedures, lessons from drills, radio checks and household-specific instructions.',
    actions: ['Maintenance note', 'Comms note', 'Food rotation note'],
  },
  'open-plan': {
    label: 'Plan details',
    title: 'Power Outage Plan',
    body: 'Immediate gaps are generated from inventory: fuel buffer, backup lighting and charged power banks.',
    actions: ['Open checklist', 'Assign roles', 'Review missing items'],
  },
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="inventory-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ResourceIcon({ type }: { type: 'water' | 'food' | 'shelter' | 'energy' | 'medical' | 'comms' | 'fuel' | 'overall' }) {
  const icons = {
    water: Droplets,
    food: Utensils,
    shelter: Home,
    energy: Zap,
    medical: BriefcaseMedical,
    comms: MapPinned,
    fuel: Fuel,
    overall: Gauge,
  }
  const Icon = icons[type]
  return (
    <span className={`resource-icon ${type}`}>
      <Icon size={18} />
    </span>
  )
}

function StatusPill({ status }: { status: ResourceStatus | 'GOOD' }) {
  return <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>
}

function makeReadiness(
  label: string,
  category: InventoryCategory,
  icon: 'water' | 'food' | 'shelter' | 'energy' | 'medical' | 'comms',
  items: InventoryItem[],
  summary: ReturnType<typeof getResourceSummary>,
  settings: AppSettings,
) {
  const value = getCategoryReadiness(category, items, summary, settings)
  return { label, icon, value, status: statusFromPercent(value) }
}

function trendFromDays(days: number) {
  const points = 8
  return Array.from({ length: points }, (_, index) =>
    Math.max(0, days * (1 - index / (points - 1))),
  )
}

function priorityRank(priority: PlanTask['priority']) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority]
}

function getPrimaryPlanAction(
  missing: ReturnType<typeof getPlanReadiness>['missing'],
  nextTasks: PlanTask[],
) {
  const firstMissing = missing[0]
  if (firstMissing) {
    return `Add ${formatAmount(firstMissing.deficit, firstMissing.requirement.unit)} ${firstMissing.requirement.label.toLowerCase()}`
  }
  const criticalTask = nextTasks.find((task) => task.priority === 'critical')
  if (criticalTask) return criticalTask.title
  return nextTasks[0]?.title ?? 'Maintain current plan readiness'
}

function formatAmount(value: number, unit?: string) {
  const amount = formatQuantityInput(value)
  return unit ? `${amount} ${unit}` : amount
}

function formatRelativeMinutes(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes === 1) return '1 minute'
  if (minutes < 60) return `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  if (hours === 1) return '1 hour'
  return `${hours} hours`
}

function formatRelativeAge(iso: string) {
  const relative = formatRelativeMinutes(iso)
  return relative === 'just now' ? relative : `${relative} ago`
}

function formatDuration(fromIso: string, toIso: string) {
  const minutes = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`
}

function formatQuantityInput(value: number) {
  return Number(value.toFixed(2)).toString()
}

function defaultLocationForCategory(category: InventoryCategory) {
  const locations: Record<InventoryCategory, string> = {
    water: 'Water storage',
    food: 'Pantry',
    medical: 'Medical kit',
    fuel: 'Garage',
    energy: 'Utility shelf',
    shelter: 'Emergency bin',
    communications: 'Comms kit',
    hygiene: 'Bathroom storage',
    tools: 'Tool shelf',
    other: 'Unassigned',
  }
  return locations[category]
}

function inferLitresPerUnit(category: InventoryCategory, unit: string) {
  if ((category === 'water' || category === 'fuel') && isVolumeUnit(unit)) {
    return 1
  }
  return undefined
}

function applyCatalogToForm(form: ItemForm, item: SupplyCatalogItem, replaceName: boolean): ItemForm {
  const category = getInventoryCategoryForCatalogItem(item) ?? item.category
  const shouldUseLitres =
    (item.valueType === 'potable_water' || item.valueType === 'fuel_litres') &&
    item.defaultUnit === 'L'
  const shouldUseCalories = item.valueType === 'calories'
  return {
    ...form,
    name: replaceName ? item.canonicalName : form.name,
    catalogItemId: item.id,
    category,
    unit: item.defaultUnit,
    litresPerUnit: shouldUseLitres ? '1' : '',
    caloriesPerUnit: shouldUseCalories ? form.caloriesPerUnit : '',
  }
}

function applyAliasToForm(form: ItemForm, alias: UserInventoryAlias): ItemForm {
  const catalogItem = getCatalogItemById(alias.catalogItemId)
  const category = getInventoryCategoryForCatalogItem(catalogItem) ?? catalogItem?.category ?? alias.category ?? form.category
  return {
    ...form,
    name: alias.text,
    catalogItemId: alias.catalogItemId ?? '',
    category,
    unit: catalogItem?.defaultUnit ?? alias.unit ?? form.unit,
  }
}

function getItemMatchLabel(item: InventoryItem) {
  const catalogItem = getCatalogItemById(item.catalogItemId) ?? findBestCatalogMatch(item.name)
  return catalogItem ? `Matched: ${catalogItem.canonicalName}` : 'Custom item'
}

function getInventoryUnitHint(category: InventoryCategory) {
  if (category === 'water') return 'Use L for stored potable water. Use pack/unit for tablets or filters.'
  if (category === 'food') return 'Add calories per unit so food days can be calculated.'
  if (category === 'fuel') return 'Use L for stored fuel where possible.'
  return 'Use a consistent unit so plan requirements can match this item.'
}

function getCategoryHeaderSummary(
  category: InventoryCategory,
  items: InventoryItem[],
  summary: ReturnType<typeof getResourceSummary>,
  settings: AppSettings,
) {
  if (category === 'water') return { metric: `${formatDays(summary.waterDays)} days`, status: summary.waterStatus }
  if (category === 'food') return { metric: `${formatDays(summary.foodDays)} days`, status: summary.foodStatus }
  if (category === 'fuel') return { metric: `${formatDays(summary.fuelDays)} days`, status: summary.fuelStatus }
  if (category === 'medical') {
    return { metric: `${summary.medicalExpiringCount} expiring`, status: summary.medicalStatus }
  }
  const value = getCategoryReadiness(category, items, summary, settings)
  const status = statusFromPercent(value)
  return { metric: `${value}%`, status: status === 'GOOD' ? 'OK' : status }
}

function getItemAttentionReasons(item: InventoryItem, duplicateCandidate?: DuplicateCandidate) {
  const reasons: string[] = []
  const daysUntilExpiry = getDaysUntilExpiry(item)
  if (daysUntilExpiry !== undefined) {
    if (daysUntilExpiry < 0) reasons.push('Expired')
    else if (daysUntilExpiry <= 30) reasons.push('Expiring soon')
  }
  if (item.minThreshold !== undefined && item.quantity < item.minThreshold) {
    reasons.push('Below item minimum')
  }
  if (duplicateCandidate) {
    reasons.push(duplicateCandidate.mergeable ? 'Possible duplicate' : 'Duplicate review required')
  }
  const catalogItem = getCatalogItemById(item.catalogItemId) ?? findBestCatalogMatch(item.name)
  if (catalogItem?.valueType === 'calories' && !item.caloriesPerUnit) {
    reasons.push('Missing calories per unit')
  }
  if (
    (catalogItem?.valueType === 'potable_water' || catalogItem?.valueType === 'fuel_litres') &&
    !isVolumeUnit(item.unit) &&
    !item.litresPerUnit
  ) {
    reasons.push('Missing litres per unit')
  }
  return reasons
}

function formatIncidentLogType(type: IncidentLogType) {
  if (type === 'task_completed') return 'Task completed'
  if (type === 'item_added') return 'Item added'
  if (type === 'scenario_started') return 'Scenario started'
  if (type === 'scenario_ended') return 'Scenario ended'
  return 'Note'
}

function sortIncidentLogEntries(entries: IncidentLogEntry[]) {
  return [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

function formatIncidentPlanName(entry: IncidentLogEntry, plans: EmergencyPlan[]) {
  return plans.find((plan) => plan.id === entry.planId)?.name ?? 'Plan not found'
}

function formatLogTimestamp(timestamp: string) {
  const time = new Date(timestamp)
  return `${time.toLocaleDateString()} ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function formatShortDate(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

function registerPmtilesProtocol() {
  if (pmtilesProtocolRegistered && pmtilesProtocol) return pmtilesProtocol
  const protocol = new Protocol()
  try {
    maplibregl.addProtocol('pmtiles', protocol.tile)
  } catch {
    // Vite hot reload may keep a previous PMTiles protocol registration alive.
  }
  pmtilesProtocol = protocol
  pmtilesProtocolRegistered = true
  return protocol
}

function makeBlankMapStyle(theme: ThemeMode): StyleSpecification {
  const isLight = theme === 'light'
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': isLight ? '#eef5fb' : '#09111d',
        },
      },
    ],
  }
}

function makePmtilesMapStyle(pmtilesUrl: string, theme: ThemeMode, metadata?: MapPackMetadata): StyleSpecification {
  const style = makeBlankMapStyle(theme)
  const isRaster = metadata?.tileType === 'raster'
  const sourceLayers = new Set(metadata?.sourceLayers ?? [])

  return {
    ...style,
    sources: {
      // Browser MVP: local .pmtiles files are wired through PMTiles FileSource + protocol.add().
      // Desktop pass: this can be replaced with a stable folder-backed path.
      offlineMapPack: {
        ...(isRaster
          ? { type: 'raster', tiles: [`${normalizePmtilesUrl(pmtilesUrl)}/{z}/{x}/{y}`], tileSize: 256 }
          : { type: 'vector', url: normalizePmtilesUrl(pmtilesUrl) }),
      } as StyleSpecification['sources'][string],
    },
    layers: [
      ...style.layers,
      ...makePmtilesBackgroundLayers(sourceLayers, isRaster, theme),
    ],
  }
}

async function registerPmtilesFile(
  file: File,
  persistence: MapPackMetadata['persistence'],
  selectedAt = new Date().toISOString(),
): Promise<MapPackMetadata> {
  const protocol = registerPmtilesProtocol()
  const archive = new PMTiles(new FileSource(file))
  protocol.tiles.delete(file.name)
  protocol.add(archive)
  const [header, sourceLayers] = await Promise.all([
    archive.getHeader(),
    archive.getMetadata().then(extractPmtilesSourceLayers).catch(() => []),
  ])
  return {
    id: 'active',
    fileName: file.name,
    fileSize: file.size,
    selectedAt,
    persistence,
    pmtilesUrl: file.name,
    tileType: getPmtilesTileTypeLabel(header.tileType),
    sourceLayers,
  }
}

function makePmtilesBackgroundLayers(sourceLayers: Set<string>, isRaster: boolean, theme: ThemeMode): StyleSpecification['layers'] {
  if (isRaster) {
    return [{ id: 'offline-map-raster', type: 'raster', source: 'offlineMapPack' }]
  }
  const isLight = theme === 'light'
  const layers: StyleSpecification['layers'] = []
  if (sourceLayers.has('water')) {
    layers.push({
      id: 'offline-water',
      type: 'fill',
      source: 'offlineMapPack',
      'source-layer': 'water',
      paint: { 'fill-color': isLight ? '#b9ddf3' : '#12344b', 'fill-opacity': 0.86 },
    })
  }
  if (sourceLayers.has('building')) {
    layers.push({
      id: 'offline-buildings',
      type: 'fill',
      source: 'offlineMapPack',
      'source-layer': 'building',
      paint: { 'fill-color': isLight ? '#d7dde7' : '#263344', 'fill-opacity': 0.58 },
    })
  }
  const roadLayer = sourceLayers.has('transportation') ? 'transportation' : sourceLayers.has('roads') ? 'roads' : ''
  if (roadLayer) {
    layers.push({
      id: 'offline-roads',
      type: 'line',
      source: 'offlineMapPack',
      'source-layer': roadLayer,
      paint: { 'line-color': isLight ? '#ffffff' : '#5b6b7f', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 14, 2.4] },
    })
  }
  const placeLayer = sourceLayers.has('place') ? 'place' : sourceLayers.has('places') ? 'places' : ''
  if (placeLayer) {
    layers.push({
      id: 'offline-places',
      type: 'symbol',
      source: 'offlineMapPack',
      'source-layer': placeLayer,
      layout: { 'text-field': ['coalesce', ['get', 'name'], ['get', 'name:en']], 'text-size': 12 },
      paint: { 'text-color': isLight ? '#26384f' : '#dbeafe', 'text-halo-color': isLight ? '#f7fbff' : '#07111d', 'text-halo-width': 1.4 },
    })
  }
  return layers
}

function normalizePmtilesUrl(url: string) {
  return url.startsWith('pmtiles://') ? url : `pmtiles://${url}`
}

function extractPmtilesSourceLayers(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || !('vector_layers' in metadata)) return []
  const layers = (metadata as { vector_layers?: Array<{ id?: unknown }> }).vector_layers
  if (!Array.isArray(layers)) return []
  return layers.map((layer) => layer.id).filter((id): id is string => typeof id === 'string')
}

function getPmtilesTileTypeLabel(tileType: TileType): MapPackMetadata['tileType'] {
  if (tileType === TileType.Mvt) return 'vector'
  if (tileType === TileType.Png || tileType === TileType.Jpeg || tileType === TileType.Webp || tileType === TileType.Avif) return 'raster'
  return 'unknown'
}

function isPmtilesFile(file: File) {
  return file.name.toLowerCase().endsWith('.pmtiles')
}

function getMapPackPersistenceLabel(status: MapPackMetadata['persistence']) {
  if (status === 'remembered') return 'Remembered by this browser'
  if (status === 'needs_reselect') return 'Needs reselect'
  return 'Session only'
}

function getDashboardMapPackLabel(mapPack?: MapPackMetadata) {
  if (!mapPack) return 'None'
  if (mapPack.pmtilesUrl) return 'Loaded'
  if (mapPack.persistence === 'needs_reselect') return 'Needs reselect'
  return 'Selected'
}

function getFailureColor(resourceName: string) {
  const name = resourceName.toLowerCase()
  if (name.includes('water')) return '#4bb6ff'
  if (name.includes('food')) return '#45d978'
  if (name.includes('fuel')) return '#ff594f'
  return '#f5b52e'
}

function getFailureActionText(nextFailure: { name: string; days: number }) {
  const days = formatDays(nextFailure.days)
  const name = nextFailure.name.toLowerCase()
  if (name.includes('water')) return `${days} days of water left. Add potable water or reduce non-essential use.`
  if (name.includes('food')) return `${days} days of food left. Add calorie-bearing food or review household assumptions.`
  if (name.includes('fuel')) return `${days} days of fuel left. Add stored fuel or reduce generator/runtime demand.`
  return `${days} days remaining. Review expiring medical items and replacement needs.`
}

function normalizeLoadedMapPack(metadata: MapPackMetadata | undefined) {
  if (!metadata) return undefined
  if (metadata.persistence === 'remembered') return metadata
  return { ...metadata, persistence: 'needs_reselect' as const, pmtilesUrl: undefined }
}

function filterMapLocations(locations: MapLocation[], filter: MapPointFilter) {
  if (filter === 'all') return locations
  const types = mapPointFilters.find((entry) => entry.id === filter)?.types ?? []
  return locations.filter((location) => types.includes(location.type))
}

function getRelevantMapLocationsForPlan(plan: EmergencyPlan, locations: MapLocation[]) {
  const types = getRelevantMapTypesForPlan(plan)
  return locations.filter((location) => types.includes(location.type))
}

function getRelevantMapTypesForPlan(plan: EmergencyPlan): MapLocationType[] {
  if (plan.category === 'water') return ['water', 'medical', 'hazard']
  if (plan.category === 'medical') return ['medical', 'communications', 'rally']
  if (plan.category === 'evacuation') return ['home', 'rally', 'shelter', 'fuel', 'medical', 'hazard']
  if (plan.category === 'communications') return ['communications', 'rally', 'home']
  if (plan.category === 'shelter') return ['home', 'shelter', 'hazard', 'water']
  if (plan.category === 'power') return ['fuel', 'communications', 'home', 'medical']
  return ['home', 'rally', 'other']
}

function getLinkedMapLocationIdsForPlan(plan: EmergencyPlan) {
  return [
    ...(plan.linkedMapLocationIds ?? []),
    ...plan.tasks.flatMap((task) => task.linkedMapLocationIds ?? []),
  ]
}

function mapIdSetFromKey(key: string) {
  return new Set(key ? key.split('|') : [])
}

function getLinkedMapLocationsForPlan(plan: EmergencyPlan, locations: MapLocation[]) {
  const ids = new Set(getLinkedMapLocationIdsForPlan(plan))
  return locations.filter((location) => ids.has(location.id))
}

function getLinkedMapLocationsForTask(task: PlanTask, locations: MapLocation[]) {
  const ids = new Set(task.linkedMapLocationIds ?? [])
  return locations.filter((location) => ids.has(location.id))
}

function getLinkedMapSummary(plan: EmergencyPlan, locations: MapLocation[]) {
  const linked = getLinkedMapLocationsForPlan(plan, locations)
  return {
    total: linked.length,
    hazards: linked.filter((location) => location.type === 'hazard').length,
    practical: linked.filter((location) => ['rally', 'shelter', 'water', 'medical'].includes(location.type)).length,
  }
}

function updateMapLocations(
  map: MapLibreMap | null,
  locations: MapLocation[],
  selectedLocationId: string | null,
  linkedMapLocationIds = new Set<string>(),
) {
  if (!map || !map.isStyleLoaded()) return
  const data = mapLocationsToGeoJson(locations, selectedLocationId, linkedMapLocationIds)
  const existingSource = map.getSource('saved-locations') as GeoJSONSource | undefined
  if (existingSource) {
    existingSource.setData(data)
    return
  }
  map.addSource('saved-locations', { type: 'geojson', data })
  map.addLayer({
    id: 'saved-locations',
    type: 'circle',
    source: 'saved-locations',
    paint: {
      'circle-radius': ['case', ['get', 'selected'], 9, 7],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': ['case', ['get', 'linked'], '#f5b52e', '#ffffff'],
      'circle-stroke-width': ['case', ['get', 'selected'], 3, ['get', 'linked'], 3, 2],
      'circle-opacity': 0.94,
    },
  })
  map.addLayer({
    id: 'saved-location-labels',
    type: 'symbol',
    source: 'saved-locations',
    layout: {
      'text-field': ['get', 'label'],
      'text-size': 12,
      'text-offset': [0, 1.25],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#eaf3ff',
      'text-halo-color': '#07111d',
      'text-halo-width': 2,
    },
  })
  map.addLayer({
    id: 'saved-locations-hit',
    type: 'circle',
    source: 'saved-locations',
    paint: {
      'circle-radius': 18,
      'circle-color': 'rgba(0,0,0,0)',
    },
  })
}

function mapLocationsToGeoJson(
  locations: MapLocation[],
  selectedLocationId: string | null,
  linkedMapLocationIds: Set<string>,
) {
  return {
    type: 'FeatureCollection' as const,
    features: locations.map((location) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [location.longitude, location.latitude],
      },
      properties: {
        id: location.id,
        label: location.name,
        selected: location.id === selectedLocationId,
        linked: linkedMapLocationIds.has(location.id),
        color: getMapLocationColor(location.type),
      },
    })),
  }
}

function getMapCenter(locations: MapLocation[]): [number, number] {
  if (locations.length === 0) return [151.2093, -33.8688]
  const longitude = locations.reduce((total, location) => total + location.longitude, 0) / locations.length
  const latitude = locations.reduce((total, location) => total + location.latitude, 0) / locations.length
  return [longitude, latitude]
}

function getMapLocationColor(type: MapLocationType) {
  if (type === 'hazard') return '#ff594f'
  if (type === 'water') return '#4bb6ff'
  if (type === 'medical') return '#f5b52e'
  if (type === 'fuel') return '#ff7a68'
  if (type === 'communications') return '#a78bfa'
  if (type === 'shelter') return '#45d978'
  if (type === 'rally') return '#7dd3fc'
  if (type === 'home') return '#35d46f'
  return '#94a3b8'
}

function getMapLocationLabel(type: MapLocationType) {
  return mapLocationTypes.find((item) => item.type === type)?.label ?? 'Other'
}

function renderMapLocationIcon(type: MapLocationType) {
  if (type === 'home') return <Home size={18} />
  if (type === 'water') return <Droplets size={18} />
  if (type === 'medical') return <BriefcaseMedical size={18} />
  if (type === 'fuel') return <Fuel size={18} />
  if (type === 'communications') return <Radio size={18} />
  if (type === 'hazard') return <AlertTriangle size={18} />
  if (type === 'shelter') return <Shield size={18} />
  return <MapPinned size={18} />
}

function copyCoordinates(location: MapLocation) {
  navigator.clipboard?.writeText(`${location.latitude}, ${location.longitude}`).catch(() => undefined)
}

function getDocumentKind(file: File): StoredDocumentKind | undefined {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (file.type === 'image/jpeg' || file.type === 'image/png' || /\.(jpe?g|png)$/i.test(file.name)) return 'image'
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) return 'text'
  return undefined
}

function getFallbackMimeType(name: string, kind: StoredDocumentKind) {
  if (kind === 'pdf') return 'application/pdf'
  if (kind === 'text') return 'text/plain'
  if (/\.png$/i.test(name)) return 'image/png'
  return 'image/jpeg'
}

function getDocumentIcon(kind: StoredDocumentKind) {
  if (kind === 'image') return ImageIcon
  return FileText
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatHeaderClock(date: Date) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
  const day = new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(date)
  const month = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date)
  const time = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${weekday}, ${day} ${month} · ${time}`
}

export default App
