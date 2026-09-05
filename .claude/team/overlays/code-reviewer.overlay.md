# Overlay — code-reviewer — Airlinq IoT Platform

## Code style
- Style references: `ui-ngx/eslint.config.mjs` (Angular ESLint, `yarn lint` gate); `license-header-template.txt` (Apache header required on every source file, enforced by `mvn license:check` in CI); `CLAUDE.md` (architecture + CI gates: every `thingsboard.yml` key needs a description comment); `HANDOFF.md` §7–§8 (theme architecture: colours only via `--aq-*` tokens in `ui-ngx/src/styles.scss`, `.tb-default`/`.tb-dark` equal specificity with dark second, no template changes for theming); Java: match touched files (4-space, Lombok, Spring conventions); the user's global rules (`~/.claude/rules/*.md`: code-style, api-rules, error-handling, testing, react/frontend, vapt-security) apply as review criteria.               <!-- e.g. style-guide doc, linter/formatter config paths -->

## Review checklist
- Project checklist (if any): `pull_request_template.md` (PR body sections) and `security.md`; otherwise the team-protocol default checklist.

## Secret scanning
- Patterns/locations to scan: any diff touching `CLAUDE.md` (contains live tenant/sysadmin/PostgreSQL credentials — must stay gitignored), `env` / `.env` (server SSH password, MQTT provisioning key/secret — must never be staged), `/etc/thingsboard/conf/thingsboard.conf` contents, `ui-ngx/proxy.conf.js` pointing at `10.221.89.67` (dev-only edit, never committed); regexes: `PASSWORD::`, `SECRET::`, `Bearer [A-Za-z0-9._-]{20,}`, `eyJ[A-Za-z0-9_-]{10,}\.` (JWT), `postgres(ql)?://[^\s]+:[^\s]+@`, `SPRING_DATASOURCE_PASSWORD=`, `-----BEGIN (RSA |EC )?PRIVATE KEY-----`, 20+ char hex/base64 tokens in config; plus the default token/key/password patterns.   <!-- regexes or config dirs; default: common token/key/password patterns -->

## Scope
- Out of review scope: `ui-ngx/node_modules/`, `**/target/`, generated protobuf sources (`common/proto` generated output, `*_pb2*`), `netty-mqtt/` (vendored MQTT client), `ui-ngx/patches/` (patch-package files — flag only if changed), `ui-ngx/src/assets/` binaries and locale JSON reformatting churn, upstream ThingsBoard code not touched by the diff, `.superpowers/` and `docs/superpowers/` (local, gitignored), `.claude/team/status/` and `.claude/team/artifacts/`.     <!-- e.g. generated code dirs, vendored dependencies -->
