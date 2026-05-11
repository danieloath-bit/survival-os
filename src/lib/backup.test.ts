import { describe, expect, it } from 'vitest'
import { defaultAppSettings, seedInventory, seedPlans } from '../data/seed'
import { createBackupPayload, parseBackupPayload } from './backup'

describe('backup import/export', () => {
  it('exports and imports complete app state', () => {
    const payload = createBackupPayload({
      activeScenario: { planId: 'water-contamination', activatedAt: '2026-04-29T00:00:00.000Z' },
      ignoredDuplicateGroups: [{ catalogItemId: 'drinking-water-potable', fingerprint: 'abc', ignoredAt: '2026-04-29T00:00:00.000Z' }],
      incidentLog: [{ id: 'log-1', planId: 'water-contamination', timestamp: '2026-04-29T00:00:00.000Z', type: 'scenario_started', message: 'Scenario activated' }],
      items: seedInventory,
      knowledgeResources: [{ id: 'knowledge-1', title: 'Water treatment notes', category: 'Water', sourceType: 'document', description: 'General water treatment reference', documentId: 'doc-1', createdAt: '2026-04-29T00:00:00.000Z', updatedAt: '2026-04-29T00:00:00.000Z' }],
      mapLocations: [{ id: 'map-1', name: 'Rally Point A', type: 'rally', latitude: -33.8, longitude: 151.2, createdAt: '2026-04-29T00:00:00.000Z', updatedAt: '2026-04-29T00:00:00.000Z' }],
      mapPackMetadata: { id: 'active', fileName: 'local.pmtiles', fileSize: 1234, selectedAt: '2026-04-29T00:00:00.000Z', persistence: 'remembered', pmtilesUrl: 'local.pmtiles', tileType: 'vector', sourceLayers: ['water'] },
      plans: seedPlans.map((plan) => plan.id === 'evacuation' ? { ...plan, tasks: plan.tasks.map((task, index) => index === 0 ? { ...task, linkedMapLocationIds: ['map-1'] } : task) } : plan),
      settings: defaultAppSettings,
      documentMetadata: [{ id: 'doc-1', name: 'id.pdf', mimeType: 'application/pdf', kind: 'pdf', tag: 'ID', size: 100, createdAt: '2026-04-29T00:00:00.000Z' }],
    })

    expect(parseBackupPayload(JSON.parse(JSON.stringify(payload)))).toMatchObject({
      items: payload.items,
      plans: payload.plans,
      mapLocations: payload.mapLocations,
      settings: payload.settings,
      activeScenario: payload.activeScenario,
      incidentLog: payload.incidentLog,
      ignoredDuplicateGroups: payload.ignoredDuplicateGroups,
      documentMetadata: payload.documentMetadata,
      knowledgeResources: payload.knowledgeResources,
    })
    expect(payload.mapPackMetadata?.pmtilesUrl).toBeUndefined()
    const parsed = parseBackupPayload(JSON.parse(JSON.stringify(payload)))
    expect(parsed.mapPackMetadata).toMatchObject({
      fileName: 'local.pmtiles',
      fileSize: 1234,
      persistence: 'needs_reselect',
    })
    expect(parsed.mapPackMetadata?.pmtilesUrl).toBeUndefined()
  })

  it('falls back safely for malformed import payloads', () => {
    const payload = parseBackupPayload({ items: 'bad', plans: 'bad', settings: { householdPeople: -2 } })

    expect(payload.items).toHaveLength(seedInventory.length)
    expect(payload.plans).toHaveLength(seedPlans.length)
    expect(payload.settings.householdPeople).toBe(1)
    expect(payload.incidentLog).toEqual([])
    expect(payload.ignoredDuplicateGroups).toEqual([])
    expect(payload.mapLocations).toEqual([])
    expect(payload.mapPackMetadata).toBeUndefined()
    expect(payload.knowledgeResources).toEqual([])
  })

  it('loads partial imports safely', () => {
    const payload = parseBackupPayload({ items: [], settings: { ...defaultAppSettings, waterLitresPerPersonPerDay: 6 } })

    expect(payload.items).toEqual([])
    expect(payload.plans).toHaveLength(seedPlans.length)
    expect(payload.settings.waterLitresPerPersonPerDay).toBe(6)
    expect(payload.mapLocations).toEqual([])
    expect(payload.knowledgeResources).toEqual([])
  })

  it('keeps plan links to missing map points for the UI to mark as missing', () => {
    const payload = parseBackupPayload({
      items: [],
      settings: defaultAppSettings,
      mapLocations: [],
      plans: [
        {
          ...seedPlans[0],
          tasks: seedPlans[0].tasks.map((task, index) => index === 0 ? { ...task, linkedMapLocationIds: ['missing-map'] } : task),
        },
      ],
    })

    expect(payload.plans?.[0].tasks[0].linkedMapLocationIds).toEqual(['missing-map'])
  })

  it('keeps knowledge links to missing documents for the UI to mark as missing', () => {
    const payload = parseBackupPayload({
      items: [],
      settings: defaultAppSettings,
      documentMetadata: [],
      knowledgeResources: [
        {
          id: 'knowledge-1',
          title: 'Local first aid PDF',
          category: 'First Aid',
          sourceType: 'document',
          documentId: 'missing-doc',
          createdAt: '2026-04-29T00:00:00.000Z',
          updatedAt: '2026-04-29T00:00:00.000Z',
        },
      ],
    })

    expect(payload.knowledgeResources?.[0].documentId).toBe('missing-doc')
  })
})
