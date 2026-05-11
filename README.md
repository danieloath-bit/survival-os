# Survival OS

A local-first preparedness dashboard for tracking household supplies, plans, maps, documents, knowledge, and incident activity.

## MVP Includes

- Dashboard for readiness, priorities, alerts, recent activity, and next failure point.
- Inventory with catalog matching, expiry tracking, duplicate handling, and local persistence.
- Plans and active scenario execution with checklists, missing supplies, map links, and response progress.
- Incident Log for scenario starts, endings, task completions, item additions, and notes.
- Maps with saved operational points and PMTiles-ready offline map pack support.
- Documents for household-specific PDFs, images, and text files.
- Knowledge for general preparedness references, links, notes, and linked documents.
- Backup/export/import for local app data.
- Local settings for household assumptions and readiness thresholds.

## Not Included Yet

- Cloud sync.
- Accounts or authentication.
- AI.
- OCR.
- GPS, routing, or geocoding.
- Full uploaded document file backup.
- PMTiles file backup.

## Local-First Warning

Survival OS stores data locally in the browser/device. There is no cloud sync. Clearing browser storage may remove app data and locally stored files.

Keep your own copies of important documents and map packs outside the app.

## Backup Behaviour

Backups include app data such as inventory, plans, checklist progress, active scenario state, incident log, settings, saved map points, knowledge resources, and document details.

Backups do not include:

- Original uploaded document files.
- PMTiles map pack files.
- Browser file permissions or file handles.

After restoring a backup, document details and map pack details may be present, but original files may need to be uploaded or selected again.

## Recommended Browser

Use a Chromium-based browser for best PMTiles file handle support.

Other browsers may still run the app, but may require reselecting a PMTiles map pack after refresh.

## Install And Run

```bash
npm install
npm run dev
```

## Validation Commands

```bash
npm run build
npm run test -- --run
npm run lint
```

## Disclaimer

Survival OS is a planning tool. It does not replace official emergency advice, emergency services, or professional guidance.
