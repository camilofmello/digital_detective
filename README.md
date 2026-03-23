# Digital Detective v2.0.11

Chrome extension (Manifest V3) for web intelligence, QA, and frontend diagnostics.

## Changelog

### v2.0.11 - 2026-03-23

**QA Scan and documentation alignment**

- Added `QA Scan`, a deterministic page QA audit for broken assets, JavaScript/load errors, suspicious forms and links, and safe interaction smoke checks.
- Added `qa_report.html` and `qa_report.js`.
- Added sticky clickable summary cards in the QA report.
- Improved QA wording so sections explain checked, passed, fails, and result more clearly.
- Standardized visible versioning to `2.0.11`.
- Cleaned and aligned this `README.md` with the current build.

### v2.0.3 - 2026-03-10

**New Feature: Script Match**

- Added `Script Match` to compare two pages and identify common scripts, scripts missing from page B, and scripts exclusive to page B.
- Added a new `Script Match` button to the popup tool grid.
- Added a dedicated full report page via `script_match.html`.
- Implemented a two-pass matching strategy: exact URL match first, then soft match by filename.
- Added vendor/library detection for common third-party scripts.

### v2.0.2 - 2026-03-08

**Bug fixes and improvements**

- Fixed `Color Picker` user-activation timing for `EyeDropper.open()`.
- Simplified the `Color Picker` flow to reduce clicks.
- Fixed RGB/RGBA parsing fallback in the color conversion logic.
- Added `Open after capture` toggle to `Screenshot`.
- Added `Element XPath` mode to `Element Picker`.

## Overview

Digital Detective centralizes 15 tools in one plugin UI:

1. Color Picker
2. Screenshot
3. Element Picker
4. DS Extractor
5. Component Blueprinter
6. Match Analysis
7. Lighthouse Audit
8. SEO Analysis
9. AEO Analysis
10. QA Scan
11. Event Tracker
12. Script Finder
13. Script Match
14. Static Builder
15. Quick Updater

The extension opens interactive panels from the popup and generates visual reports in new tabs.

## Main Features

- Unified popup with a tool grid and inline workflow panels.
- Tooltip descriptions on hover for each tool button.
- Full-page and scoped Design System reports.
- Component blueprint generation from pasted HTML.
- Side-by-side match analysis for two URLs.
- Lighthouse, SEO, and AEO audit reports.
- QA scan for assets, JS/load errors, forms, links, and safe click smoke tests.
- Event inspection for Segment/Rudderstack-style payloads.
- Script discovery, copy, block, and re-enable flow.
- Static page generation with CSS inlining and absolute URL rewriting.
- Local HTML updating with side-by-side comparison and save flow.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript
- HTML + CSS
- Chrome APIs: `tabs`, `scripting`, `downloads`, `storage`, `declarativeNetRequest`

## Project Structure

```text
Digital Detective v2.0/
|-- manifest.json
|-- popup.html
|-- popup.js
|-- content.js
|-- background.js
|-- blueprinter.html
|-- blueprinter.js
|-- ds_extractor.html
|-- ds_extractor.js
|-- match_analysis.html
|-- match_analysis.js
|-- lighthouse_report.html
|-- lighthouse_report.js
|-- seo_report.html
|-- seo_report.js
|-- aeo_report.html
|-- aeo_report.js
|-- qa_report.html
|-- qa_report.js
|-- script_match.html
|-- script_match.js
|-- static_builder.html
|-- static_builder.js
|-- quick_updater.html
|-- quick_updater.js
|-- template_ds.html
|-- report_utils.js
|-- report_viewer.html
|-- report_viewer.js
`-- icons/
```

## Installation (Developer Mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder: `Digital Detective v2.0`.
5. Pin the extension and open the popup.

## How To Use

1. Open any HTTP or HTTPS page.
2. Click the extension icon.
3. Hover a tool to see its description.
4. Click a tool button to run it directly or expand its panel.
5. Run the selected action.

## Reports

The extension can generate reports such as:

- `design_system_report.html`
- `design_system_report_scoped.html`
- `component-blueprint.html`
- `seo_report_*.html`
- `lighthouse_performance_*.html`
- `aeo_report_*.html`
- `qa_report.html`
- `*_Script_Match_Report_*.html`
- `template_ds.html`

Reports are generated on demand and can be saved locally via each report's `SAVE HTML` button.

## Permissions

From `manifest.json`:

- `activeTab`: run actions on the current tab.
- `scripting`: inject or execute scripts when needed.
- `downloads`: save generated files.
- `storage`: persist plugin settings and cached data.
- `tabs`: read the active tab URL and open report tabs.
- `declarativeNetRequest`: support script blocking and request rules.
- `declarativeNetRequestWithHostAccess`: support host-aware request rules.
- `host_permissions` (`http://*/*`, `https://*/*`, `file://*/*`): inspect web pages and local files when allowed.

## Development Notes

- Reload the extension in `chrome://extensions` after code changes.
- Keep files in UTF-8 and avoid mixed encodings.
- Keep UI and report standards consistent with the `2.0.11` build.
- Update versioning in code and visible plugin surfaces on every relevant release.

## Version

- Current: **v2.0.11**
- Version format: `major.minor.patch`
- Footer standard: `Digital Detective v2.0.11 - Developed by Camilo Mello`

## Author

Camilo Mello  
camilofmello@gmail.com
