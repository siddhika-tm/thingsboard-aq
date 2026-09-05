# Overlay — developer — Airlinq IoT Platform

## Repo & layout
- Repo root: (this repository). Main source: Maven multi-module reactor — `application/` (Spring Boot server, controllers under `application/src/main/java/org/thingsboard/server/controller`, services under `.../service`), `dao/` (JPA + SQL schema in `dao/src/main/resources/sql/`), `common/*` (data, queue, transport, actor), `rule-engine/rule-engine-components/` (`@RuleNode` classes), `transport/{http,mqtt,coap,lwm2m,snmp}/`, `ui-ngx/` (Angular 20; app code `ui-ngx/src/app/`, global styles `ui-ngx/src/styles.scss`, theme tokens in its `AIRLINQ` blocks), `container-sim/` (demo simulator). Architecture notes: `CLAUDE.md`, operational history: `HANDOFF.md`.
- Test source: `<module>/src/test/java/` per Maven module (Cassandra-only tests under `**/nosql/**`); UI unit tests are not part of the CI gate — `cd ui-ngx && yarn lint` is.

## Toolchain
- Required toolchain: JDK 25 (Temurin 25.0.4.1; class files are v69, JDK 21 cannot load them), Maven 3.9.9, Node 22.x + Yarn 1.22.22 (Yarn via `corepack yarn@1.22.22`; the Maven build downloads its own Node into `ui-ngx/target/node`).
- If a required tool is missing on the machine: download the Temurin 25 zip (api.adoptium.net) and the Maven 3.9.9 zip (archive.apache.org) into `d:/tmp/tools/` (no admin needed), then in Git Bash `export JAVA_HOME=/d/tmp/tools/jdk-25.0.4.1+1; export PATH="$JAVA_HOME/bin:/d/tmp/tools/apache-maven-3.9.9/bin:$PATH"`; `mvn -v` must report Java 25. On Windows the frontend-maven-plugin fails to extract yarn — seed `ui-ngx/target/node/yarn/dist` from `%LOCALAPPDATA%\node\corepack\v1\yarn\1.22.22` and pass `-Dskip.installyarn=true`. Never run `mvn clean` on `ui-ngx` casually: it deletes `node_modules`.
- Dependency policy: versions pinned by the repo's manifests (`pom.xml` reactor, `ui-ngx/package.json` + `yarn.lock`); any version change requires explicit plan approval. `yarn prepare` applies load-bearing patches from `ui-ngx/patches/`.

## Verify — exact commands
- Full build (never skip tests for verification): `mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true` (add `-DskipTests` only for a packaging-only pass; the license check runs in CI via `mvn -T 1C license:format` — keep the Apache header on every new file). Installable RPM: `mvn install -pl application -Ppackaging -DskipTests -Dlicense.skip=true` → `application/target/thingsboard.rpm` (any `-Dpkg.skip.*` flag disables the packaging profile).
- Full test run: sharded per `TEST_FAST.md` — `mvn test -pl='!application,!dao,!ui-ngx,!msa/js-executor,!msa/web-ui' -T4`; `mvn test -pl dao -Dparallel=packages -DforkCount=4`; `mvn test -pl application -Dtest='!**/nosql/**,org.thingsboard.server.controller.**' -DforkCount=6 -Dparallel=classes -Dsurefire.rerunFailingTestsCount=2 -Dsurefire.failOnFlakeCount=5` (plus the remaining application shards listed in `TEST_FAST.md`). Never run `mvn test` at the root — it exhausts memory. UI: `cd ui-ngx && NODE_OPTIONS=--max-old-space-size=8192 yarn lint` (the default 4 GB heap OOMs on this repo; 8 GB is required to complete). NOTE: this gate is ALREADY RED on a pristine tree - baseline `569 problems (462 errors, 107 warnings)`; no CI workflow runs it, and ESLint does not lint `.scss`. Judge the before/after DELTA (zero NEW problems), not an absolute zero.
- Affected-module test run (optional): `mvn test -pl <module> -Dtest=<TestClass>` (e.g. `mvn test -pl application -Dtest=DeviceControllerTest`); UI iteration: `cd ui-ngx && yarn start` with `proxy.conf.js` pointed at the dev server (never commit that edit).

## Style & conventions
- Style reference: Java — match touched files (Google-style 4-space indent, Lombok in use); TypeScript/SCSS — `ui-ngx/eslint.config.mjs` (`yarn lint` must pass), Prettier-style single quotes; theme colours only via `--aq-*` tokens in `ui-ngx/src/styles.scss` (no hex literals outside the token blocks); every source file carries the Apache header from `license-header-template.txt`; every new key in `application/src/main/resources/thingsboard.yml` needs a description comment (CI gate).
- Input-validation boundary layer: REST controller layer (`application/.../controller`, Bean Validation on DTOs) and transport session layer (`common/transport`); rule nodes validate their config in `init()`.

## Branching & commits
- Feature branch naming: `feature/<short-description>` (add ticket id when one exists)
- Protected branch (never commit directly): master. Commit policy is manual — the developer never commits or pushes; hand the diff to the human after G4.
