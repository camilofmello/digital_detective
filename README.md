# Digital Detective

Chrome extension (Manifest V3) for web intelligence, QA, and frontend diagnostics.

## Overview

Digital Detective centralizes 10 tools in one plugin UI:

1. Color Picker
2. Screenshot
3. Element Picker
4. DS Extractor
5. Component Blueprinter
6. Match Analysis
7. Lighthouse Audit
8. SEO Analysis
9. Event Tracker
10. Script Finder

The extension opens interactive panels from the popup and generates visual reports in new tabs.

## Main Features

- Unified popup with 2-column tool grid and expand/collapse behavior.
- Tooltip descriptions on hover for each tool button.
- Inline workflows for DS Extractor and Component Blueprinter.
- Full-page and scoped Design System reports.
- SEO report and Lighthouse performance report.
- Event tracking for Segment/Rudderstack style events.
- Script discovery, copy, block, and re-enable flow.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript
- HTML + CSS
- Chrome APIs: `tabs`, `scripting`, `downloads`, `storage`, `declarativeNetRequest`

## Project Structure

```text
Digital Detective v1.6/
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
|-- report_utils.js
|-- report_viewer.html
|-- report_viewer.js
|-- reports/
`-- icons/
```

## Installation (Developer Mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder (`Digital Detective v1.6`).
5. Pin the extension and open the popup.

## How To Use

1. Open any HTTP/HTTPS page.
2. Click the extension icon.
3. Hover a tool to see its description.
4. Click a tool button to expand its panel.
5. Click again to collapse.
6. Run the selected action.

## Reports

The extension can generate reports such as:

- `design_system_report.html`
- `design_system_report_scoped.html`
- `component-blueprint.html`
- `seo_report_*.html`
- `lighthouse_performance_*.html`

Sample generated files are stored in the [`reports/`](./reports) directory.

## Permissions

From `manifest.json`:

- `activeTab`: run actions on the current tab.
- `scripting`: inject or execute scripts when needed.
- `downloads`: save generated files.
- `storage`: persist plugin settings and cached data.
- `tabs`: read active tab URL and open report tabs.
- `declarativeNetRequest`: script blocking/unblocking flows.
- `host_permissions` (`http://*/*`, `https://*/*`): inspect regular web pages.

## Development Notes

- Reload the extension in `chrome://extensions` after code changes.
- Keep files in UTF-8 and avoid mixed encodings.
- Keep UI and report standards consistent with the v1.6 design language.

## Version

- Current: **v1.6**
- Footer standard: `Digital Detective V1.6 - Developed by Camilo Mello`

## Author

Camilo Mello camilofmello@gmail.com

