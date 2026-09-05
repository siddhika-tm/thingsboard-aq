# Overlay — tester — Airlinq IoT Platform

## Build / Test — exact commands
- Build command: `mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true` (packaging pass: `mvn install -pl application -Ppackaging -DskipTests -Dlicense.skip=true` → `application/target/thingsboard.rpm`)
- Test command: sharded per `TEST_FAST.md` — `mvn test -pl='!application,!dao,!ui-ngx,!msa/js-executor,!msa/web-ui' -T4`; `mvn test -pl dao -Dparallel=packages -DforkCount=4`; `mvn test -pl application -Dtest='!**/nosql/**,org.thingsboard.server.controller.**' -DforkCount=6 -Dparallel=classes -Dsurefire.rerunFailingTestsCount=2 -Dsurefire.failOnFlakeCount=5` (plus remaining application shards in `TEST_FAST.md`); UI: `cd ui-ngx && yarn lint`   <!-- reused from the developer overlay's interviewed answers; never guess -->

## Run for testing
- Local run: UI against live data — `cd ui-ngx && yarn start` (serves http://127.0.0.1:4200; set `forwardUrl`/`wsForwardUrl` in `proxy.conf.js` to the dev server, never commit that edit). Full local server needs PostgreSQL + `java -jar application/target/thingsboard-4.4.0-SNAPSHOT-boot.jar` (monolith defaults: in-memory queue, caffeine cache).
- Dev-server deploy (if used): per `HANDOFF.md` §4.2 — build RPM, `tar` backup of `/usr/share/thingsboard` + `/etc/thingsboard` to `/tmp/thingsboard-backup-<stamp>.tar.gz`, keep previous RPM as `/tmp/thingsboard.prev.rpm`, single md5-verified upload to `/tmp/thingsboard.rpm`, `sudo rpm -Uvh --force /tmp/thingsboard.rpm`, confirm `md5sum /etc/thingsboard/conf/thingsboard.conf` unchanged, `sudo systemctl restart thingsboard`, wait for `/login` 200. Rollback: `sudo rpm -Uvh --force /tmp/thingsboard.prev.rpm && sudo systemctl restart thingsboard`. Deploying to the demo server is a human-approved step.
- Dev server address: http://10.221.89.67:8080 (plain HTTP; SSH user/password and MQTT provisioning key in the gitignored `env` file at repo root — read, never copy into reports)

## Environment prerequisites — check BEFORE any test execution
- Required connectivity/access: corporate VPN to reach 10.221.89.67 (server is air-gapped: no outbound internet, dnf repos local only); tenant credentials from `CLAUDE.md` (never paste them into artifacts); JDK 25 + Maven 3.9.9 on PATH (`mvn -v` → Java 25); Node/npx on PATH for the Playwright MCP; Microsoft Edge or a Playwright browser for screenshots (use `channel: 'msedge'` when the bundled chromium download is slow over VPN). Headless screenshots of the live server do not bootstrap over VPN — capture UI on the local `yarn start` dev server and verify the deploy by fetching the served bundle (`curl http://10.221.89.67:8080/` → grep the `styles-*.css` / `main-*.js` hash, then grep the file for the change).
- If any prerequisite is unmet: STOP and report to Jarvis — never emulate or mock around it.

## Health check
- URL: http://10.221.89.67:8080/login (local: http://127.0.0.1:4200/login or http://localhost:8080/login)
- Expected: HTTP 200 within 120 s of `systemctl restart thingsboard` (API 200 alone is not proof the UI works — also confirm the served bundle hash changed)               <!-- e.g. HTTP 200 on root, NOT /actuator/health -->

## UI scope
- UI location(s): `ui-ngx/` (Angular 20). Shell: `ui-ngx/src/app/modules/home/` (rail, toolbar, menu), global theme `ui-ngx/src/styles.scss`, login `ui-ngx/src/app/modules/login/`, widgets `ui-ngx/src/app/modules/home/components/widget/`.
- UI states to always check: light theme (default) AND dark theme (`localStorage['tb-theme']='dark'` before navigation); collapsed icon rail AND pinned-open rail; the Container Operations home dashboard, Devices, Alarms and Assets entity tables; login page.   <!-- e.g. dark mode, feature-flagged sections -->

## Feature flags
- Mechanism & where to toggle: none (product features are gated by ThingsBoard config in `application/src/main/resources/thingsboard.yml` / `/etc/thingsboard/conf/thingsboard.conf` env vars; menu items hidden by `unavailableOffline` in `ui-ngx/src/app/core/services/menu.models.ts`)

## Adjacent-regression map
- Features most often broken by side effects: dark/light theme leaks (components hard-coding `rgba(0,0,0,x)`; CDK overlays attached to `<body>`); dashboard widgets' chart colour scheme (`chart.models.ts` must stay numerically in sync with `--aq-chart-*` tokens); entity-table layout when `styles.scss` grid rules change; the collapsed-rail flyout popovers; `menuCollapsed` user-setting default; login page dark variant; `license:check` and `thingsboard.yml` description-comment CI gates.

## Artifacts to collect
- Default evidence + capture method: Playwright screenshots (Node script, `channel: 'msedge'`) of every touched screen in both themes at 1600×1000, saved to `.claude/team/artifacts/<run-id>/`; server log tail via SSH `journalctl -u thingsboard -n 200 --no-pager` (paramiko, credentials from `env`) into the same folder; HTTP status + served bundle hash of the health URL; Maven/yarn command output logs. Redact credentials before saving.   <!-- e.g. app logs at <path>, screenshots via <tool>, HTTP request/response captures, framework report at <path>, or an MCP server for log collection -->

## Verify
1. Run `mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true`; confirm it succeeds.
2. Run the sharded tests from `TEST_FAST.md` for the affected modules plus `cd ui-ngx && yarn lint`; confirm zero failures.
3. Start per "Run for testing" above; confirm the health check returns HTTP 200 at http://10.221.89.67:8080/login (or the local dev server URL).
4. Execute the approved G2.7 test-case list plus the Regression scope; record results per team-protocol §2-artifacts.
