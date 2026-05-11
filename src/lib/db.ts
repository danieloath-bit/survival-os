import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, BackupPayload, InventoryItem, Location, StoredDocument } from '../types'
import { defaultLocations, defaultSettings } from './inventory'

class PantryDatabase extends Dexie {
  items!: EntityTable<InventoryItem, 'id'>
  locations!: EntityTable<Location, 'id'>
  settings!: EntityTable<AppSettings & { id: 'settings' }, 'id'>
  documents!: EntityTable<StoredDocument, 'id'>
  mapPackHandles!: EntityTable<{ id: 'active'; handle: FileSystemFileHandle }, 'id'>

  constructor() {
    super('pantry-preparedness')
    this.version(1).stores({
      items: 'id, name, category, locationId, dateValue, updatedAt',
      locations: 'id, name, parentId',
      settings: 'id',
    })
    this.version(2).stores({
      items: 'id, name, category, locationId, dateValue, updatedAt',
      locations: 'id, name, parentId',
      settings: 'id',
      documents: 'id, name, kind, tag, createdAt',
    })
    this.version(3).stores({
      items: 'id, name, category, locationId, dateValue, updatedAt',
      locations: 'id, name, parentId',
      settings: 'id',
      documents: 'id, name, kind, tag, createdAt',
      mapPackHandles: 'id',
    })
  }
}

export const db = new PantryDatabase()

export async function ensureSeedData() {
  const locationCount = await db.locations.count()
  if (locationCount === 0) {
    await db.locations.bulkAdd(defaultLocations)
  }

  const settings = await db.settings.get('settings')
  if (!settings) {
    await db.settings.put({ ...defaultSettings, id: 'settings' })
  }
}

export async function getSettings(): Promise<AppSettings> {
  const settings = await db.settings.get('settings')
  return settings ? stripSettingsId(settings) : defaultSettings
}

export async function saveSettings(settings: AppSettings) {
  await db.settings.put({ ...settings, id: 'settings' })
}

export async function getAllData() {
  await ensureSeedData()
  const [items, locations, settings] = await Promise.all([
    db.items.toArray(),
    db.locations.toArray(),
    getSettings(),
  ])
  return { items, locations, settings }
}

export async function replaceAllData(payload: BackupPayload) {
  await db.transaction('rw', db.items, db.locations, db.settings, async () => {
    await db.items.clear()
    await db.locations.clear()
    await db.settings.clear()
    await db.items.bulkAdd(payload.items)
    await db.locations.bulkAdd(payload.locations ?? [])
    await db.settings.put({ ...payload.settings, id: 'settings' })
  })
}

export async function clearUserData() {
  await db.transaction('rw', db.items, db.locations, db.settings, async () => {
    await db.items.clear()
    await db.locations.clear()
    await db.settings.clear()
  })
  await ensureSeedData()
}

function stripSettingsId(settings: AppSettings & { id: 'settings' }): AppSettings {
  return {
    region: settings.region,
    householdPeople: settings.householdPeople,
    childrenCount: settings.childrenCount,
    petsCount: settings.petsCount,
    caloriesPerPersonPerDay: settings.caloriesPerPersonPerDay,
    waterLitresPerPersonPerDay: settings.waterLitresPerPersonPerDay,
    fuelLitresPerDay: settings.fuelLitresPerDay,
    targetBufferDays: settings.targetBufferDays,
    criticalBelowDays: settings.criticalBelowDays,
    lowBelowDays: settings.lowBelowDays,
    watchBelowDays: settings.watchBelowDays,
    goodAboveDays: settings.goodAboveDays,
  }
}
