# Survival OS v0.1.0

Release name: Local-first MVP

## Summary

Survival OS v0.1.0 is the first stable MVP release of the local-first preparedness dashboard. It focuses on household readiness: supplies, plans, map points, household documents, reference knowledge, backups, and incident activity.

## Core Features

- Dashboard with resource status, Today's Priorities, next failure point, alerts, needs-attention items, map/file/reference counts, and recent activity.
- Inventory with catalog-backed matching, expiry handling, duplicate detection, merge support, category summaries, and local persistence.
- Scenario Plans with preparedness readiness, active scenario execution, NOW/NEXT/LATER task flow, missing item actions, and map point links.
- Incident Log for scenario activity, manual notes, task completions, item additions, and scenario lifecycle events.
- Maps with saved operational points, scenario-aware filters, linked plan points, and PMTiles-ready map pack support.
- Documents for household files including PDFs, images, and text files.
- Knowledge for general preparedness references, notes, links, and linked documents.
- Settings for household assumptions, local backup/import/export, and backup clarity.

## Known Limitations

- No cloud sync.
- No accounts.
- No AI.
- No OCR.
- No GPS, routing, or geocoding.
- Browser storage clearing may remove local app data and locally stored files.
- PMTiles file persistence depends on browser support.

## Backup Limitations

- Backups include app data, document details, map point data, map pack metadata, plans, settings, incident logs, and knowledge resources.
- Backups do not include original uploaded document files.
- Backups do not include PMTiles map pack files.
- Backups do not include browser file permissions or file handles.
- Knowledge resources linked to documents may need those document files restored separately.

## Validation Status

- Build passed.
- Tests passed.
- Lint passed.

## Suggested Next Work

- Full document backup bundle.
- Desktop wrapper with Tauri or Electron.
- Richer Knowledge search.
- Optional local AI later.
