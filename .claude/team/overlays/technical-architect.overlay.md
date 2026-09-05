# Overlay — technical-architect — Airlinq IoT Platform

All facts here are project-specific by design. No placeholder token may remain after /init-team.

## Module map
- Source layout: Maven reactor (`pom.xml`): `application/` (Spring Boot monolith; REST controllers `application/src/main/java/org/thingsboard/server/controller`, services `.../service`, actor implementations `.../actors`, seed data + upgrade scripts `application/src/main/data/`), `dao/` (JPA/SQL + optional Cassandra, DDL in `dao/src/main/resources/sql/`), `common/` (`data`, `dao-api`, `queue` — the monolith/microservice seam with one `*QueueFactory` per service type × transport, `proto`, `transport`, `actor`, `discovery-api`, `cluster-api`, `edqs`), `rule-engine/` (`rule-engine-api` TbNode contract, `rule-engine-components` ~77 `@RuleNode` nodes), `transport/{http,mqtt,coap,lwm2m,snmp}/` (embedded + standalone), `edqs/`, `msa/` (microservice docker modules), `ui-ngx/` (Angular 20 UI; rule-node config forms live here too), `container-sim/` (Python MQTT simulator for the demo), `packaging/` (RPM/DEB via Gradle). Full narrative in `CLAUDE.md`.            <!-- e.g. controllers/services/repositories locations, UI location -->
- Key modules & owners: Airlinq-specific work is concentrated in `ui-ngx/` (branding, theme tokens, shell) and `container-sim/`; everything else is upstream ThingsBoard and is kept merge-friendly (token-layer-only theming, no template edits without a documented reason). Owner: Airlinq platform team (Siddhika / Abhishek).

## Data model & migrations
- Database(s): PostgreSQL 16 (entities + timeseries in `sql` mode on the demo server); Cassandra optional for hybrid timeseries; Redis/Valkey optional cache (demo uses caffeine); Kafka only in microservice mode (demo uses in-memory queue).
- Versioned-migration mechanism & location: ThingsBoard's own install/upgrade scripts — schema DDL in `dao/src/main/resources/sql/` (`schema-entities.sql`, `schema-ts-psql.sql`, …), version-to-version upgrade SQL/JSON under `application/src/main/data/upgrade/<version>/`, run by `install.sh --upgrade` (`/usr/share/thingsboard/bin/install/install.sh`). No Flyway/Liquibase. Any schema change = new upgrade script + matching `schema-*.sql` edit + explicit plan approval; the demo server has had no schema change across Airlinq builds.   <!-- e.g. Flyway under src/main/resources/db/migration -->

## API conventions
- Style/contract rules: ThingsBoard REST API (`/api/...`, JWT in `X-Authorization: Bearer <token>`, `POST /api/auth/login`, paged lists via `pageSize`/`page`/`sortProperty`/`sortOrder`, OpenAPI at `/swagger-ui/`); new Airlinq endpoints follow the user's `api-rules.md` (plural nouns, `/api/v1/...` for new surfaces, envelope `{success,data,meta,errors}`, machine-readable error codes, pagination mandatory, validation at the controller layer). Inter-service messages go through `common/queue` producers/consumers and protobuf in `common/proto` — adding one touches every relevant `*QueueFactory`.   <!-- REST conventions doc, error envelope, versioning -->

## ADRs
- Location: docs/adr/
- Format: MADR (short Nygard-style: Context, Decision, Consequences), file `NNNN-<kebab-title>.md`                      <!-- e.g. Nygard -->
- Current highest number: 0000 (none yet; first ADR is 0001)

## Security posture notes
- Auth mechanism: JWT access + refresh tokens issued by `POST /api/auth/login` (Spring Security in `application`), roles SYS_ADMIN / TENANT_ADMIN / CUSTOMER_USER; OAuth2 clients supported but hidden on the air-gapped demo; device auth via access token / X.509 / basic MQTT credentials and a provisioning key/secret.
- Known sensitive areas: live credentials in gitignored `CLAUDE.md` and `env` (never commit; `CLAUDE.md` is in `.gitignore`, `env` is not — treat as a standing finding); ThingsBoard `--loadDemo` default accounts (`tenant@thingsboard.org/tenant` etc.) still active on the demo server; plain HTTP (no TLS) on :8080 and MQTT :1883, VPN-only; PostgreSQL password in `/etc/thingsboard/conf/thingsboard.conf`; rule-engine script nodes (JS executor) and transport payload parsing as injection surfaces; entity-level authorization (IDOR) checks in controllers.

## Verify (for plan verification steps)
- Build: `mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true` (packaging: `mvn install -pl application -Ppackaging -DskipTests -Dlicense.skip=true`)
- Test: sharded per `TEST_FAST.md` (`mvn test -pl <module> ...` shards; never root `mvn test`) plus `cd ui-ngx && yarn lint`
