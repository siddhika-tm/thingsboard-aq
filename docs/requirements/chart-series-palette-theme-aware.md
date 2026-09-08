# Requirement (BACKLOG — not started) — Theme-aware chart series palette

- **Work item slug:** `chart-series-palette-theme-aware`
- **Mode:** dev
- **Status:** BACKLOG. Logged 2026-09-07 at the G1 of `airlinq-blue-light-recolour`, per the human's
  Q1 decision (option c: defer charts).
- **Author:** Jarvis (Product Manager)

## Why this exists

`airlinq-blue-light-recolour` was asked to apply the Airlinq Blue 14-colour chart series order to
the light theme. That turned out to be **impossible without an architecture change**, so charts were
carved out of that item and parked here.

## The blocking facts (already established, do not re-investigate)

1. **The series palette is not theme-aware.** `chartColorScheme`
   (`ui-ngx/src/app/modules/home/components/widget/lib/chart/chart.models.ts`:32–65) holds only
   axis/threshold/label chrome — eight entries, no series colours.
   The real palette is generated at module load in
   `ui-ngx/src/app/shared/models/material.models.ts`: `materialColorPalette` (:26–331, ~196 hex
   literals) feeds the loop at :339–355 to build `materialColors` (:333) — **140 entries, a flat
   list with no theme axis**. Series 0–13 are the Material `500` shades in `colorPalettes` order.
2. **It is consumed without a theme parameter.** `utils.service.ts`:247–250 `getMaterialColor(index)`
   is called from `widget-subscription.ts`:1460, `widget-config.component.ts`:837,
   `attribute-table.component.ts`:570, `flot-widget.ts`:1020,
   `map.models.ts`:377/385/580/634/688, `api-usage-settings.component.models.ts`:60/68/76.
   Any edit therefore changes **both** themes.
3. **Colours are persisted into saved widget configs.** `widget-subscription.ts`:1460 assigns
   `dataKey.color`, so already-saved dashboards may not pick up a palette change at all.
4. **`chartColorScheme[...].light` is not safe to edit either.** Its `.light` values are read at
   module load into widget `defaultSettings` (`chart.models.ts`:253,
   `bar-chart-widget.models.ts`:55, and ~6 more) and used **regardless of the active theme** — so
   editing a `.light` value changes what a **dark**-theme user sees on newly-created widgets.
   This is why chart chrome was ALSO deferred (AC-28 could not be satisfied).

## Scope when picked up

- Make the series palette theme-aware (a light/dark-keyed structure, and thread the active theme
  into `getMaterialColor`) — then apply the Airlinq Blue order to light only.
- **The saved-dashboard migration question must be answered first:** do existing dashboards keep
  their persisted `dataKey.color`, get migrated, or fall back to the new palette? This is a product
  decision, not a technical one.
- Chart **chrome** (axis, grid, threshold, tooltip) — deferred from the recolour item for reason 4
  above. Fixing the module-load/`.light` coupling is a prerequisite.
- The eight named aliases belong here, not in the recolour item:
  `--chart-uplink #7641f7`, `--chart-downlink #2067ff`, `--chart-total #18dbf2`,
  `--chart-line-primary #18dbf2`, `--chart-success #14b875`, `--chart-failure #dc4848`,
  `--chart-allocated #18dbf2`, `--chart-available #7641f7`.
- The Airlinq Blue series order:
  `1 #7f0597`, `2 #18dbf2`, `3 #7641f7`, `4 #6c7a89`, `5 #00b7ec`, `6 #fa9f42`, `7 #0166ff`,
  `8 #5333ed`, `9 #14b875`, `10 #1e824c`, `11 #e26a6a`, `12 #9a12b3`, `13 #ff9478`, `14 #fabe58`.
- Remaining untokenised legacy colour literals not covered by the recolour item's bounded sweep
  (see that item's §8 R8 and the sweep's leftover list).

## Accessibility constraint to carry forward

The supplied palette fails CVD adjacency (`#14b875` vs `#fa9f42`, ΔE 5.5) and `#fa9f42` / `#18dbf2`
sit under 3:1 on white. Charts must retain direct labels and legend chips — colour alone must never
be the only channel carrying series identity.

## Requires

A fresh G1 with its own acceptance criteria. An ADR is likely (introducing a theme axis into a
module-load-time colour map, and the migration policy for persisted colours).
