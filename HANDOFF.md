# Airlinq IoT Platform — Handoff

_Written 2026-09-03 from the full working session that built and deployed the demo. Read top to
bottom once; afterwards §4 (deploy), §6 (what is configured on the platform) and §10 (gotchas)
are the parts you will come back to._

> **Credentials are not in this file and must never be committed.** Everything sensitive lives in
> two gitignored files at the repo root that you need to get from Siddhika directly:
> `.env` (server address + SSH user/password, MQTT provisioning key/secret) and `CLAUDE.md`
> (the three platform logins, the PostgreSQL password, plus a "gotchas" list that this document
> supersedes). `.gitignore` already covers both, plus `*.orig`. Check with
> `git check-ignore .env CLAUDE.md` before every push — it was silently broken once (§10.3).

---

## 1. What this is

A fork of **ThingsBoard 4.4.0-SNAPSHOT** (Apache-2.0; Java 25 + Angular 20) rebranded as the
**Airlinq IoT Platform**, deployed as a monolith on a single air-gapped VPN-only CentOS Stream 9
server, running a **container-terminal demo**: 11 simulated shipping containers in three stacks at
Chennai Port publish tilt / acceleration / shock / cargo climate / twistlock state over MQTT once a
minute; profile-level calculated fields derive a tilt magnitude and raise CRITICAL "Container
misalignment" alarms; a 19-widget home dashboard ("Container Operations") visualises the yard.
The stated end goal is an AI use case around **container stack alignment**.

Three layers, and it matters which one a change belongs to:

| Layer | Where it lives | How it is deployed |
|---|---|---|
| Code (UI branding, theme switching, menu gating, simulator) | this git repo | Maven build → RPM → `rpm -Uvh` on the server (§4) |
| Platform configuration (profiles, calculated fields, assets, dashboard, custom widget, users) | **tenant data in PostgreSQL on the server — not in git** | REST API / UI; export JSON if you want it versioned (§6) |
| Server provisioning (JDK 25, firewall, systemd units, simulator install) | done by hand on the box | §4.1 |

---

## 2. Repositories, branches, PR state

| Remote (local name) | URL | State |
|---|---|---|
| `origin` | `github.com/siddhika-tm/thingsboard-aq` | `master` = upstream ThingsBoard `f872e94`; feature branch `airlinq-branding-and-container-demo` pushed, tracking set |
| `airlinq-air` | `github.com/peeyush-tm/airlinq-air` (private) | Was an **empty** repo (one "Initial commit", README only). Seeded 2026-09-03 via a merge commit that grafts that README commit onto the fork's history; branch `airlinq-branding-and-container-demo`, **PR #1 → master** open |
| `upstream` | `github.com/thingsboard/thingsboard` | pristine upstream, for rebasing |

The Airlinq work is four commits on top of upstream, deliberately kept separate so they can be
reviewed and rebased independently:

```
74b7145 Style the side navigation for dark theme
a32c7c1 Style the user menu popover for dark theme
c4ee6a1 Add in-app light/dark theme switching
0e39b20 Rebrand UI to Airlinq and add container fleet simulator
```

Two further commits were added on 2026-09-03 and carried onto the seeded branch (PR #1)
by cherry-pick: `e7a0d83` (this handoff) and `1d52e84` (dark theme default + contrast, §8).

**About PR #1 on peeyush-tm/airlinq-air:** because the base branch was an unrelated one-commit
repo, GitHub shows the *entire* upstream codebase as the diff (~10k files). Review the four
commits above instead. If a clean history is preferred there, the alternative is to force-push the
fork's history to that repo's `master` and close PR #1.

Git auth: `peeyush-tm/airlinq-air` is private, and the `store` credential helper on this laptop
has no credential for it — plain `git push` returns "Repository not found". Pushes were done with
a throwaway `GIT_ASKPASS` script that echoes a token from the environment; do the same rather
than embedding a token in a URL (it ends up in shell history and error output).

---

## 3. Toolchain and build

**JDK 25 is mandatory, at build time and at runtime.** The root pom sets
`maven.compiler.source/target=25`, so class files are version 69.0. The RPM's `requires`
clause (`packaging/java/build.gradle:109-111`) advertises java 17/21/25 — that metadata is wrong;
against Java 21 the package installs cleanly and then dies at class load with
`UnsupportedClassVersionError`.

On the laptop used so far neither tool is on `PATH`: Maven is `~/apache-maven-3.9.16/bin/mvn`
and JDK 25 is `~/.local/opt/jdk-25.0.4.1+1` (the system `java` is 21, which Maven will silently
pick up and then fail on). Export `JAVA_HOME` to the JDK 25 directory and prepend both `bin`
dirs before any `mvn` command; `mvn -v` must report `Java version: 25`.

`license:check` runs on the root project and scans the working tree, **not** just tracked
files. `container-sim/.venv` (a Python virtualenv the sim README tells you to create) makes it
fail with ~1100 "missing header" errors; the pom now excludes `**/.venv/**`, but delete a stray
venv before building anyway. The sim's own `container_sim.py` carries the Apache header (added
via `mvn license:format`, which maps `.py` to `#`-comment style and preserves the shebang);
`container-sim/requirements.txt` is pom-excluded because `.txt` maps to raw-text headers that
would corrupt the pip file.

Node v22.22.2 and Yarn 1.22.22 are **not** system prerequisites: `frontend-maven-plugin`
downloads them into `ui-ngx/target/` during the build. The build therefore needs internet
(Maven Central, nodejs.org) — it cannot run on the server (§4.1).

```bash
# Dev loop: everything compiled, no tests, no OS packages (~build.sh)
mvn -T6 clean install -DskipTests -Dpkg.skip=true

# Installable RPM (what actually gets deployed). Keep the boot jar — the RPM wraps it.
mvn -T6 clean install -DskipTests --projects application --also-make \
    -Dpkg.skip.deb=true -Dpkg.skip.zip=true
#  -> application/target/thingsboard.rpm   (plus thingsboard-*-boot.jar)

# UI only
mvn install -DskipTests --projects ui-ngx
```

A full RPM build takes roughly half an hour on the laptop used so far. `license:check` runs in
every build (`-Dlicense.skip=true` to bypass; `mvn -T 1C license:format` to fix headers).
`TEST_FAST.md` documents the `pkg.skip.*` flags and the sharded test recipe — do **not** run
`mvn test` at the root naively, it exhausts memory.

**Fast UI iteration against live data:** `cd ui-ngx && yarn start` (uses the Node/Yarn under
`ui-ngx/target/` if you add them to PATH) serves on :4200 with `proxy.conf.js` forwarding
`/api`, `/static/*` and the websocket. Point `forwardUrl` / `wsForwardUrl` at the demo server
(address from `.env`) for a seconds-long edit cycle with real telemetry; don't commit that edit.
`yarn prepare` runs `patch-package --error-on-fail` — the patches in `ui-ngx/patches/` are
load-bearing.

**CI gates that are easy to trip:** every source file needs the Apache header from
`license-header-template.txt` (15–17 lines depending on comment syntax — reconstructing a file
from `head -16` leaves an unterminated `<!--` and a baffling `NG5002: Unexpected character "EOF"`);
every key in `application/src/main/resources/thingsboard.yml` and `transport/*/…/tb-*-transport.yml`
needs a description comment (`tools/src/main/python/check_yml_file.py`).

---

## 4. Deployment

### 4.1 The server (facts, verified 2026-09-01 → 03)

Address, SSH user and password: `.env` → `SERVER IP`, `USERNAME`, `PASSWORD`. Reachable over
the corporate VPN only. Plain HTTP on :8080, no TLS.

- CentOS Stream 9, x86_64, 8 vCPU, 7.5 GB RAM, SELinux enforcing, passwordless sudo for the user.
- **Air-gapped**: no outbound internet, no DNS. Only `dnf` repos are local ISO mounts
  (`file:///mnt/BaseOS`, `file:///mnt/AppStream`), which top out at java-21. Anything else is
  copied in by scp. Docker/podman-compose path is not viable; monolith only.
- Pre-existing and shared — reuse, don't disturb: **PostgreSQL 16.1** (`listen_addresses=localhost`,
  password auth), **nginx** on :80/:443, `airnoc.service` (Airlinq SRE agent, uvicorn on
  127.0.0.1:8000). ThingsBoard uses :8080 and :1883; `firewalld` has exactly those two opened
  (`1883/tcp 8080/tcp`). CoAP/LwM2M/SNMP UDP ports are closed — not needed for the demo.
- **JDK**: Temurin 25 (`openjdk 25.0.4.1 LTS`) extracted to `/opt/jdk-25.0.4.1+1` and registered
  with `alternatives --install /usr/bin/java java /opt/jdk-25.0.4.1+1/bin/java <prio>`;
  `alternatives --display java` must point there. java-21 from AppStream is also present — if
  `java -version` ever shows 21, the service will not start.
- **Installed package**: `thingsboard-4.4.0~SNAPSHOT-1.noarch`; systemd unit `thingsboard`
  (active). Layout: `/usr/share/thingsboard` (jar, bin, extensions), `/etc/thingsboard/conf`
  (→ `…/conf`), `/var/log/thingsboard`. `thingsboard.conf` there is the env file holding the DB
  URL/user/password; it is `CONFIG|NOREPLACE`, so upgrades preserve it (md5 `70f411b5…` as of
  2026-09-03 — compare after every upgrade). The initial install ran
  `install.sh --loadDemo`, which is why the stock ThingsBoard demo accounts and dashboards exist (§12).
- **Simulator** runs on the same box as `airlinq-container-sim.service` (§5).

### 4.2 Upgrade procedure (what has worked three times)

```bash
# 1. laptop: build the RPM (§3), then fingerprint it
md5sum application/target/thingsboard.rpm

# 2. laptop: transfer — ONE session at a time, and wait for the process, not the file size
rsync -av --progress application/target/thingsboard.rpm <user>@<server>:/tmp/thingsboard.rpm
#    (scp works too; the point is a single writer per destination path)

# 3. server: verify before touching anything
md5sum /tmp/thingsboard.rpm            # must equal step 1
md5sum /etc/thingsboard/conf/thingsboard.conf

# 4. server: upgrade in place (same version string every time, hence --force), restart
sudo rpm -Uvh --force /tmp/thingsboard.rpm
md5sum /etc/thingsboard/conf/thingsboard.conf   # unchanged
sudo systemctl restart thingsboard
sleep 30; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/login   # 200

# 5. laptop: look at the actual page (§9) — API 200 is not proof the UI works
```

Rollback = repeat step 4 with the previous RPM (keep one). The database schema has not changed
across any Airlinq build, so no upgrade scripts are involved; if you ever rebase onto a newer
upstream, read `application/src/main/data/upgrade/`.

### 4.3 Transfer pitfalls (both bit us)

- **Path-MTU blackhole on the VPN.** Interface MTU 1500, path MTU ~1436 (strongSwan IPsec,
  routing table 220), PMTU discovery filtered. Symptom: SSH and small HTTP work, bulk transfers
  hang or the VPN drops (happened six times in three days). Fix on the laptop:
  `sudo ip link set dev <vpn-iface> mtu 1400` — never applied so far because it needs local sudo.
- **Never run two transfers to the same destination path.** A second `rsync` started on the
  assumption the first had finished (judged by file size) produced an RPM with the right size and
  the wrong md5. Check the process list, then md5 on both ends, every time.

---

## 5. The simulator (`container-sim/`)

`container_sim.py` — one Python process, N devices, stdlib + `paho-mqtt`. `README.md` in the
folder is the reference for CLI flags, the MQTT contract and the published keys; the essentials:

- **Provisioning**: ThingsBoard's two-session handshake — connect as user `provision`, publish to
  `/provision/request`, read the token from `/provision/response`, reconnect with the token.
  Key/secret come from `.env` (`PROVISION DEVICE KEY` / `PROVISION DEVICE SECRET`) and are passed
  as CLI arguments — never embedded. The device profile's provisioning strategy is
  *allow creating new devices*.
- **Data**: telemetry to `v1/devices/me/telemetry` (tilt_x/tilt_y, accel, shock, temp, humidity,
  twistlock_*, phase, lat/lon), client attributes (container id, slot) to
  `v1/devices/me/attributes` on a slower `--status-interval`. Devices are laid out in
  **bay/row/tier stacks** around **Chennai Port (13.1012 N, 80.2968 E)** — coordinates supplied
  by the user, ~0.000135°/row and ~0.00024°/bay apart. Some devices hold a `MISALIGNED`
  attitude so that alarms exist; under `--scenario mixed` the count drifts (5–7 of 11 on 2026-09-03).
- **Phase desync**: each device skips a seeded random number of phase steps at start, so eleven
  devices do not move in lock-step.

**On the server** (`/opt/airlinq-container-sim/`, with a vendored `paho/` because there is no pip
there), as `airlinq-container-sim.service`:

```
ExecStart=/usr/bin/python3 -u /opt/airlinq-container-sim/container_sim.py \
    --host 127.0.0.1 --port 1883 --devices 11 --interval 60 --scenario mixed --seed 7 --status-interval 300
Restart=always
```

To change the fleet: edit the unit (`systemctl edit`/`daemon-reload`/`restart`). Adding devices
above 11 creates new `CONTAINER-SIM-NN` devices through provisioning; they will need to be
related to a stack asset (§6.3) to show up in roll-ups.

---

## 6. Platform configuration (tenant data — lives only on the server)

Log in as the tenant admin `tenant@airlinq.com` (password in `CLAUDE.md`). IDs below are the
live ones; they change if anything is recreated.

### 6.1 Device profile `Container` (`f6031d90-a6a5-11f1-8df7-3dda3618c009`)

All rules are **profile-level**, applying to every Container device (they were per-device in the
first cut and were refactored; nothing per-device remains — verified). The rule chain is the stock
Root Rule Chain; all logic is in calculated fields:

| Calculated field | Type | Definition |
|---|---|---|
| `tilt_magnitude` | SIMPLE | `sqrt(tilt_x*tilt_x + tilt_y*tilt_y)` from latest telemetry |
| `Container misalignment` | **ALARM** | CRITICAL when `tilt_magnitude > 3` held for a duration (configured ~10 s); clears when `tilt_magnitude <= 2`; details "Resting tilt exceeds 3 deg - stack alignment fault"; not propagated |

> The REST listing `GET /api/calculatedField/DEVICE_PROFILE/{id}` **omits ALARM fields unless
> you pass `?type=ALARM`**, despite the docstring saying all types are returned. Spent a while
> hunting for where the alarms came from because of this.

### 6.2 Asset profiles

- `Yard` — `Yard roll-up` (RELATED_ENTITIES_AGGREGATION over contained stacks) and
  `yard_health_pct` (SIMPLE). The SIMPLE evaluator has **no ternary operator** — a formula with
  `? :` fails silently in the UI; `/api/calculatedField/{id}/debug` shows
  `Operator is unknown for token`.
- `Container Stack` — `Stack alignment roll-up` (RELATED_ENTITIES_AGGREGATION over contained
  containers: worst / average tilt, counts).

### 6.3 Assets and topology (relation type `Contains`)

```
Chennai Port Container Yard (Yard)
├── Stack B12-R3 (Container Stack, "Bay 12 / Row 3") → CONTAINER-SIM-01..04
├── Stack B12-R4 (Container Stack, "Bay 12 / Row 4") → CONTAINER-SIM-05..08
└── Stack B13-R3 (Container Stack, "Bay 13 / Row 3") → CONTAINER-SIM-09..11
```

Assets are the topology; dashboards use them as entity aliases and the aggregation fields walk
the relations. 20 devices total: the 11 containers plus 7 `default` and 2 `thermostat` devices
from `--loadDemo`. Customer A has `CONTAINER-SIM-01/07/11` assigned (an arbitrary slice — a
policy for what a customer should see was discussed but never decided).

### 6.4 Dashboard `Container Operations` (`44076f90-a5f3-11f1-8cd8-d5f3ffee79db`)

Set as the tenant-wide home dashboard (Settings → Home settings). 19 widgets: four KPI value
cards (Containers, Stacks, Misaligned, Worst tilt), a fleet-health progress bar, the yard map
(OpenStreetMap, red pins = misaligned), five ECharts time-series/bar charts (alignment, stack
comparison, handling, cargo climate, 6-hour trend), an alarms table, three radial gauges (one per
stack — a multi-entity alias renders a single value, hence three widgets), a doughnut of
misaligned-by-stack, a state chart of the focus container's phase, a timeseries table, and the
custom **corner-state** widget. Version 34 as of 2026-09-03.

The stock demo dashboards (Firmware, Rule Engine Statistics, Software, Thermostats) are still
present; deleting them was offered and not yet approved.

### 6.5 Custom widget `tenant.airlinq.container_corner_state`

Widget type "Container corner state" (`4f0b6290-a704-11f1-8df7-3dda3618c009`): one card per
container showing the four twistlock corners as a plan view, resting tilt, and phase. Plain
`templateHtml`/`templateCss`/`controllerScript`; `ctx.data` is `[{datasource, dataKey, data:[[ts,value]]}]`.
Its colours are CSS custom properties on `.aq-cc-root`; on 2026-09-03 they were retuned to
theme-neutral values (`--aq-ink: inherit`, translucent surfaces, mid-tone status colours) because
widget `templateCss` is namespaced under the widget's own class and **cannot select an ancestor
`.tb-dark`** (§7.2).

### 6.6 Accounts

| Role | Username | Notes |
|---|---|---|
| System admin | `sysadmin@airlinq.com` | |
| Tenant admin (use this) | `tenant@airlinq.com` | owns everything above |
| Customer user | `customer@airlinq.com` | Customer A |

Passwords: `CLAUDE.md`. The ThingsBoard `--loadDemo` accounts are **still active with their
published default passwords** — see §12.

---

## 7. UI customisation (code, all under `ui-ngx/src/`)

### 7.1 Branding (`0e39b20`)
- Palettes renamed/re-valued in `theme.scss` (`$tb-mat-teal`, `$tb-dark-mat-teal`; dark surface
  `#12161d`), colours in `scss/constants.scss` (`$tb-primary-color: #0b6b78`, secondary `#0e7f8e`,
  dark primary `#37b6c9`).
- Logos replaced in `assets/*.svg`, favicon `airlinq.ico`, `<title>Airlinq</title>` and
  `theme-color` in `index.html`; footer `Copyright © {{year}} Airlinq.`; dashboard footer
  "Powered by Airlinq v."; GitHub-star button removed from the toolbar; one locale string edited
  textually (a `json.dumps` round-trip reformatted the whole file into a 21k-line diff — don't).
- Login page restyled to match the Airlinq SRE console (`modules/login/pages/login/*`). It is a
  **light** design; if dark becomes the default (§8) it needs a dark variant.
- `menu.models.ts`: `unavailableOffline` filter hides `iot_hub`, `repository_settings`,
  `auto_commit_settings`, `mobile_center`, `mobile_apps`, `mobile_bundles`,
  `mobile_qr_code_widget`, `oauth2`, `domains`, `clients`, `gateways` — features that need
  outbound internet the server doesn't have. Notifications (email/SMS) deliberately kept.
- License headers on the 3,240 upstream files untouched (Apache-2.0 compliance).

### 7.2 Theme switching (`c4ee6a1`, `a32c7c1`, `74b7145`) — the architecture you must know

- `core/services/theme.service.ts`: `BehaviorSubject`, `isDark`, `toggle()`, `setDark()`;
  persists `localStorage['tb-theme']` (`'dark'`/`'light'`) and toggles class **`tb-dark` on
  `<body>`**. **Dark is the default** — anything but an explicit `'light'` is dark. Switching
  **reloads the page**: widgets resolve theme-dependent inline colours (chart legends, panel
  backgrounds) once at init, so a class flip alone left them stale. Toggle lives in the user
  menu (`shared/components/user-menu.component.*`).
- `index.html` has a boot script right after `<body class="tb-default">` that applies the stored
  (or default dark) class before Angular loads — no flash of the wrong theme, including on the
  reload after a switch.
- `dashboard-page.component.html` binds `[class.dark]` on the `.tb-dashboard-page` root from
  `ThemeService`. `TbTimeSeriesChart` (time-series / bar / state / range charts) switches its
  canvas colour scheme on that class and watches it with a `MutationObserver`; upstream shipped
  the mechanism but nothing ever set the class.
- **Semantic token layer (`--aq-*`).** `styles.scss` defines one set of CSS custom
  properties per theme: light values on `.tb-default`, dark values on `.tb-dark` (both sit on
  `<body>`; dark wins by source order). Tokens cover the surface hierarchy
  (`--aq-bg` page -> `--aq-sidebar`/`--aq-header` chrome -> `--aq-surface` card -> `--aq-elevated`
  overlays), text tiers (`--aq-text`/`-2`/`-3`/`-disabled`), borders, hover/selected,
  accent + status, and chart (`--aq-chart-grid`/`-axis`/`-label`/`-tooltip-bg`/`-cursor`).
  Component rules consume `var(--aq-*)`, so the same token drives every component and dark is a
  designed hierarchy, not one flat colour. Add a new colour by adding a token, not a hardcoded
  hex. The dark chart-token hex values are mirrored in `chart.models.ts` `chartColorScheme`
  (canvas can't read CSS) — keep the two in sync.
- **`.tb-dark` is a colour overlay, not a standalone theme.** Material emits it alongside
  `.tb-default`; both classes sit on body. Consequences:
  - All theme colour lives in `styles.scss` under two blocks marked `AIRLINQ THEMING` (~line
    1410 onward): a `.tb-default {…}` block and a `.tb-dark {…}` block at **equal specificity, dark
    second, so source order wins**. Do not raise specificity in one without the other.
  - A dashboard's own `dashboardCss` is namespaced by `cssjs` under
    `.tb-default .tb-dashboard-page-css-<guid>` (three classes) and would out-specify anything
    keyed on `.tb-dark` — so dashboardCss is for layout only, never colour.
  - Widget `templateCss` is namespaced under the widget's class, so `.tb-dark .foo` inside it
    becomes `.tb-widget-x .tb-dark .foo` and never matches. Use inheritance/translucency (§6.5).
  - Components that set colours in their **own** stylesheets (side menu, menu-link, menu-toggle
    via `--mat-button-text-label-text-color`) and **CDK overlays attached to `<body>`** (user
    menu popover) inherit `.tb-dark` but no dark styling — each needs an explicit override.
    Popover and sidenav are done; dialogs, selects, tooltips and the entity-details drawer have
    **not** been swept.
- Guard each CSS block with a unique marker comment and assert on it in scripts: an earlier
  "fix" was silently a no-op because its guard matched a class that already existed.

---

## 8. Dark theme — implemented 2026-09-03 (commit `1d52e84`)

The request: dark as the default app-wide; the chart grid was too faint in dark; fix grid /
background / line contrast consistently across every screen that uses a grid; leave light alone.

### 8.1 What changed (all code; light rules untouched, every new rule scoped to `.tb-dark`)

| Where | Change |
|---|---|
| `index.html`, `theme.service.ts` | Dark is the default; only a stored `'light'` opts out. Theme switch reloads the page (see §7.2). |
| `dashboard-page.component.{html,ts}` | `[class.dark]` on the dashboard root from `ThemeService` — turns on upstream's dormant chart dark scheme. |
| `widget/lib/chart/chart.models.ts` | `chartColorScheme` dark values retuned for the `#12161d` surface: split lines `#566070` (~3:1, was `#484753` at ~2:1), axis text `#aab4c2`, axis lines/ticks `#7d8898`, labels `#e8ecf2`. |
| `shared/models/widget-settings.models.ts` | `themeAwareBackgroundColor()`: when body has `tb-dark`, an opaque light widget background (stock default `#fff`) becomes transparent so the themed card shows through. Used by `backgroundStyle()` → all 27 widget components. |
| `time-series-chart-widget.component.ts`, `latest-chart.component.ts` | DOM legends (both chart families) remap their stored light-default colours through `prepareChartThemeColor`. |
| `styles.scss` `.tb-dark` | `body.tb-dark` / `.mat-app-background` dark (Material's `app-background` is a light-only include); entity-table containers, table toolbar + icons, sticky cells, paginator; brighter table separators (`#2b3442`, header `#323b48`); softened angular-gridster2 edit-mode grid. |
| `login.component.scss` | `:host-context(body.tb-dark)` variant of the login card tokens. |

Verified on the dev server against live data before building: Container Operations (dark and
light), Rule Engine Statistics (stock JSON — proves the default-colour remap), Thermostats
(sticky cells), Devices and Alarms pages (dark and light), login. The probe from §9 reports no
opaque light element in dark on any of them except map tiles.

**Redesigned into a semantic token system, all contrast leaks fixed, deployed 2026-09-04.** RPM `b2382661…` built (JDK 25, `-Ppackaging`, no skip
flags — see §3 and §4.2), transferred, installed with `rpm -Uvh --force` (config md5 unchanged,
service up in 33 s), and the served bundle confirmed to carry the new boot script. On the live
server, the default (no stored preference) now renders dark with all 19 Container Operations
widgets legible and gridlines visible — produced by the code against the reverted stock
dashboard data (§8.2) — and the light theme is unchanged. Verified by headless-Chrome screenshot
in both themes (§9).

### 8.2 Data-side consequence

With the code owning theming, the 2026-09-03 *data* patches to Container Operations (neutral
`#7a8494` axes, translucent grid, `#8d97a5` legend, transparent backgrounds) are redundant for
the ECharts widgets and, being non-default values, are **not** remapped by `chartColorScheme`.
They are reverted to stock defaults after deploy (`rgba(0, 0, 0, 0.54)` axes, `rgba(0, 0, 0,
0.12)` split lines, `rgba(0, 0, 0, 0.76)` legend, `#fff` background) so light gets the stock
look back and dark is produced by code — and any *new* widget is correct in both themes with no
per-dashboard work. The canvas-gauge (`colorPlate`, tick/number colours) and value-card
`dateColor` tweaks stay: no code path themes those, and they read acceptably in both themes.

### 8.3 Remaining gaps (cosmetic, not blocking)

- Map widgets use light OpenStreetMap tiles in dark (a dark tile layer such as CartoDB
  dark_matter would change the light look too — a product call).
- Radial gauges keep their bright chrome bezels (canvas-gauges, no theme awareness).
- ECharts `dataZoom` slider stays light-blue in dark.
- Pie/doughnut *canvas* labels are not remapped (only their DOM legends are); polar/radar and
  the bar-with-labels widget have their own light-default label colours.
- CDK overlays not yet swept: dialogs, selects, tooltips, the entity-details drawer.

### 8.4 Dark-theme QA checklist (verified on the live server, both themes)

Component-by-component audit at the screenshot viewport (1680 wide). Light re-checked for
regression on every row.

| Component | Dark | Light |
|---|---|---|
| Logo | ✓ white wordmark (theme-switched asset) | ✓ black wordmark |
| Header / breadcrumb / title / realtime | ✓ token-driven, primary/secondary/disabled | ✓ |
| Sidebar sections / items / icons | ✓ hierarchy, coordinated contrast | ✓ |
| Active nav item | ✓ accent tint + inset left bar + brighter label (not colour alone) | ✓ |
| Hover / disabled states | ✓ | ✓ |
| KPI cards / values / timestamps | ✓ card > page, number prominent, timestamp secondary | ✓ |
| Fleet-alignment progress track + fill | ✓ track visible (class !important over inline) | ✓ |
| Map panel / zoom controls | ✓ controls themed, basemap intact | ✓ |
| Chart grid / axes / labels / legend | ✓ grid ~3:1, text tokens | ✓ stock |
| Chart series colours | ✓ distinguishable on dark plot | ✓ |
| Chart tooltip | ✓ elevated dark surface, light text | ✓ |
| Chart dataZoom slider | ✓ explicit dark colours | ✓ light |
| Tables / sticky cells / paginator | ✓ | ✓ |
| Overlays: menus / selects / dialogs / tooltips | ✓ elevated surface, token text | ✓ |
| Focus rings | ✓ visible accent outline | ✓ |
| Borders / dividers | ✓ subtle, not dominant | ✓ |
| Light-theme leakage | none (probe finds no opaque light element except map tiles) | n/a |

Residual cosmetic (non-blocking): map basemap stays light in dark (a dark tile layer would
change light too — product call); radial-gauge chrome bezel stays bright (canvas-gauges have no
theme wiring); the progress-bar *fill* keeps its configured indigo (data colour, not a token).

### 8.5 Semantic token redesign + leak audit (2026-09-04)

The dark theme was rebuilt around the `--aq-*` token layer (§7.2): logo bound to the theme,
header/sidebar/KPI/overlay/chart/map treatments all token-driven, sidebar active state = accent
tint + inset bar. A WCAG near-black-text + light-surface audit was then run across the dashboard,
device list, alarms and account pages; every leak it found (sidebar user role, breadcrumb
entry/divider, default icon-buttons, data-cell icons, form subheaders/hints, unselected checkbox,
dashboard content wrapper) was remapped to tokens, and the re-audit reports **zero** text leaks
and zero light surfaces on all four routes (only near-black text left is the "Add device" label
on the teal accent button — intentional on-accent). Commits `6c96589` (redesign) and `2543637`
(leak fixes); live as of the deploy above.

> **Live-server headless screenshots don't work over the VPN** — the app bundle loads too slowly
> to bootstrap in headless Chrome (you get only the `tb-root` shell). Verify UI on the local dev
> server (`ng serve` proxied to the live server, §3) which renders instantly on the same code;
> confirm the deploy separately by checking the served bundle/CSS carries your change.

### 8.6 Shell redesign, treatment "C" (2026-09-04)

Visual direction chosen from three wireframed treatments: a floating icon rail and one rounded
content sheet on a tonal canvas (Material 3 look), same DOM, both schemes. CSS/SCSS only, one
TS line; no template changes, so upstream merges stay cheap. Design spec (local, gitignored
`docs/superpowers/specs/`) records the alternatives and the deferred `mat.theme()` migration.

| Where | Change |
|---|---|
| `styles.scss` token blocks | New tokens on both schemes: `--aq-sheet`, `--aq-accent-container`, `--aq-on-accent-container`, `--aq-gap`, `--aq-radius-{sm,md,lg}`, `--aq-shadow-1`, `--aq-rail-w`, `--aq-rail-w-open`; light `--aq-surface` is now a tonal step (`#f6f8fa`) so cards read on the white sheet; `--aq-header` transparent. |
| `styles.scss` shared rules | `.tb-widget` / `.tb-entity-table-content`: no border, 16 px radius, `--aq-shadow-1`; gridster + `.tb-main-content` use `--aq-sheet`; table toolbar transparent; overlays 12 px radius. Dark sidenav active state = filled accent-container pill (inset bar removed). |
| `home.component.scss` | Rail geometry: `left/top/bottom: var(--aq-gap)`, 16 px radius, 64 px collapsed / 250 px open; sheet margin follows the rail; toolbar transparent, no borders. Collapsed head = brand mark over an always-visible expand chevron, centred on the icon column. |
| `side-menu.component.scss` | Items are 12 px pills with 2 px gaps; colours via tokens (light and dark from one file). |
| `home.component.ts` | `menuCollapsed` user setting `undefined` → rail collapsed by default; an explicit `false` (pinned open) is honoured. |
| `login.component.scss` | Sass `$aq-*` constants replaced by the CSS tokens; the separate dark block is gone (tokens flip). |

| `styles.scss` `AIRLINQ GRID + DASHBOARD ANATOMY` | Applied from the design canvas (2026-09-04, both themes): entity-table card gets a 1px `--aq-border` outline; header band 44 px with 11 px uppercase labels and a 1px bottom rule; 1px row **and column** dividers (`--aq-border-subtle`); 48 px rows; hover `--aq-hover`, selected/current `--aq-selected`; selection toolbar = accent-container band; paginator top rule; pill (999px) outlined/flat buttons in table and dashboard toolbars; widget titles 14/600 and uppercase timewindow labels. |
| collapsed rail centring | Hidden nav labels still took flex space and pushed icons 6 px left of the brand mark; collapsed items are now `justify-content:center` with a zero-width label, and the user-menu button drops its gap. Measured: rail, mark, chevron, icons, avatar all at x = 40. |

| `theme.service.ts`, `index.html` | **Light is the default again (2026-09-04, product call).** Only a stored `'dark'` opts in; the boot script and `readStored()` both test `=== 'dark'`. Supersedes §8's "dark is the default". |

**Hover-expand was tried and removed.** Collapsed sections open as CDK flyout popovers outside
the rail, so a CSS `:hover` expansion collapses the instant the pointer reaches the flyout. The
pin button in the rail head is the only expand/collapse control; the sheet re-flows to match.

**Build notes (Windows laptop, portable JDK 25 + Maven 3.9.9 under `d:/tmp/tools`):**
- Any `-Dpkg.skip.*` flag activates a property profile, which switches off the `activeByDefault`
  `packaging` profile — you get a plain jar and no RPM. Build the reactor first
  (`mvn install -pl application -am -DskipTests -Dlicense.skip=true`), then package with
  `mvn install -pl application -Ppackaging -DskipTests -Dlicense.skip=true`.
- `frontend-maven-plugin` fails to extract yarn on Windows ("Could not rename versioned yarn root
  directory to dist"). Seed `ui-ngx/target/node/yarn/dist` from corepack's cache
  (`%LOCALAPPDATA%
ode\corepack1\yarn.22.22`) and pass `-Dskip.installyarn=true`.
- `mvn clean` on `ui-ngx` deletes `node_modules`; `license:check` fails on untracked
  `.superpowers/` HTML, hence `-Dlicense.skip=true` locally (all new files carry the header).
- Component styles ship inside the JS chunks, not `styles-*.css` — grep `public/main-*.js`
  to confirm a `home.component.scss` change made it into the bundle.

Deployed twice on 2026-09-04 with `deploy.py`-style flow: tar backup of `/usr/share/thingsboard`
+ `/etc/thingsboard` to `/tmp/thingsboard-backup-<stamp>.tar.gz`, previous RPM kept as
`/tmp/thingsboard.prev.rpm`, md5-verified upload, `rpm -Uvh --force`, conf md5 unchanged.

## 9. How to verify UI changes (don't trust the API)

Every "fixed" claim that was later wrong had been checked through the API instead of the page.
What works: headless Chrome driven over the DevTools protocol.

- Launch `google-chrome --headless=new --remote-debugging-port=9333 --remote-allow-origins=*
  --user-data-dir=/tmp/cdp-profile --window-size=1680,2600 about:blank`. Chrome 111+ rejects the
  websocket without `--remote-allow-origins`.
- **Never clean up with `pkill chrome`** — match `--user-data-dir=/tmp/cdp-profile` or kill the
  process group you started. The user's own browser was killed three times before that lesson.
- Authenticate by getting a JWT from `POST /api/auth/login` and navigating to
  `/dashboards/<id>?accessToken=<jwt>&refreshToken=<rt>` — `auth.service.ts` consumes those
  query params. Injecting `jwt_token` into localStorage alone leaves the app on the boot spinner
  because the `*_expiration` keys are missing.
- Set `localStorage.setItem('tb-theme','dark'|'light')` on the origin *before* the final
  navigation to test either theme; `removeItem` to test the built-in default (should be dark).
- `Page.captureScreenshot` with `captureBeyondViewport:true` for the whole dashboard; a
  `Runtime.evaluate` probe that walks `tb-dashboard *` and reports any element whose computed
  background is opaque and light finds white patches faster than eyeballing.

---

## 10. Gotchas, by area

### 10.1 Dashboard / widget JSON
- `timewindow.realtime.realtimeType`: `0` = LAST_INTERVAL (honours `timewindowMs`), `1` =
  INTERVAL (uses `quickInterval`, e.g. CURRENT_DAY). `1` silently fetches a whole day and every
  widget spins forever — this was in the dashboard from creation and survived two "fixes".
- A widget-level `timewindow` must be complete: a full `history` block plus
  `quickInterval`/`hideInterval`/`hideLastInterval`/`hideQuickInterval` under `realtime`.
  Partial objects load indefinitely.
- Aggregation bucket ≥ publish interval (60 s), or most buckets come back empty.
- `AVG` aggregation blanks string keys (`phase`, `twistlock_*`) — those need `agg: NONE` on their
  own window.
- `cards.timeseries_table` renders one table per entity — single-entity alias only.
- Build widget configs from `GET /api/widgetType?fqn=system.<fqn>` → `defaultConfig` and override
  only `datasources`/`title`. Hand-written `settings: {}` breaks widgets; `cards.value_card`
  defaults to `units: '°C'`.
- Entity aliases filtered by `deviceTypes` break when devices move to a new profile
  (`["default"]` → `["Container"]` after the refactor).
- In `dashboardCss`, a comment line immediately before `@media` breaks the `cssjs` parser and
  truncates the stylesheet; a blank line between them is fine.
- Radial gauge with a multi-entity alias shows one value — one gauge per entity.

### 10.2 Platform / API
- ALARM calculated fields are hidden from the default CF listing (§6.1).
- SIMPLE calculated fields have no ternary (§6.2).
- Widget-type `templateCss` and `dashboardCss` are namespaced (§7.2).

### 10.3 Process / ops
- After editing `.gitignore`, run `git check-ignore .env CLAUDE.md`. Appending without a trailing
  newline once produced the pattern `.envCLAUDE.md`, which un-ignored `.env`.
- When a build is wrapped in a shell that `echo`es its own status, a "exit code 0" notification
  means nothing — grep the log for `BUILD SUCCESS`.
- Verify a deployed fix in the page, not by re-running the API call that produced it.
- One rsync per destination; md5 on both ends; MTU (§4.3).
- Shell `while read` loops skip the last line of a file without a trailing newline —
  `CONTAINER-SIM-11` was missed three times that way.
- `pkill -f <pattern>` matches the command line of the shell you are running it from if the
  pattern appears there — it killed a 30-minute build before Maven started. Match on
  `/proc/<pid>/cmdline` of `pgrep -x node` (or similar) instead.
- `mvn clean` on `ui-ngx` deletes `ui-ngx/target/`, which is where the dev server's Node and
  Yarn live — stop `ng serve` before a Maven build.

---

## 11. Backlog (offered / discussed, not done)

- Dark-theme cosmetic gaps listed in §8.3 (overlay sweep, map tiles, gauge bezels, dataZoom).
- Delete the four stock demo dashboards; disable or re-password the ThingsBoard default accounts (§12).
- `stack_containers` should count the `container_id` attribute, not `tilt`.
- Simulator: read a shared attribute for publish interval so it can be changed from the UI;
  relate any newly provisioned device to a stack asset automatically.
- Decide Customer A's scope (mirror the tenant vs. a deliberate slice) and assign assets too.
- The demo runbook (sequence: provisioning → profile → calculated fields → dashboard) exists
  only as a chat artifact and is out of date; re-derive from §5–§6.
- Apply the VPN MTU fix locally (§4.3).
- Consider replacing PR #1's grafted history with a clean force-push to `peeyush-tm/airlinq-air:master`.

---

## 12. Security notes

- The `--loadDemo` accounts (`tenant@thingsboard.org`/`tenant`, `sysadmin@thingsboard.org`/
  `sysadmin`, `customer@thingsboard.org`/`customer`, `customerA/B/C@thingsboard.org`) are **live
  with the passwords published in ThingsBoard's own docs**. They, not the Airlinq accounts, are the
  real exposure; disable or re-password before the demo is shown beyond the team.
- The MQTT provisioning key/secret allow anyone on the VPN to create devices in the tenant.
- Everything is plain HTTP on :8080 behind the VPN; nginx on :80/:443 is available if TLS is
  wanted later.
- `.env` and `CLAUDE.md` hold every secret and are gitignored; `docker/.env` in the tree is
  upstream's unmodified file and contains none. A GitHub token used for the private repo lives in
  the developer's local `~/.claude/settings.json`, not in the repo.

---

## 13. Chronology

- **2026-09-01** — Server surveyed (air-gapped, PG 16 present). JDK 25 shipped in and registered.
  RPM built off-box, installed with `--loadDemo`; firewall opened for 8080/1883. Simulator written;
  provisioning key/secret created; first device publishing.
- **2026-09-02** — Rebrand to Airlinq (palette, logos, strings, login page, footer); offline
  feature gating; in-app theme switching; home dashboard built, iterated (KPIs, map, charts,
  gauges, alarms, custom corner-state widget); fleet grown to 11 devices; Chennai Port
  coordinates; rules and derived fields moved from per-device to profile level; assets and
  relations added; simulator deployed as a service; three `@airlinq.com` accounts created; code
  pushed; `peeyush-tm/airlinq-air` created (empty).
- **2026-09-03** — Dark-mode fixes for user-menu popover and side navigation deployed; dashboard
  widgets made theme-neutral (backgrounds, canvas colours) and verified in both themes; branch
  pushed to `origin`; `peeyush-tm/airlinq-air` seeded and PR #1 opened; this handoff written;
  dark made the default with chart grid / table / login contrast fixed in code (§8), verified
  on a live-data dev server, built and deployed.
