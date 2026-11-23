# CCC Sharing Economy Index 2026 dashboards

Seven independent dashboards and a combined tabbed explorer for the Consumer Choice Center Sharing Economy Index 2026. Each page has its own URL and relevant controls, with CCC-attributed PNG export and an accessible data table. The individual pages have no dashboard switcher or embed dialog. The combined explorer has a top tab bar for switching among all seven views.

Repository: [Consumer-Choice-Center/ccc-sharing-economy-dashboards](https://github.com/Consumer-Choice-Center/ccc-sharing-economy-dashboards). This repository contains source and assets; hosting is managed separately. No automated deployment is configured.

## Pages

| Dashboard | URL path | Main controls |
| --- | --- | --- |
| **All dashboards** | `combined/` | Seven tabs, each retaining its own controls and filter settings |
| World map | `map/` | Geography, official/custom scoring, weights, camera, tilt, height |
| City rankings | `rankings/` | Geography, top cities, pinned city, optional custom scoring |
| Category scores | `categories/` | Geography, category, number of displayed cities |
| City comparison | `compare/` | City selectors, + Add city, remove city, gap sorting, differences |
| City × category heatmap | `heatmap/` | Geography, categories, sorting, grouping, display count, differences |
| City score distributions | `distributions/` | Geography, highlighted city |
| Ranking movement | `ranking-movement/` | Geography, category weights, display count, sorting |

The root page links to the combined explorer and the seven standalone pages. They share implementation, fonts and data but load independently. Non-map pages do not fetch the map geometry files.

## Run locally

Requires Node.js 22 or later. No package installation, API keys, map token, or external runtime service is required.

```sh
npm test
npm run build
npm run preview
```

Open `http://127.0.0.1:8766/`. Stop with Ctrl+C. Set `PORT` to use another port. Use HTTP rather than opening HTML directly from the filesystem, because the pages load JavaScript modules and JSON.

`npm test` checks scores, filters, ranks, ties, zero weights, comparison selections, heatmaps, chart geometry, map height scaling, tilt bounds, route generation and local asset paths. It also builds the pages. `npm run build` generates `site/`, which is ignored by Git.

## Repository structure

```text
src/combined.html           Combined explorer with top tabs
src/dashboard.html          Shared standalone page template
src/dashboards.json         Seven route definitions
src/scoring.html            Optional scoring controls
src/map-tools.html          Map-only camera controls
src/shared/                 Chart modules, styles and assets
scripts/                    Build, preview and verification
site/                       Generated static site (not source)
```

Edit `src/`, then rebuild. All internal URLs are relative, so the dashboards can be served from a website root or a subdirectory. The page’s route fixes its dashboard; legacy query state cannot switch it to another dashboard. Reset clears filters while retaining the page.

## Build and hosting

Clone the repository, then use the commands above to test, build and preview. Commit changes to `src/` and the supporting scripts; `site/` is generated and ignored by Git.

The generated `site/` directory can be served by any static web server, including the CCC website’s existing hosting. Preserve its folder structure so each dashboard can load the shared assets.

## Embed the combined explorer

Use `combined/` as the iframe URL for one switchable dashboard. Append a hash to choose the initial tab, for example `combined/#heatmap` or `combined/#ranking-movement`. The default is the world map.

Views load on first selection and retain their own filters, selected cities and map camera while switching. Each tab keeps its relevant controls and CCC-attributed PNG export. Arrow keys, Home and End move focus among tabs; Enter or Space activates a tab. The inner dashboard resizes to its content without a second page scrollbar; the host webpage still controls the outer iframe height.

```html
<iframe
  src="https://YOUR-HOST.example/dashboards/combined/"
  title="CCC Sharing Economy Index 2026 — All dashboards"
  width="100%"
  height="1200"
  style="border:0;display:block"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin">
</iframe>
```

Serve the complete generated `site/` directory together: the combined explorer reuses the seven dashboard pages and shared assets. It does not enable or require GitHub Pages.

## Embed individual pages

There is no embedding UI in the dashboards. Once published, use the page URL directly in the index website’s HTML block:

```html
<iframe
  src="https://YOUR-HOST.example/dashboards/heatmap/"
  title="CCC Sharing Economy Index 2026 — City and category heatmap"
  width="100%"
  height="1100"
  style="border:0;display:block"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin">
</iframe>
```

Replace the example hostname, base path and route with the actual hosted location. Use a descriptive title for each dashboard. Start with 1100px height and adjust in the host webpage; these are independent documents and do not automatically resize the parent iframe. Long charts and narrow layouts retain their own scrolling. For mobile, allow the iframe to span its container’s full width. No `embed=1` or `standalone=1` parameters are needed.

## Data and scoring

The prepared dataset contains 70 cities, 52 countries and 10 categories, extracted from `Sharing Economy Index 2026.xlsx` (Research and RankingsFinal sheets). `src/shared/assets/data.json` retains the source workbook hash, notes, source URLs, original category points, final I-Distance scores and ranks. The workbook itself is not included. Approximate city coordinates and regional groupings support visualization.

Official scores and ranks remain the supplied study values. Ranking movement uses the initial I-Distance ranks on its left side and exploratory weighted raw-point ranks on its right; this is a comparison of methods, not movement over time. Kyiv starts at #1, Nashville at #2 and Buenos Aires at #4. Custom ties legitimately share a rank. Geography filters do not recalculate global ranks.

Custom score = 100 × Σ(weight × category points) ÷ Σ(weight × category maximum). All-zero weights produce no score. Category charts use percentages of each category maximum, independently of custom scoring. The map preserves the orange column clusters, enhanced cubic height scale, left-drag rotation and 35–65° tilt range.

Every PNG includes Consumer Choice Center / CCC research attribution and the active scoring context. The heatmap exports the current filtered chart including rows beyond its scroll viewport.

## Attribution and rights

Research and branding: Consumer Choice Center. This preparation does not assign a new open-source license to CCC’s code, research or brand assets. A public repository does not itself grant a general reuse license; CCC can add its chosen license separately.

Map geometry: [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), public domain. Montserrat and DM Mono are distributed under the SIL Open Font License; notices are included in `src/shared/assets/licenses/` and copied into the deployed assets.
