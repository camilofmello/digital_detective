# Digital Detective v1.8

Chrome extension (Manifest V3) for web intelligence, QA, and frontend diagnostics.

## Changelog

### v1.8 — 2026-03-10

**New Feature: Script Match**

- **Script Match tool:** Compare two pages and identify which scripts they have in common. Enter a control page (A) and a new page (B) — the report shows which scripts are matched, which are missing from B, and which are exclusive to B.
- New button `Script Match` added to the tool grid (icon: `compare_arrows`).
- New panel with two URL inputs (Control Page A / New Page B) and an Analyse button.
- Opens `script_match.html` as a full report page in a new tab.
- **Matching strategy:** two-pass comparison — exact URL match first, then soft match by filename (detects same library loaded from different CDNs or versions).
- **Report sections:**
  - Score card with Jaccard similarity score and summary stats.
  - Common Scripts — scripts present in both pages.
  - Missing from B — scripts in A not found in B.
  - Extra in B — scripts in B not present in A.
- Vendor/library detection for 100+ known scripts (Google Analytics, GTM, jQuery, React, Vue, Stripe, Hotjar, Segment, HubSpot, Sentry, etc.).
- Collapsible blocks and Save Report button consistent with the standard report design.

---

### v1.7.2 — 2026-03-08

**Bug Fixes & Improvements**

- **Color Picker — EyeDropper AbortError fix:** `EyeDropper.open()` was aborting immediately because DOM mutations (`display: none`) were being applied before calling `open()`, consuming the browser's user activation. Fixed by calling `open()` as the very first operation inside the click handler, before any DOM changes.
- **Color Picker — Streamlined flow:** Eliminated the intermediate sub-panel step. Clicking "Color Picker" in the grid now directly triggers the overlay on the page (2 fewer clicks). Flow: grid button → black 20% overlay with red "CLICK TO ACTIVATE MAGNIFIER" button → native EyeDropper with magnifier → color copied.
- **Color Picker — CSS fallback fix:** `rgbStringToHex` regex updated from `rgba\(` to `rgba?\(` to correctly parse both `rgb()` and `rgba()` values returned by `getComputedStyle`. Added DOM traversal to find the nearest non-transparent background when the clicked element has no background color.
- **Screenshot — "Open after capture" toggle:** New checkbox in the Screenshot panel. When enabled, captured screenshots automatically open in a new browser tab.
- **Element Picker — XPath mode:** Added "Element XPath" button alongside "Element HTML". Activates a picker that copies the XPath of the clicked element, with a confirmation toast.

---

## Overview

Digital Detective centralizes 12 tools in one plugin UI:

1. Color Picker
2. Screenshot
3. Element Picker
4. DS Extractor
5. Component Blueprinter
6. Match Analysis
7. Lighthouse Audit
8. SEO Analysis
9. AEO Analysis
10. Event Tracker
11. Script Finder
12. **Script Match** *(new in v1.8)*

The extension opens interactive panels from the popup and generates visual reports in new tabs.

## Main Features

- Unified popup with 2-column tool grid and expand/collapse behavior.
- Tooltip descriptions on hover for each tool button.
- Inline workflows for DS Extractor and Component Blueprinter.
- Full-page and scoped Design System reports.
- SEO, Lighthouse, and AEO analysis reports.
- Event tracking for Segment/Rudderstack style events.
- Script discovery, copy, block, and re-enable flow.
- Script comparison between two pages with match scoring and vendor detection.
- Shared report design system (tokens and layout) across report pages.

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript
- HTML + CSS
- Chrome APIs: `tabs`, `scripting`, `downloads`, `storage`, `declarativeNetRequest`

## Project Structure

```text
Digital Detective v1.8/
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
|-- script_match.html       ← new
|-- script_match.js         ← new
|-- lighthouse_report.html
|-- lighthouse_report.js
|-- seo_report.html
|-- seo_report.js
|-- aeo_report.html
|-- aeo_report.js
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
4. Select this project folder (`Digital Detective v1.8`).
5. Pin the extension and open the popup.

## How To Use

1. Open any HTTP/HTTPS page.
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
- `*_X_*_Script_Match_Report_*.html`
- `template_ds.html` (base visual template for report standardization)

Reports are generated on demand and can be saved locally via each report's `SAVE HTML` button.

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
- Keep UI and report standards consistent with the v1.8 design language.

## Version

- Current: **v1.8**
- Footer standard: `Digital Detective v1.8 - Developed by Camilo Mello`

## Author

Camilo Mello camilofmello@gmail.com
