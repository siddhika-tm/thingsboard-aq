# Left-menu defect fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four left-menu defects on the Airlinq Blue theme — the clipped collapsed wordmark (D1), the stretched alarm badge (D2), the misordered user block (D3) — and restore collapsible menu groups (D4), reversing ADR 0003's Option A.

**Architecture:** D1/D2 are single-rule stylesheet fixes in the component that *owns* the element. D3 is a one-attribute Angular template fix (Material content-projection slot), not a cascade fix. D4 is a TypeScript data-shape change to `menu.models.ts` plus three supporting guards/bindings. No schema change, no API change, no deploy.

**Tech Stack:** Angular 20, Angular Material 20, SCSS, TypeScript. Verification via Chrome DevTools Protocol against a local dev server (`yarn start`) plus a second `git worktree` serving pristine `d2263de9da`.

**Design doc:** `docs/design/left-menu-defect-fixes.md`
**Requirement:** `docs/requirements/left-menu-defect-fixes.md` (G1 APPROVED, 32 ACs)

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from the requirement and the architect's constraints.

- **Airlinq Blue light palette stays exactly as deployed.** No `--aq-*` token value in the light block is altered (AC-28).
- **Dark must not change**, proven two ways: declaration-level (name+value; declaration-**multiset** where only selectors change) AND rendered pixel-identity vs pristine `d2263de9da` (AC-26).
- **No new `!important`** declarations. Specificity conflicts are resolved by matching or exceeding selector depth (AC-29).
- **Rules live in the stylesheet of the component that OWNS the element.** This rail has FOUR owners: `tb-side-menu`, `tb-menu-link`, `tb-menu-toggle`, `home.component` — plus `tb-user-menu` for the user block (AC-30).
- **Colours come only from `--aq-*` tokens.** No hex or rgba outside the token definition blocks.
- **Charts remain deferred.** Out of scope.
- **No commits, no push, no deploy.** The human reviews and commits. Agents never commit (team-config §3).
- **Do NOT run `mvn license:format`** — it corrupts the `.dc.html` spec artboards under `docs/design/`.
- **NEVER write credentials into any harness script**, even under gitignored paths. Read them from the gitignored `CLAUDE.md` / `env` at RUNTIME.
- **Lint invocation:** `node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint`. `ng lint` does NOT forward `NODE_OPTIONS`; 8192 now OOMs with SIGABRT exit 134.
- **Every screenshot capture:** `reducedMotion: 'reduce'`, pointer parked off-content, focus blurred, zero hovered rows asserted.
- **Verify build:** `mvn install -DskipTests --projects ui-ngx` (per overlay).
- **Structural proof is not visual proof.** A change that builds, lints and greps clean can still blank the menu or break a table. Only a browser confirms rendering.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `ui-ngx/src/app/modules/home/home.component.scss` | rail shell + brand; owns `.tb-brand` | T3 |
| `ui-ngx/src/app/modules/home/menu/menu-link.component.scss` | nav anchor ink + badge geometry | T4 |
| `ui-ngx/src/app/modules/home/menu/menu-link.component.ts` | badge input + label formatting | T4 (blocked step) |
| `ui-ngx/src/app/shared/components/user-menu.component.html` | user block markup; projection slots | T5 |
| `ui-ngx/src/app/modules/home/menu/menu-toggle.component.ts` | group tile logic; `sectionHeight()` guard; `alarmCount$` | T6, T8 |
| `ui-ngx/src/app/modules/home/menu/menu-toggle.component.html` | group children + flyout; badge propagation | T8 |
| `ui-ngx/src/app/core/services/menu.models.ts` | `MenuSectionType`, type map, authority trees | T7 |
| `ui-ngx/src/app/core/services/menu.service.ts` | opened-state restore depth | T8 |
| `docs/adr/0005-collapsible-menu-groups-supersedes-0003.md` | new ADR | T10 |
| `docs/adr/0003-sectioned-menu-model.md` | superseded header | T10 |
| `docs/requirements/left-menu-and-favicon.md`, `docs/design/left-menu-and-favicon.md` | supersede notes | T10 |
| `.claude/team/artifacts/left-menu-defect-fixes/` (gitignored) | all baselines, harnesses, screenshots | T1, T2, T9 |

---

## Task 1: Baseline capture (MUST be first — nothing is verifiable without it)

**Files:**
- Create: `.claude/team/artifacts/left-menu-defect-fixes/baseline/` (gitignored)
- Create: `.claude/team/artifacts/left-menu-defect-fixes/harness/capture.js`
- Create: `.claude/team/artifacts/left-menu-defect-fixes/harness/creds.js`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `baseline/screenshots/<theme>-<railstate>-<width>.png` (8 files); `baseline/tokens-light.json` (the `--aq-*` light palette dump); `baseline/dark-declarations.json` (the frozen dark-block declaration multiset); `baseline/geometry.json` (pre-change measured geometry for all four defects). Later tasks diff against these exact paths.

- [ ] **Step 1: Confirm the toolchain is on PATH before concluding anything is missing**

The portable toolchain at `d:/tmp/tools` is NOT on the default PATH. A bare `which mvn` reports it missing and looks like an environment blocker.

```bash
export JAVA_HOME=/d/tmp/tools/jdk-25
export PATH="$JAVA_HOME/bin:/d/tmp/tools/apache-maven-3.9.9/bin:$PATH"
java -version && mvn -version
```
Expected: JDK 25 and Maven 3.9.9 both report versions.

- [ ] **Step 2: Confirm the working tree is clean and record the exact HEAD**

```bash
cd /d/Github/airlinq-air
git status --porcelain -- ui-ngx/
git rev-parse HEAD
```
Expected: no modified files under `ui-ngx/`. Record the HEAD sha in `baseline/HEAD.txt`. If `ui-ngx/` is dirty, STOP and report — a baseline measured on a dirty tree is not a baseline.

- [ ] **Step 3: Write the credential loader (never inline credentials)**

Create `.claude/team/artifacts/left-menu-defect-fixes/harness/creds.js`:

```js
// Reads the tenant credentials from the gitignored CLAUDE.md at RUNTIME.
// NEVER hardcode credentials here - a live password was embedded in a CDP
// harness during the previous work item and had to be redacted.
const fs = require('fs');
const path = require('path');

function loadTenantCreds(repoRoot) {
  const md = fs.readFileSync(path.join(repoRoot, 'CLAUDE.md'), 'utf8');
  const row = md.split('\n').find(l => l.includes('tenant@airlinq.com'));
  if (!row) {
    throw new Error('tenant row not found in CLAUDE.md - do not fall back to a literal');
  }
  const cells = row.split('|').map(c => c.trim().replace(/`/g, ''));
  const username = cells.find(c => c.includes('@'));
  const password = cells[cells.indexOf(username) + 1];
  if (!username || !password) {
    throw new Error('could not parse tenant credentials');
  }
  return { username, password };
}

module.exports = { loadTenantCreds };
```

- [ ] **Step 4: Start the dev server**

```bash
cd /d/Github/airlinq-air/ui-ngx && yarn start
```
Expected: `ng serve` reports "Compiled successfully" and listens (default `http://localhost:4200`). Leave it running for the whole plan.

- [ ] **Step 5: Write the capture harness**

Create `.claude/team/artifacts/left-menu-defect-fixes/harness/capture.js`. It must:
- log in via `POST /api/auth/login` using `loadTenantCreds`, then set the JWT in localStorage;
- accept `--theme=light|dark`, `--rail=expanded|collapsed`, `--width=1600x1000|390x844`, `--out=<path>`;
- set `reducedMotion: 'reduce'` on the page;
- park the pointer at `(0, 0)` via `Input.dispatchMouseEvent{type:'mouseMoved'}`, call `document.activeElement.blur()`, and **assert `document.querySelectorAll(':hover').length <= 1`** before every capture (`:hover` follows the mouse ACROSS navigation — one hovered table row cost 74k phantom pixels last item);
- toggle the theme by clicking the user-menu theme control, NOT by injecting `tb-dark` (injecting bypasses `theme.service.ts` and does not reproduce the real cascade);
- toggle the rail via the pin button in the rail head;
- write a PNG per combination.

- [ ] **Step 5b: Write the pixel-diff helper (used by Tasks 5 and 9)**

Create `.claude/team/artifacts/left-menu-defect-fixes/harness/pixdiff.js`. It takes two PNG
paths and prints the number of differing pixels plus the percentage of the frame, exiting
non-zero when the count exceeds an optional `--tolerance` (default 0). Decode with
`pngjs` (already present in `node_modules`); compare RGBA per pixel and ignore the alpha
channel only if both images are fully opaque.

```js
// usage: node pixdiff.js a.png b.png [--tolerance=N]
const fs = require('fs');
const { PNG } = require('pngjs');

const [a, b] = process.argv.slice(2).filter(x => !x.startsWith('--'));
const tol = Number((process.argv.find(x => x.startsWith('--tolerance=')) || '=0').split('=')[1]) || 0;

const A = PNG.sync.read(fs.readFileSync(a));
const B = PNG.sync.read(fs.readFileSync(b));
if (A.width !== B.width || A.height !== B.height) {
  console.log(`DIMENSION MISMATCH ${A.width}x${A.height} vs ${B.width}x${B.height}`);
  process.exit(1);
}
let diff = 0;
for (let i = 0; i < A.data.length; i += 4) {
  if (A.data[i] !== B.data[i] || A.data[i+1] !== B.data[i+1] ||
      A.data[i+2] !== B.data[i+2] || A.data[i+3] !== B.data[i+3]) diff++;
}
const total = A.width * A.height;
console.log(`${a} vs ${b}: ${diff} differing pixels (${(100*diff/total).toFixed(4)}%)`);
process.exit(diff > tol ? 1 : 0);
```

Verify it against a file and itself, which must report zero:

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node pixdiff.js ../baseline/screenshots/light-expanded-1600x1000.png                 ../baseline/screenshots/light-expanded-1600x1000.png; echo "exit=$?"
```
Expected: `0 differing pixels (0.0000%)` and `exit=0`.

- [ ] **Step 6: Capture the 8 pre-change screenshots**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
for theme in light dark; do
  for rail in expanded collapsed; do
    for size in 1600x1000 390x844; do
      node capture.js --theme=$theme --rail=$rail --width=$size \
        --out=../baseline/screenshots/$theme-$rail-$size.png
    done
  done
done
ls ../baseline/screenshots/
```
Expected: exactly 8 PNG files, all non-zero size. This is AC-32's "before" half.

- [ ] **Step 7: Dump the light palette for the byte-identical check (AC-28)**

```bash
cd /d/Github/airlinq-air
node -e "
const fs=require('fs');
const s=fs.readFileSync('ui-ngx/src/styles.scss','utf8').replace(/\r\n/g,'\n');
const out={};
// Capture every --aq-* declaration with its source line so a later diff is exact.
s.split('\n').forEach((l,i)=>{
  const m=l.match(/(--aq-[a-z0-9-]+)\s*:\s*([^;]+);/);
  if(m) (out[m[1]]=out[m[1]]||[]).push({line:i+1,value:m[2].trim()});
});
fs.writeFileSync('.claude/team/artifacts/left-menu-defect-fixes/baseline/tokens-light.json',
  JSON.stringify(out,null,2));
console.log('tokens captured:',Object.keys(out).length);
"
```
Expected: a non-zero token count, written to `baseline/tokens-light.json`.

- [ ] **Step 8: Snapshot the dark block's declaration multiset (AC-26a)**

Brace-match the **SECOND** top-level `.tb-dark {` block — never hard-code line numbers, the block moves. Convention per `docs/requirements/airlinq-blue-light-recolour.md` §9d: UTF-8 → normalise CRLF to LF → brace-match → join with `\n`, no trailing newline.

```bash
cd /d/Github/airlinq-air
node -e "
const fs=require('fs'),crypto=require('crypto');
const s=fs.readFileSync('ui-ngx/src/styles.scss','utf8').replace(/\r\n/g,'\n');
const re=/^\.tb-dark\s*\{/gm; const starts=[]; let m;
while((m=re.exec(s))!==null) starts.push(m.index);
if(starts.length<2) throw new Error('expected two top-level .tb-dark blocks, found '+starts.length);
let i=starts[1], depth=0, end=-1;
for(let j=s.indexOf('{',i); j<s.length; j++){
  if(s[j]==='{')depth++; else if(s[j]==='}'){depth--; if(depth===0){end=j;break;}}
}
const block=s.slice(starts[1],end+1);
const decls=[...block.matchAll(/([a-z-]+|--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)]
  .map(d=>d[1].trim()+':'+d[2].trim()).sort();
fs.writeFileSync('.claude/team/artifacts/left-menu-defect-fixes/baseline/dark-declarations.json',
  JSON.stringify(decls,null,2));
console.log('declarations:',decls.length);
console.log('sha256:',crypto.createHash('sha256').update(block,'utf8').digest('hex'));
"
```
Expected: a declaration count and a sha256. Record both in `baseline/dark-declarations.json` and `baseline/dark-hash.txt`. Note: this work item touches no `styles.scss` line, so this snapshot is expected to be **unchanged** at Task 9 — the digest is the cheap check, the multiset is the authoritative one.

- [ ] **Step 9: Capture the pre-change geometry for all four defects**

Write and run a measurement script producing `baseline/geometry.json` with, per theme × rail state × width:
- D1: `.tb-brand-wordmark` computed `display`, `getBoundingClientRect()`; `.tb-brand-mark` rect + horizontal centre; the rail's right edge.
- D2: `.tb-menu-badge` rect, computed `align-self`/`height`/`line-height`, the row rect, the label rect.
- D3: rects of `.tb-user-avatar`, `.tb-user-info`, `.tb-user-display-name`, `.tb-user-authority`, `.tb-user-overflow`, in **DOM order**, plus each one's `previousElementSibling.className`.
- D4: `document.querySelectorAll('.tb-side-menu > li').length` and the full `(type, name, path)` row list.

Expected: `baseline/geometry.json` exists and records the four defects as **currently broken** (wordmark width > 0 when collapsed; badge height ≈ 40px; overflow glyph `left` < avatar `left`). If any defect does **not** reproduce, STOP and report — the defect list is wrong and the architect must revise.

- [ ] **Step 10: Report the baseline (no commit)**

Report to Jarvis: the 8 screenshot paths, the token count, the dark declaration count + sha256, and the four confirmed-broken measurements.

---

## Task 2: Freshly-measured lint baseline on `d2263de9da`

Do **NOT** trust the recorded 567/460/107. Team memory records that baseline as tree-dependent: the same commit measures 569/462 on a dirty tree and 567/460 on a clean checkout. Only the **DELTA** is meaningful (AC-31).

**Files:**
- Create: `.claude/team/artifacts/left-menu-defect-fixes/baseline/lint-baseline.txt`
- Create: second worktree at `d:/tmp/airlinq-pristine` (not in the repo)

**Interfaces:**
- Consumes: `baseline/HEAD.txt` from Task 1
- Produces: `baseline/lint-baseline.txt` — the problems/errors/warnings triple that Task 9 must match exactly; and the pristine worktree at `d:/tmp/airlinq-pristine`, reused by Task 9's two-server pixel comparison.

- [ ] **Step 1: Create the pristine worktree at the baseline commit**

```bash
cd /d/Github/airlinq-air
git worktree add /d/tmp/airlinq-pristine d2263de9da
cd /d/tmp/airlinq-pristine && git rev-parse HEAD
```
Expected: `d2263de9da...`.

- [ ] **Step 2: Junction `node_modules` — do NOT run a fresh install**

A fresh `yarn install` takes ~15 minutes, needs network access to nodejs.org, and can resolve different transitive versions, which would invalidate the comparison. Use a directory junction.

```powershell
cmd //c mklink //J "d:\tmp\airlinq-pristine\ui-ngx\node_modules" "d:\Github\airlinq-air\ui-ngx\node_modules"
```
Expected: `Junction created for ...`. Verify:
```bash
ls /d/tmp/airlinq-pristine/ui-ngx/node_modules/@angular/cli/bin/ng.js
```
Expected: the file exists.

- [ ] **Step 3: Measure the lint baseline on the pristine tree**

`ng lint` does NOT forward `NODE_OPTIONS` and dies with SIGABRT exit 134. Invoke node directly.

```bash
cd /d/tmp/airlinq-pristine/ui-ngx
node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint 2>&1 | tail -20
```
Expected: a summary line of the form `✖ NNN problems (NNN errors, NNN warnings)`. The repo gates are **already red on a pristine tree** — a non-zero count is expected and correct.

- [ ] **Step 4: Record the triple verbatim**

```bash
cd /d/tmp/airlinq-pristine/ui-ngx
node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint 2>&1 | \
  grep -E '✖ [0-9]+ problems' | \
  tee /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/baseline/lint-baseline.txt
```
Expected: one line written. **This number, not 567/460/107, is the gate for Task 9.**

- [ ] **Step 5: Note the SCSS-only corollary**

Record in `lint-baseline.txt`: *"ESLint does not lint `.scss`, so Tasks 3 and 4 (SCSS-only) cannot move this count at all. Only Tasks 5-8 (`.ts`/`.html`) can. A non-zero delta after an SCSS-only task means the measurement is wrong, not the code."*

- [ ] **Step 6: Report (no commit)**

Report the measured triple and confirm it differs from / matches the stale 567/460/107.

---

## Task 3: D1 — hide the collapsed wordmark by exceeding selector depth

**Files:**
- Modify: `ui-ngx/src/app/modules/home/home.component.scss:59-64`
- Test: runtime geometry assertion (no unit-test harness exists for SCSS in this repo)

**Interfaces:**
- Consumes: `baseline/geometry.json` (D1 measurements) from Task 1
- Produces: `.tb-brand` computed `display: none` when `.tb-collapsed`, both themes. No new selector name that later tasks depend on.

- [ ] **Step 1: Confirm the diagnosis at runtime by INJECTION, not by reading the file**

Team memory: prove any specificity diagnosis by injection — never by reading the file.

In the collapsed rail, run:
```js
const wm = document.querySelector('.tb-brand-wordmark');
const brand = wm.closest('.tb-brand');
console.log('brand display =', getComputedStyle(brand).display);
console.log('wordmark width =', wm.getBoundingClientRect().width);
// Which rules match, and in what order does the browser rank them?
console.log(JSON.stringify(
  [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } })
    .filter(r => r.selectorText && r.selectorText.includes('tb-brand')
                 && r.style && r.style.display)
    .map(r => ({sel: r.selectorText, display: r.style.display})), null, 2));
```
Expected: `display: flex`, width > 0, and **two** competing rules — one `display: none` carrying `.tb-collapsed`, one `display: flex` carrying `.tb-nav-header-toolbar`.

**STOP CONDITION:** if the winning `display: flex` rule is NOT the `home.component.scss:147` chain the design names, record the actual winner and **return to the architect**. Do not apply the fix to an unconfirmed diagnosis.

- [ ] **Step 2: Apply the fix — nest the collapse rule two levels deeper**

In `home.component.scss`, inside `&.tb-collapsed { mat-sidenav.tb-site-sidenav { … } }`, replace:

```scss
          .tb-brand {
            display: none;
          }
```

with:

```scss
          // AIRLINQ (D1): the blue-theme rule at :147 nests .tb-brand inside
          // .tb-nav-header .tb-nav-header-toolbar, reaching (0,5,2), and its
          // `display: flex` outranked this rule's `display: none` at (0,4,2) -
          // so the wordmark never hid and was clipped by the 64px rail.
          // Matching those two intermediate classes puts this rule at (0,6,2),
          // which wins on specificity. No !important (AC-29), and the rule stays
          // in the component that OWNS .tb-brand (AC-30): the wordmark carries
          // `_ngcontent-ng-c935555661` = home.component.
          // Theme-safe by construction: `display` carries no colour and the
          // selector has no .tb-dark / :not(.tb-dark) term, so light and dark
          // behave identically (AC-5).
          .tb-nav-header {
            .tb-nav-header-toolbar {
              .tb-brand {
                display: none;
              }
            }
          }
```

- [ ] **Step 3: Verify the SCSS compiles**

```bash
cd /d/Github/airlinq-air/ui-ngx
node -e "
const sass=require('sass');
const r=sass.compile('src/app/modules/home/home.component.scss',{loadPaths:['src/scss']});
console.log('compiled OK,',r.css.length,'bytes');
"
```
Expected: `compiled OK, <n> bytes`. Compile against the repo's own `node_modules/sass`, never by reasoning about Dart Sass behaviour.

- [ ] **Step 4: Confirm the compiled specificity actually increased**

```bash
cd /d/Github/airlinq-air/ui-ngx
node -e "
const sass=require('sass');
const css=sass.compile('src/app/modules/home/home.component.scss',{loadPaths:['src/scss']}).css;
css.split('}').filter(b=>b.includes('tb-brand')&&b.includes('display'))
   .forEach(b=>console.log(b.trim().split('{')[0].trim(),'=>',b.split('{')[1].trim()));
"
```
Expected: the `display:none` selector now contains **both** `.tb-collapsed` and `.tb-nav-header-toolbar`.

- [ ] **Step 5: Verify at runtime, both themes × both rail states**

Re-run Step 1's script in all four combinations plus the 390×844 mobile width.
Expected:
- collapsed, light: `display: none`, wordmark `width === 0` (**AC-1**)
- collapsed: `.tb-brand-mark` horizontal centre = **40 ± 1px** (**AC-2**)
- collapsed: no rail-head element's right edge exceeds the rail's right edge (**AC-3**)
- expanded: `.tb-brand` `display: flex`, wordmark width > 0, ink `--aq-chrome-ink` unchanged (**AC-4**)
- all of the above identical in **dark** (**AC-5**)

**STOP CONDITION for AC-2:** if the mark's centre is not 40 ± 1px, that is a NEW finding. Record the measured value and report it — **do not add a nudge/offset**. The existing collapsed-head rules at `:65-80` are supposed to centre it; if they do not, the architect revises.

- [ ] **Step 6: Capture the D1 screenshots (AC-32)**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
for theme in light dark; do for rail in expanded collapsed; do for size in 1600x1000 390x844; do
  node capture.js --theme=$theme --rail=$rail --width=$size --out=../after-d1/$theme-$rail-$size.png
done; done; done
```
Expected: 8 PNGs under `after-d1/`.

- [ ] **Step 7: Confirm no new `!important` and no token change**

```bash
cd /d/Github/airlinq-air
git diff -- ui-ngx/src/app/modules/home/home.component.scss | grep '^+' | grep -c '!important'
git diff -- ui-ngx/src/app/modules/home/home.component.scss | grep '^+' | grep -c -- '--aq-'
```
Expected: `0` and `0` (AC-29, AC-28). Note the count is on **added declarations**, not text hits.

- [ ] **Step 8: Report, do not commit**

Report the measured before/after for AC-1..AC-5 and the screenshot paths. **Rollback if rejected:** `git checkout -- ui-ngx/src/app/modules/home/home.component.scss`.

---

## Task 4: D2 — constrain the alarm badge to a compact centred chip

**Files:**
- Modify: `ui-ngx/src/app/modules/home/menu/menu-link.component.scss:61-72`
- Modify (BLOCKED step only): `ui-ngx/src/app/modules/home/menu/menu-link.component.ts`
- Modify (BLOCKED step only): `ui-ngx/src/app/modules/home/menu/menu-link.component.html:33`

**Interfaces:**
- Consumes: `baseline/geometry.json` (D2 measurements) from Task 1
- Produces: `.tb-menu-badge` with a definite 16px cross size and `align-self: center`. Task 8 re-verifies this same element after D4 relocates it into a toggle.

- [ ] **Step 1: Confirm the winning rule and the real flex parent at runtime**

The design's claim is that the badge is a flex child of `span.mdc-button__label` (not of the anchor), stretched by that wrapper's default `align-items: stretch`. Confirm it.

Navigate to a rail with `badgeCount > 0` (the demo has standing CRITICAL alarms), expanded rail, and run:
```js
const b = document.querySelector('.tb-menu-badge');
const p = b.parentElement;
console.log('parent =', p.tagName, p.className);
console.log('parent display =', getComputedStyle(p).display,
            '| parent align-items =', getComputedStyle(p).alignItems);
console.log('badge align-self =', getComputedStyle(b).alignSelf,
            '| height =', getComputedStyle(b).height,
            '| rect =', JSON.stringify(b.getBoundingClientRect()));
const row = b.closest('a');
console.log('row rect =', JSON.stringify(row.getBoundingClientRect()));
```
Expected: `parent = SPAN mdc-button__label`, parent `display: inline-flex`, parent `align-items: normal`/`stretch`, badge `align-self: stretch`, badge height ≈ **40px**.

**STOP CONDITION:** if the parent is NOT `span.mdc-button__label`, or the badge's `align-self` is not `stretch`, the mechanism differs from the design. Record the measurement and **return to the architect**. Do not fix blind.

- [ ] **Step 2: Apply the badge fix**

In `menu-link.component.scss`, replace the `.tb-menu-badge` rule with:

```scss
  .tb-menu-badge {
    margin-left: auto;
    flex: none;
    // AIRLINQ (D2): mat-button projects all unslotted content into ONE
    // `span.mdc-button__label`, and side-menu.component.scss:151 makes that
    // wrapper `display: inline-flex` with no `align-items` - so it defaults to
    // `stretch` and, on a 40px row, stretched this badge to 40px tall. With
    // `border-radius: 999px` that painted as a tall blob. `line-height: 14px`
    // sizes the TEXT box only, so it never constrained the element.
    //
    // Fixed on the badge itself rather than on the shared wrapper: that wrapper
    // is used by every nav row AND by the toggle rows, so changing its
    // cross-axis alignment to fix one chip risks a label shift on 60+ rows -
    // and the badge is owned by THIS component (menu-link.component.html:33),
    // which is where AC-30 requires the rule to live.
    //
    // `align-self` on the child overrides the parent's `align-items` outright:
    // a different property on a different element, so there is no specificity
    // contest and no !important (AC-29).
    align-self: center;
    box-sizing: border-box;
    height: 16px;
    min-width: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .06em;
    line-height: 14px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--aq-accent-container);
    color: var(--aq-on-accent-container);
  }
```

Colours are unchanged (`--aq-accent-container` / `--aq-on-accent-container`), so this is a geometry-only edit and dark is a no-op by construction.

- [ ] **Step 3: Verify the SCSS compiles**

```bash
cd /d/Github/airlinq-air/ui-ngx
node -e "
const sass=require('sass');
const r=sass.compile('src/app/modules/home/menu/menu-link.component.scss',{loadPaths:['src/scss']});
console.log('compiled OK,',r.css.length,'bytes');
"
```
Expected: `compiled OK, <n> bytes`.

- [ ] **Step 4: Verify the badge geometry, both themes × expanded rail × both widths**

```js
const b = document.querySelector('.tb-menu-badge');
const row = b.closest('a');
const label = row.querySelector('.mdc-button__label > span');
const rb = b.getBoundingClientRect(), rr = row.getBoundingClientRect(), rl = label.getBoundingClientRect();
const overlaps = (a, c) => !(a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top);
console.log('AC-6  height<=18 & w>=h :', rb.height <= 18 && rb.width >= rb.height, rb.height, rb.width);
console.log('AC-7  no label overlap  :', !overlaps(rb, rl));
console.log('AC-8  centred +/-2px    :', Math.abs((rb.top+rb.bottom)/2 - (rr.top+rr.bottom)/2) <= 2);
```
Expected: all three `true`. (**AC-6, AC-7, AC-8**; **AC-11** repeats in dark.)

AC-7 must be checked at **390×844** too — the label ellipsises there, so overlap is a genuine risk.

- [ ] **Step 5: Verify AC-9 by forcing a 1-digit and a 2-digit count**

The live count is data-dependent, so drive the input directly rather than waiting for an alarm:
```js
// Set the Input on the component instance (dev-server build exposes window.ng).
const el = document.querySelector('tb-menu-link .tb-menu-badge').closest('tb-menu-link');
const cmp = ng.getComponent(el);
const widths = {};
for (const n of [7, 42]) {
  cmp.badgeCount = n; ng.applyChanges(cmp);
  const r = document.querySelector('.tb-menu-badge').getBoundingClientRect();
  widths[n] = {w: r.width, h: r.height};
}
console.log(JSON.stringify(widths));
console.log('AC-9:', widths[42].w > widths[7].w && widths[7].h <= 18 && widths[42].h <= 18);
```
Expected: `AC-9: true` — the 2-digit badge is wider and both stay ≤ 18px tall.

Note: `window.ng` exists only on a **dev-server** build. The deployed bundle strips it — that is why this step runs against `yarn start`.

- [ ] **Step 6: Verify AC-10 — the collapsed dot and its text alternative**

Collapse the rail, then:
```js
const dot = document.querySelector('.tb-menu-dot');
const hidden = document.querySelector('.tb-menu-dot + .cdk-visually-hidden');
console.log('dot present :', !!dot, dot && getComputedStyle(dot).position);
console.log('dot 6x6     :', dot && dot.getBoundingClientRect().width === 6);
console.log('badge absent:', !document.querySelector('.tb-menu-badge'));
console.log('count in a11y tree:', !!hidden && hidden.textContent.trim().length > 0);
```
Expected: dot present, `position: absolute`, 6×6, no `.tb-menu-badge`, and a non-empty visually-hidden count (**AC-10**). This step **verifies existing behaviour** — do not modify `.tb-menu-dot`; it is `position: absolute` and therefore never a flex child.

- [ ] **Step 7: Painted-pixel decode for the badge (AC-27)**

`getComputedStyle` can be right while the painted pixel is wrong — three recorded causes: `opacity` compositing, gradient width, and a z-index sibling painting over. The badge sits on `--aq-accent-container` over the navy rail, so pair the computed claim with a decode.

```js
const r = document.querySelector('.tb-menu-badge').getBoundingClientRect();
const cx = Math.round(r.left + r.width/2), cy = Math.round(r.top + r.height/2);
console.log('elementFromPoint =', document.elementFromPoint(cx, cy).className);
```
Then capture a PNG and decode the pixel at `(cx, cy)` and at the badge's ink centre; compute the contrast ratio from the **decoded** values, not the declared ones. Expected: text contrast ≥ 4.5:1, and no pair that passed at baseline now fails.

- [ ] **Step 8: [BLOCKED — awaiting human ruling, design §9.2] Implement the "99+" cap**

Ruling Q3 says keep the "99+" cap. **Verified: no cap exists in the code.** `AlarmBadgeService` emits raw `PageData.totalElements` and the template interpolates it unformatted. Do **not** start this step until the human rules (design §9.2). If ruled (a):

In `menu-link.component.ts`, add:
```ts
  /**
   * Caps the displayed alarm count at "99+" so a 3+ digit count cannot widen the
   * badge past the row. The full count stays available to assistive technology
   * through the collapsed-rail `cdk-visually-hidden` span (AC-10).
   */
  get badgeLabel(): string {
    const count = this.badgeCount ?? 0;
    return count > 99 ? '99+' : String(count);
  }
```

In `menu-link.component.html:33`, change `{{ badgeCount }}` to `{{ badgeLabel }}`.

Then verify:
```js
const cmp = ng.getComponent(document.querySelector('tb-menu-link'));
for (const n of [99, 100, 1234]) {
  cmp.badgeCount = n; ng.applyChanges(cmp);
  const b = document.querySelector('.tb-menu-badge');
  console.log(n, '->', b.textContent.trim(), b.getBoundingClientRect().width);
}
```
Expected: `99 -> 99`, `100 -> 99+`, `1234 -> 99+`, and the width stops growing.

If ruled (b), skip this step and record in the task notes that no cap exists.

- [ ] **Step 9: Capture the D2 screenshots and confirm no new `!important`**

```bash
cd /d/Github/airlinq-air
git diff -- ui-ngx/src/app/modules/home/menu/menu-link.component.scss | grep '^+' | grep -c '!important'
```
Expected: `0`. Then capture the 8-combination screenshot set into `after-d2/`.

- [ ] **Step 10: Report, do not commit**

Report AC-6..AC-11 measurements, the AC-9 width pair, the decoded contrast, and whether Step 8 ran. **Rollback if rejected:** `git checkout -- ui-ngx/src/app/modules/home/menu/menu-link.component.scss` (plus `menu-link.component.{ts,html}` if Step 8 ran).

---

## Task 5: D3 — restore the user block order via Material's trailing projection slot

**Files:**
- Modify: `ui-ngx/src/app/shared/components/user-menu.component.html:38`

**Interfaces:**
- Consumes: `baseline/geometry.json` (D3 measurements) from Task 1
- Produces: rendered flex order avatar → `.tb-user-info` → `.tb-user-overflow` in the rail. No CSS change — `user-menu.component.scss` is untouched.

- [ ] **Step 1: Confirm the projection mechanism at runtime — this is the whole diagnosis**

The design **corrects** the requirement here: the requirement blames the cascade; the design blames Material's content projection. Confirm which is true before touching anything.

Expanded rail, light:
```js
const btn = document.querySelector('.tb-site-sidenav button.tb-user-menu');
console.log('CHILDREN IN DOM ORDER:');
[...btn.children].forEach((c, i) =>
  console.log(i, c.tagName, c.className, JSON.stringify(c.getBoundingClientRect().left)));
const g = btn.querySelector('.tb-user-overflow');
const a = btn.querySelector('.tb-user-avatar');
console.log('glyph left =', g.getBoundingClientRect().left, '| avatar left =', a.getBoundingClientRect().left);
console.log('glyph is BEFORE label wrapper?',
  !!(g.compareDocumentPosition(btn.querySelector('.mdc-button__label')) & Node.DOCUMENT_POSITION_FOLLOWING));
console.log('glyph computed order =', getComputedStyle(g).order,
            '| margin-left =', getComputedStyle(g).marginLeft);
```
Expected: the glyph appears **before** `span.mdc-button__label` in DOM order, its `left` is **less than** the avatar's, and its computed `order` is `0` with `margin-left` **not** `auto` — i.e. **projection order, not a cascade override**.

**STOP CONDITION:** if the glyph is DOM-ordered *after* the label wrapper yet still paints to the left, then a CSS `order`/`direction`/`flex-flow` rule is responsible and the design's diagnosis is wrong. Record the matching rules and **return to the architect**.

- [ ] **Step 2: Prove the AC-18 assumption BEFORE editing — which toolbar button is visible?**

This is the highest-risk assumption in D1–D3. `iconPositionEnd` is not scopeable per consumer, so it changes projection for the top-toolbar instance too. AC-18 pins that instance unchanged.

Navigate to a route with the top toolbar, and run:
```js
document.querySelectorAll('tb-user-menu').forEach((host, i) => {
  const inRail = !!host.closest('.tb-site-sidenav');
  const full = host.querySelector('button.tb-user-menu');
  const icon = host.querySelector('button.tb-user-menu-icon');
  console.log(`instance ${i} inRail=${inRail}`,
    '| full visible =', full && getComputedStyle(full).display !== 'none' && full.getBoundingClientRect().width > 0,
    '| icon visible =', icon && getComputedStyle(icon).display !== 'none' && icon.getBoundingClientRect().width > 0);
});
```
Expected: exactly one instance per surface, and for the **non-rail** instance either the full button is hidden, or — if it is visible — its `.tb-user-overflow` glyph position is recorded now so Step 6 can compare.

**STOP CONDITION:** if the full button IS visible in the toolbar AND its overflow glyph is visible, the projection change will move it. Record this and **return to the architect** for re-scoping (design §4.4). Do not proceed on the assumption.

- [ ] **Step 3: Capture the toolbar instance "before" screenshots (AC-18 evidence)**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
for size in 1600x1000 390x844; do
  node capture.js --theme=light --rail=expanded --width=$size --clip=toolbar \
    --out=../before-d3-toolbar/light-$size.png
done
```
Expected: 2 PNGs cropped to the toolbar. These are the AC-18 comparands.

- [ ] **Step 4: Apply the fix — one attribute**

In `user-menu.component.html`, change line 38 from:
```html
  <tb-icon class="material-icons tb-user-overflow" aria-hidden="true">more_vert</tb-icon>
```
to:
```html
  <!-- AIRLINQ (D3): `iconPositionEnd` is REQUIRED, not cosmetic. `mat-button`
       projects content through three slots, and `class="material-icons"` matches
       the FIRST one - `select=".material-icons:not([iconPositionEnd])"` - which is
       emitted BEFORE `<span class="mdc-button__label">`. So Angular hoisted this
       glyph to the head of the button's flex line, ahead of the avatar and the
       name/role stack, regardless of its position here. That is the whole D3
       defect: the misalignment and the detached glyph were one cause, not two.
       `iconPositionEnd` moves it to the trailing slot; `.tb-user-info`'s
       `flex: 1 1 auto` then pushes it to the trailing edge, so no
       `margin-left: auto` is needed. A CSS `order` would fix the pixels while
       leaving DOM and accessibility order wrong - see docs/design §4.2. -->
  <tb-icon iconPositionEnd class="material-icons tb-user-overflow" aria-hidden="true">more_vert</tb-icon>
```

- [ ] **Step 5: Verify the rail order and alignment, both themes × both widths**

```js
const btn = document.querySelector('.tb-site-sidenav button.tb-user-menu');
const q = s => btn.querySelector(s).getBoundingClientRect();
const av = q('.tb-user-avatar'), inf = q('.tb-user-info'), ov = q('.tb-user-overflow');
console.log('AC-12 left strictly increasing:', av.left < inf.left && inf.left < ov.left, av.left, inf.left, ov.left);
const cs = getComputedStyle(btn);
const contentRight = btn.getBoundingClientRect().right - parseFloat(cs.paddingRight);
console.log('AC-13 glyph within 12px of trailing edge:', (contentRight - ov.right) <= 12, contentRight - ov.right);
console.log('AC-14 avatar 32x32:', av.width === 32 && av.height === 32);
console.log('AC-14 stack centred +/-2px:', Math.abs((inf.top+inf.bottom)/2 - (av.top+av.bottom)/2) <= 2);
const name = q('.tb-user-display-name'), role = q('.tb-user-authority');
const ol = (a,b) => !(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
console.log('AC-15 no pairwise overlap:',
  !ol(name,role) && !ol(name,av) && !ol(role,av) && !ol(name,ov) && !ol(role,ov));
```
Expected: all `true` (**AC-12, AC-13, AC-14, AC-15**; **AC-17** repeats in dark).

**STOP CONDITION:** if AC-14's centring or AC-13's trailing edge still fails after the order is correct, report the measured numbers and **return to the architect** — do not add nudge offsets. The design predicts the existing `:151` block handles alignment once the order is right; a residual failure means that prediction is wrong.

- [ ] **Step 6: Verify AC-18 — the toolbar instance is visually unchanged**

Re-capture the toolbar crops and diff against Step 3:
```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes
for size in 1600x1000 390x844; do
  node harness/pixdiff.js before-d3-toolbar/light-$size.png after-d3-toolbar/light-$size.png
done
```
Expected: **0 differing pixels** on both (**AC-18**). A non-zero diff means the projection change reached the toolbar — revert and return to the architect.

- [ ] **Step 7: Verify AC-16 — the collapsed user block**

Collapse the rail, then:
```js
const btn = document.querySelector('.tb-site-sidenav button.tb-user-menu');
const av = btn.querySelector('.tb-user-avatar').getBoundingClientRect();
console.log('AC-16 avatar centred on rail axis:', Math.abs((av.left+av.right)/2 - 40) <= 1, (av.left+av.right)/2);
const vis = s => { const e = btn.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
console.log('AC-16 name/role/overflow hidden:',
  !vis('.tb-user-display-name') && !vis('.tb-user-authority') && !vis('.tb-user-overflow'));
```
Expected: both `true`. The `&.tb-collapsed { justify-content: center }` block now centres a *different* set of flex children, so this must be measured, not assumed.

- [ ] **Step 8: Verify the accessibility tree still has one tab stop**

```js
const btn = document.querySelector('.tb-site-sidenav button.tb-user-menu');
console.log('glyph aria-hidden:', btn.querySelector('.tb-user-overflow').getAttribute('aria-hidden'));
console.log('focusable descendants:', btn.querySelectorAll('[tabindex]:not([tabindex="-1"]), button, a').length);
```
Expected: `aria-hidden = "true"` and `0` focusable descendants — the button itself remains the single tab stop.

- [ ] **Step 9: Lint delta check (first `.html` task, so this one CAN move the count)**

```bash
cd /d/Github/airlinq-air/ui-ngx
node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint 2>&1 | grep -E '✖ [0-9]+ problems'
```
Expected: identical to `baseline/lint-baseline.txt`.

- [ ] **Step 10: Capture D3 screenshots and report, do not commit**

Capture the 8-combination set into `after-d3/`. Report AC-12..AC-18 measurements and the AC-18 pixel diff. **Rollback if rejected:** revert the one attribute in `user-menu.component.html`.

---

## Task 6: D4 part 1 — the `.pages` consumer sweep and the `sectionHeight()` guard

This task lands **before** the model reshape so the reshape cannot blank the menu even transiently. Its proof is a **rendered** route sweep, explicitly NOT static inspection: the failure mode being guarded against builds, lints and greps clean while blanking the entire side menu.

**Files:**
- Modify: `ui-ngx/src/app/modules/home/menu/menu-toggle.component.ts:55-61`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `sectionHeight()` is null-safe for a `toggle` with absent/empty `pages`. Task 7 relies on this guard being in place before it reshapes the tree.

- [ ] **Step 1: Re-sweep every `.pages` consumer and record the guard state of each**

```bash
cd /d/Github/airlinq-air/ui-ngx
grep -rn "\.pages" src/app --include=*.ts --include=*.html | grep -v spec.ts
```

The complete enumeration, which the sweep must reproduce (the unrelated `MobilePage`/`pagesForm` hits in `mobile-layout.component.ts` and `mobile-app.models.ts` are a **different** `pages` and are out of scope):

| # | Site | Function | Expected guard |
|---|---|---|---|
| 1 | `menu.models.ts:1348-1349` | `referenceToMenuSection` | `reference.pages?.length` |
| 2 | `menu.models.ts:1365-1366` | `filterMenuReference` | `reference.pages?.length` |
| 3 | `menu.models.ts:1385-1388` | `menuSectionToHomeSection` | `type === 'toggle' && section.pages?.length` |
| 4 | `menu.service.ts:93-94` | `allMenuLinks` | `section.pages && section.pages.length` |
| 5 | `menu.service.ts:104-105` | `allMenuSections` | `section.pages && section.pages.length` |
| 6 | `menu.service.ts:130-131` | `isSectionActive` | `section.pages?.length` |
| 7 | `router-tabs.component.ts:118` | `buildTabs` | `found.pages?.filter(...) ?? []` — **already fixed** |
| 8 | `router-tabs.component.ts:155-156` | `findRootSection` | `section.pages?.length` |
| 9 | `menu-toggle.component.html:64` | `@for` inline list | `@for` over `undefined` renders nothing |
| 10 | `menu-toggle.component.html:78` | `@for` flyout list | `@for` over `undefined` renders nothing |
| 11 | **`menu-toggle.component.ts:57`** | **`sectionHeight()`** | **NONE — this is the live hazard** |

Expected: 11 in-scope sites, with **exactly one** unguarded (#11). Record the list.

**STOP CONDITION:** if the sweep finds an unguarded site NOT in this table, record it and report — the plan's enumeration is incomplete and the architect must revise.

- [ ] **Step 2: Confirm #7 really is already fixed (memory says otherwise)**

```bash
cd /d/Github/airlinq-air/ui-ngx
sed -n '108,122p' src/app/modules/home/components/router-tabs.component.ts
```
Expected: `found.pages?.filter(page => !page.rootOnly || isRoot) ?? []`. Team memory records this as the *unguarded* `:113` dereference that blanked the menu; it was repaired in the previous work item. Record the confirmation so Jarvis can prune that memory line.

- [ ] **Step 3: Reproduce the hazard so the guard is demonstrably necessary**

Prove #11 throws before fixing it. In the running dev server:
```js
const el = document.querySelector('tb-menu-toggle');
const cmp = ng.getComponent(el);
const saved = cmp.section.pages;
try {
  cmp.section.pages = undefined;
  cmp.section.opened = true;
  cmp.sectionHeight();
  console.log('NO THROW - guard may already exist');
} catch (e) {
  console.log('THREW as expected:', e.message);
} finally {
  cmp.section.pages = saved; ng.applyChanges(cmp);
}
```
Expected: `THREW as expected: Cannot read properties of undefined (reading 'length')`.

- [ ] **Step 4: Apply the guard**

In `menu-toggle.component.ts`, replace `sectionHeight()`:

```ts
  /**
   * Height of the inline children list. Bound to `[style.height]` in the template,
   * so this runs on EVERY change-detection cycle.
   *
   * AIRLINQ (D4): the `?? 0` guard is load-bearing. `pages` is optional on
   * `MenuSection`, and a `toggle` whose children are all hidden by `menuFilters`
   * (or a future tree edit that drops them) reaches here with `pages` undefined.
   * Because this sits in the shared `menuSections()` pipeline, an unguarded
   * dereference throws on every cycle and BLANKS THE ENTIRE SIDE MENU on the
   * affected routes - while building, linting and grepping clean. The mirror
   * image of this bug (a pages-less `link` dereferenced by `router-tabs`) cost
   * the previous work item a G3 blocker.
   */
  sectionHeight(): string {
    if (this.section.opened && !this.collapsed) {
      return (this.section.pages?.length ?? 0) * 40 + 'px';
    } else {
      return '0px';
    }
  }
```

- [ ] **Step 5: Re-run Step 3 and confirm it no longer throws**

Expected: `NO THROW`, and `sectionHeight()` returns `'0px'` for an empty group.

- [ ] **Step 6: THE PROOF — a rendered all-routes sweep counting `.tb-side-menu` children**

This is AC-24 and it is the task's exit gate. Static inspection does **not** satisfy it.

Write `harness/route-sweep.js` which, for each authority (TENANT_ADMIN, and SYS_ADMIN + CUSTOMER_USER using the credentials from `CLAUDE.md` at runtime), logs in, then for every route below: navigates, waits for the router to settle, and records `document.querySelectorAll('.tb-side-menu > li').length` **plus** any console error.

Routes to sweep — every route affected by the D4 reshape, plus the pixel-stable controls:
```
/home
/dashboards
/alarms/alarms
/alarms/alarmRules
/notification/inbox
/notification/sent
/notification/recipients
/notification/templates
/notification/rules
/entities/devices
/entities/assets
/entities/entityViews
/entities/otaUpdates
/profiles/deviceProfiles
/profiles/assetProfiles
/customers
/features/calculatedFields
/features/ruleChains
/resources/widgets-library/widget-types
/resources/widgets-library/widgets-bundles
/resources/images
/resources/scada-symbols
/resources/javascript-library
/resources/resources-library
/security-settings/auditLogs
/security-settings/oauth2/clients
/settings/home
/settings/notifications
/settings/outgoing-mail
/version-control
/usage
```

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node route-sweep.js --out=../after-t6/route-sweep.json
node -e "
const r=require('../after-t6/route-sweep.json');
const bad=r.filter(x=>x.sideMenuChildren===0||x.consoleErrors.length>0);
console.log('routes swept:',r.length);
console.log('FAILURES:',JSON.stringify(bad,null,2));
process.exit(bad.length?1:0);
"
```
Expected: every route reports `.tb-side-menu > li` **count > 0** and **zero console errors**; the script exits 0 (**AC-24**).

- [ ] **Step 7: Lint delta**

```bash
cd /d/Github/airlinq-air/ui-ngx
node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint 2>&1 | grep -E '✖ [0-9]+ problems'
```
Expected: identical to `baseline/lint-baseline.txt`.

- [ ] **Step 8: Report, do not commit**

Report the 11-site sweep table, the #7 correction, the reproduce/guard evidence, and the route-sweep JSON path. **Rollback if rejected:** revert one line in `menu-toggle.component.ts` (re-exposes the latent bug but restores prior behaviour exactly).

---

## Task 7: D4 part 2 — reshape the model to restore collapsible groups

The riskiest task in the plan. Its emergency stop is reverting one file.

**Files:**
- Modify: `ui-ngx/src/app/core/services/menu.models.ts` — the `menuSections` type map (3 entries) and the `defaultUserMenuMap` TENANT_ADMIN tree (`:981-1084`)

**Interfaces:**
- Consumes: the `sectionHeight()` guard from Task 6 (must be in place first)
- Produces: multi-page groups with `type === 'toggle'` and populated `pages`. Task 8 relies on `alarms` being nested under `monitor > alarms_center` and therefore rendered by `menu-toggle`, not `side-menu`.

- [ ] **Step 1: Snapshot the pre-change pageset per authority (the AC-22 comparand)**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node pageset.js --out=../baseline/pageset-before.json
node -e "
const p=require('../baseline/pageset-before.json');
for (const a of Object.keys(p)) console.log(a, 'leaf links:', p[a].length);
"
```
`pageset.js` must, per authority, build the menu via `buildUserMenu` semantics **in the browser** (so `menuFilters` and `filterMenuReference` run exactly as they do live), recurse `.pages`, and emit the sorted set of `type === 'link'` leaf `path` values **after redirect resolution** (follow each path through the router and record the settled URL, so a redirecting path is compared by destination, not by literal).

Expected: three authorities, each with a non-zero leaf count. Record.

- [ ] **Step 2: Snapshot the Home sections per authority (the AC-23 comparand)**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node homesnap.js --out=../baseline/home-before.json
```
`homesnap.js` records, per authority, the full `buildUserHome` output — every card's `name`, and each card's ordered `places` (`name` + `path`).

Expected: three authorities recorded.

- [ ] **Step 3: Restore `type: 'toggle'` on the three flattened group parents**

In the `menuSections` map in `menu.models.ts`, change `type: 'link'` → `type: 'toggle'` for:
- `MenuId.notifications_center` (~`:254`)
- `MenuId.mobile_center` (~`:329`)
- `MenuId.alarms_center`

Add above the first of them:
```ts
      // AIRLINQ (D4): restored to 'toggle'. ADR 0003's Option A flattened these
      // group parents to 'link' so every page sat one click away in the EXPANDED
      // rail - but on the COLLAPSED rail that rendered one icon per PAGE instead
      // of one per GROUP, which does not scale and loses the group affordance
      // entirely (the flyout, the collapsed rail's only way to express a group,
      // had nothing to show). Reversed by human decision 2026-09-08; see
      // docs/adr/0005-collapsible-menu-groups-supersedes-0003.md.
```

Leave `monitor`, `profiles`, `data_processing`, `resources`, `edge_management`, `security_settings`, `platform_section` alone — they are **already** `toggle`.

- [ ] **Step 4: Restore the TENANT_ADMIN tree nesting, using `homeMenuMap` as the reference shape**

`homeMenuMap` at `:1183` preserves the pre-reshape tree **verbatim** and is the authoritative target. Do not invent a shape.

```bash
cd /d/Github/airlinq-air/ui-ngx
sed -n '1181,1260p' src/app/core/services/menu.models.ts
```

In `defaultUserMenuMap`'s TENANT_ADMIN entry, replace the flat run
`{monitor_label}, {dashboards}, {alarms}, {alarm_rules}, {notifications_center, pages:[...]}`
with the nested form from `homeMenuMap`:

```ts
      {id: MenuId.monitor_label},
      {
        id: MenuId.monitor,
        pages: [
          {id: MenuId.dashboards},
          {
            id: MenuId.alarms_center,
            pages: [
              {id: MenuId.alarms},
              {id: MenuId.alarm_rules}
            ]
          },
          {
            id: MenuId.notifications_center,
            pages: [
              {id: MenuId.notification_inbox},
              {id: MenuId.notification_sent},
              {id: MenuId.notification_recipients},
              {id: MenuId.notification_templates},
              {id: MenuId.notification_rules}
            ]
          }
        ]
      },
```

Apply the equivalent re-nesting to the `devices_assets_label`, `operations_label` and `administration_label` runs, in each case copying the grouping `homeMenuMap` records for the same ids. **The four `'section'` heading entries are RETAINED** (design §5.1) — they keep grouping the expanded rail and the `'section'` type keeps its `@switch` arm. Do not remove `'section'` from `MenuSectionType`.

- [ ] **Step 5: Confirm it compiles**

```bash
cd /d/Github/airlinq-air/ui-ngx
node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js build --configuration development 2>&1 | tail -15
```
Expected: build succeeds, exit 0. A TS error here means a `MenuId` was mistyped.

- [ ] **Step 6: Verify AC-19 — multi-page groups are `toggle` in the BUILT model**

Assert against the runtime model, not the source literal:
```js
const svc = ng.getInjector(document.querySelector('tb-side-menu'))
              .get(ng.getComponent(document.querySelector('tb-side-menu')).menuService.constructor);
// Simpler: read the rendered model off the component.
const cmp = ng.getComponent(document.querySelector('tb-side-menu'));
cmp.menuSections$.subscribe(secs => {
  const walk = (ss, out = []) => (ss.forEach(s => { out.push(s); if (s.pages) walk(s.pages, out); }), out);
  const all = walk(secs);
  const bad = all.filter(s => (s.pages?.length ?? 0) > 1 && s.type !== 'toggle');
  console.log('AC-19 every multi-page group is toggle:', bad.length === 0);
  console.log('violations:', JSON.stringify(bad.map(s => ({name: s.name, type: s.type, n: s.pages.length}))));
});
```
Expected: `AC-19 ... true` and an empty violations list.

- [ ] **Step 7: THE PROOF for AC-22 — pageset diff must be LOST [] / GAINED []**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node pageset.js --out=../after-t7/pageset-after.json
node -e "
const b=require('../baseline/pageset-before.json'), a=require('../after-t7/pageset-after.json');
let fail=0;
for (const auth of Object.keys(b)) {
  const B=new Set(b[auth]), A=new Set(a[auth]);
  const lost=[...B].filter(x=>!A.has(x)), gained=[...A].filter(x=>!B.has(x));
  console.log(auth, 'LOST', JSON.stringify(lost), '/ GAINED', JSON.stringify(gained));
  if (lost.length||gained.length) fail=1;
}
process.exit(fail);
"
```
Expected, for **all three** authorities: `LOST [] / GAINED []`, exit 0 (**AC-22**).

A `LOST` entry is an orphaned route — a hard failure. A `GAINED` entry usually means a group whose children are all `unavailableOffline` became visible, which ADR 0003 constraint 4 exists to prevent.

- [ ] **Step 8: Verify the `filterMenuReference` parent-hiding still holds**

```js
const cmp = ng.getComponent(document.querySelector('tb-side-menu'));
cmp.menuSections$.subscribe(secs => {
  const walk = (ss, out = []) => (ss.forEach(s => { out.push(s); if (s.pages) walk(s.pages, out); }), out);
  const names = walk(secs).map(s => s.name);
  console.log('mobile_center absent (all children unavailableOffline):',
    !names.includes('mobile.mobile-apps'));
});
```
Expected: `true`. `mobile_center` is filtered itself AND has all children filtered, so it must stay hidden.

- [ ] **Step 9: THE PROOF for AC-23 — the Home snapshot diff must be EMPTY**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node homesnap.js --out=../after-t7/home-after.json
node -e "
const b=require('../baseline/home-before.json'), a=require('../after-t7/home-after.json');
const d=JSON.stringify(b)===JSON.stringify(a);
console.log('AC-23 home snapshot diff EMPTY:', d);
if(!d){
  for(const auth of Object.keys(b))
    if(JSON.stringify(b[auth])!==JSON.stringify(a[auth]))
      console.log('DIFFERS:',auth,'\nbefore:',JSON.stringify(b[auth],null,2),'\nafter:',JSON.stringify(a[auth],null,2));
}
process.exit(d?0:1);
"
```
Expected: `true`, exit 0 (**AC-23**). This is structurally guaranteed — `buildUserHome` reads only `homeMenuMap`, which this task does not touch — but a structural argument is not a measurement.

- [ ] **Step 10: Re-run the rendered route sweep (AC-24, now over the reshaped tree)**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node route-sweep.js --out=../after-t7/route-sweep.json
node -e "
const r=require('../after-t7/route-sweep.json');
const bad=r.filter(x=>x.sideMenuChildren===0||x.consoleErrors.length>0);
console.log('routes:',r.length,'FAILURES:',JSON.stringify(bad,null,2));
process.exit(bad.length?1:0);
"
```
Expected: exit 0. **This is the step that catches a blanked menu.** A build and a lint do not.

- [ ] **Step 11: Verify AC-21 — collapsed rail shows one icon per GROUP with a flyout**

Collapse the rail, then:
```js
const rows = [...document.querySelectorAll('.tb-side-menu > li')];
console.log('rail rows:', rows.length);
console.log('toggle tiles:', document.querySelectorAll('.tb-side-menu tb-menu-toggle').length);
// Click a group tile and confirm its flyout lists that group's pages.
const tile = document.querySelector('tb-menu-toggle a');
tile.click();
setTimeout(() => {
  const items = document.querySelectorAll('.tb-toggle-menu-items a');
  console.log('flyout rows:', items.length, [...items].map(a => a.textContent.trim()));
}, 300);
```
Expected: the collapsed rail shows **one icon per group** (fewer rows than the flattened baseline recorded in `baseline/geometry.json`), and the flyout lists that group's pages (**AC-21**).

- [ ] **Step 12: Verify Q1 — the flyout is CLICK-triggered, hover-expand stays abandoned**

```bash
cd /d/Github/airlinq-air/ui-ngx
grep -n "tbPopoverTrigger" src/app/modules/home/menu/menu-toggle.component.html
grep -n "preventDefault\|collapsed" src/app/modules/home/menu/menu-toggle.component.ts | head
```
Expected: `tbPopoverTrigger="click"` and the `if (this.collapsed) { event.preventDefault(); }` branch, both **unmodified** by this work item. Then confirm at runtime that hovering a collapsed group tile does NOT open the flyout, and clicking does.

- [ ] **Step 13: Lint delta and report, do not commit**

```bash
cd /d/Github/airlinq-air/ui-ngx
node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint 2>&1 | grep -E '✖ [0-9]+ problems'
```
Expected: identical to `baseline/lint-baseline.txt`.

Report the AC-19/21/22/23/24 proofs verbatim. **Rollback if rejected — the D4 emergency stop:** `git checkout -- ui-ngx/src/app/core/services/menu.models.ts`. This restores Option A's menu wholesale, independently of Tasks 6 and 8.

---

## Task 8: D4 part 3 — badge propagation into groups, and depth-independent opened-state

Two consequences of Task 7 that the requirement does not name but that would otherwise ship as regressions.

**Files:**
- Modify: `ui-ngx/src/app/modules/home/menu/menu-toggle.component.ts` — add `alarmCount$`
- Modify: `ui-ngx/src/app/modules/home/menu/menu-toggle.component.html:64-70` — pass `badgeCount`
- Modify: `ui-ngx/src/app/core/services/menu.service.ts:79` — one identifier

**Interfaces:**
- Consumes: the reshaped tree from Task 7 (`alarms` now nested under `monitor > alarms_center`); the badge geometry fix from Task 4
- Produces: `alarms` renders its badge in its nested position; `updateOpenedMenuSections()` restores nested toggles

- [ ] **Step 1: Reproduce the badge loss introduced by Task 7**

```js
console.log('badge elements in rail:', document.querySelectorAll('.tb-side-menu .tb-menu-badge').length);
```
Expected: **`0`** — because `menu-toggle.component.html:66` renders `<tb-menu-link [section]="page">` with **no** `badgeCount` binding, and `badgeCount` defaults to `null`. Expand `monitor` → `alarms_center` first so the row is rendered.

If the count is already > 0, the badge survived and this step's premise is wrong — record and report.

- [ ] **Step 2: Expose `alarmCount$` on the toggle component**

In `menu-toggle.component.ts`, mirror `side-menu.component.ts:38` exactly:

```ts
  /**
   * AIRLINQ (D4): the live alarm count, needed because restoring collapsible
   * groups moved `MenuId.alarms` (the only row carrying `badge: 'alarmCount'`)
   * from a top-level row rendered by `side-menu.component.html:23` - which DOES
   * pass `[badgeCount]` - into a group child rendered by this component, which
   * did not. Without this the badge silently disappeared.
   * Data-driven on `page.badge`, so no template compares menu ids.
   */
  alarmCount$ = this.alarmBadgeService.activeAlarmCount$;
```

and inject the service in the constructor:
```ts
  constructor(private store: Store<AppState>,
              private alarmBadgeService: AlarmBadgeService) {
  }
```
with the import `import { AlarmBadgeService } from '@core/services/alarm-badge.service';`.

- [ ] **Step 3: Pass the count through in the inline children list**

In `menu-toggle.component.html`, change the `@for` body at `:64-68` to:

```html
  @for (page of section.pages; track page.id) {
    <li>
      <!-- AIRLINQ (D4): mirrors side-menu.component.html:23 so a group child that
           carries a badge keeps it after the Option B re-nesting. -->
      <tb-menu-link [section]="page"
                    [badgeCount]="page.badge === 'alarmCount' ? (alarmCount$ | async) : null"></tb-menu-link>
    </li>
  }
```

Leave the flyout `@for` at `:78-85` alone — those are hand-written anchors, not `tb-menu-link`, so they have no badge mechanism. That is **out of scope** (design §9.6) and is recorded as a follow-up, not fixed here.

- [ ] **Step 3b: Confirm the `async` pipe works under `OnPush` in this component**

`tb-menu-toggle` is `ChangeDetectionStrategy.OnPush` (`menu-toggle.component.ts:29`). The
`async` pipe marks the view dirty on emission, so this is sound — and `tb-side-menu` is
also `OnPush` and already uses the identical `alarmCount$ | async` binding
(`side-menu.component.ts:26,38`), so the pattern is proven in this exact context. Confirm
it empirically rather than by argument, because a silently non-updating badge looks
identical to a working one until the count changes:

```js
const el = document.querySelector('tb-menu-toggle');
const cmp = ng.getComponent(el);
console.log('alarmCount$ present:', !!cmp.alarmCount$);
cmp.alarmCount$.subscribe(n => console.log('emitted count:', n));
```
Expected: `alarmCount$ present: true` and at least one emitted value. Then confirm the
rendered badge text matches that emitted value.

- [ ] **Step 4: Verify the badge is back, and still correct after Task 4's geometry fix**

Expand `monitor` → `alarms_center`, then re-run Task 4 Step 4's geometry assertions:
```js
console.log('badge elements:', document.querySelectorAll('.tb-side-menu .tb-menu-badge').length);
const b = document.querySelector('.tb-side-menu .tb-menu-badge');
const rb = b.getBoundingClientRect(), rr = b.closest('a').getBoundingClientRect();
console.log('AC-6 height<=18 & w>=h:', rb.height <= 18 && rb.width >= rb.height, rb.height, rb.width);
console.log('AC-8 centred +/-2px  :', Math.abs((rb.top+rb.bottom)/2 - (rr.top+rr.bottom)/2) <= 2);
```
Expected: count ≥ 1, and AC-6/AC-8 still `true` in the nested position, both themes. This is why Task 4 ran before Task 7.

- [ ] **Step 5: Reproduce the nested opened-state loss**

```js
const cmp = ng.getComponent(document.querySelector('tb-side-menu'));
cmp.menuSections$.subscribe(secs => {
  const walk = (ss, d = 0, out = []) => (ss.forEach(s => { out.push({name: s.name, type: s.type, depth: d, opened: s.opened}); if (s.pages) walk(s.pages, d + 1, out); }), out);
  console.log(JSON.stringify(walk(secs).filter(s => s.type === 'toggle'), null, 2));
});
```
Navigate to `/alarms/alarms` and re-read. Expected **before the fix**: `monitor` (depth 0) is `opened: true` via `|| section.active`, but `alarms_center` (depth 1) is **not** — so the active row is hidden inside a shut nested group.

- [ ] **Step 6: Make the opened-state restore depth-independent**

In `menu.service.ts`, change `updateOpenedMenuSections()`:

```ts
  private updateOpenedMenuSections() {
    const openedMenuSections = getCurrentOpenedMenuSections(this.store);
    // AIRLINQ (D4): filter the FLATTENED section list, not just the top level.
    // Option B re-nests `alarms_center` and `notifications_center` INSIDE
    // `monitor`, and the original `currentMenuSections` filter does not recurse -
    // so a nested toggle never had its persisted `opened` state restored and
    // never picked up `active`, leaving the active row hidden inside a shut
    // group. `_availableMenuSections` is the already-flattened list built one
    // line earlier by `allMenuSections()`, so this needs no new traversal.
    // Additive in effect: it restores MORE state, never less.
    if (this._availableMenuSections?.length) {
      this._availableMenuSections.filter(section => section.type === 'toggle' &&
        (openedMenuSections.includes(section.path) || section.active)).forEach(
        section => section.opened = true
      );
    }
  }
```

Confirm the call order supports this — `_availableMenuSections` is assigned at `:66`, before `updateOpenedMenuSections()` at `:68`:
```bash
cd /d/Github/airlinq-air/ui-ngx && sed -n '60,72p' src/app/core/services/menu.service.ts
```
Expected: `_availableMenuSections = ...` precedes `this.updateOpenedMenuSections()`.

- [ ] **Step 7: Verify AC-20 — toggle, and persistence across a route change**

Per design §9.4, AC-20 as literally written is confounded by `|| section.active`, which auto-opens the group containing the current route. Test the two behaviours separately.

(a) Toggling works:
```js
const t = document.querySelector('tb-menu-toggle');
const before = ng.getComponent(t).section.opened;
t.querySelector('a').click();
setTimeout(() => console.log('AC-20a toggles:', ng.getComponent(t).section.opened !== before), 200);
```
Expected: `true`.

(b) State persists across a route change that lands **outside** the group: open `monitor`, navigate to `/entities/devices` (outside), and confirm `monitor.opened === true` still. Then close `monitor`, navigate outside again, and confirm it stays closed.
Expected: both hold (**AC-20**).

(c) The documented auto-open: with `monitor` closed, navigate to `/alarms/alarms` and confirm `monitor` AND `alarms_center` both open.
Expected: both `opened: true` — this is the §5.4 fix working, and the behaviour §9.4 asks to have AC-20 reworded around. Record it as expected, not as a failure.

- [ ] **Step 8: Verify Q2 — groups default COLLAPSED on first login**

Clear the persisted preference and log in fresh:
```js
// Clear only the menu preference, then reload to /home.
const k = Object.keys(localStorage).filter(x => /opened.*menu|menu.*opened/i.test(x));
console.log('clearing preference keys:', k);
k.forEach(x => localStorage.removeItem(x));
location.href = '/home';
```
Then:
```js
const cmp = ng.getComponent(document.querySelector('tb-side-menu'));
cmp.menuSections$.subscribe(secs => {
  const walk = (ss, out = []) => (ss.forEach(s => { out.push(s); if (s.pages) walk(s.pages, out); }), out);
  const toggles = walk(secs).filter(s => s.type === 'toggle');
  console.log('Q2 all groups collapsed on first login:', toggles.every(s => !s.opened));
  console.log(JSON.stringify(toggles.map(s => ({name: s.name, opened: !!s.opened}))));
});
```
Expected: `true`. `/home` is a top-level `link` in no group, so nothing is `active` and every group starts closed.

- [ ] **Step 9: Re-run the rendered route sweep**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node route-sweep.js --out=../after-t8/route-sweep.json
node -e "
const r=require('../after-t8/route-sweep.json');
const bad=r.filter(x=>x.sideMenuChildren===0||x.consoleErrors.length>0);
console.log('routes:',r.length,'FAILURES:',JSON.stringify(bad,null,2));
process.exit(bad.length?1:0);
"
```
Expected: exit 0.

- [ ] **Step 10: Lint delta and report, do not commit**

```bash
cd /d/Github/airlinq-air/ui-ngx
node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint 2>&1 | grep -E '✖ [0-9]+ problems'
```
Expected: identical to `baseline/lint-baseline.txt`.

**Rollback if rejected:** revert `menu-toggle.component.{ts,html}` and the one identifier in `menu.service.ts`.

---

## Task 9: Cross-cutting proofs over the full change stack

Runs last, over all of Tasks 3–8 together. Nothing here changes product code.

**Files:**
- Create: `.claude/team/artifacts/left-menu-defect-fixes/final/` (all proofs)

**Interfaces:**
- Consumes: every `baseline/*` artifact from Tasks 1–2; the pristine worktree at `d:/tmp/airlinq-pristine`
- Produces: the G3 evidence pack

- [ ] **Step 1: AC-28 — the Airlinq Blue light palette is byte-identical**

```bash
cd /d/Github/airlinq-air
node -e "
const fs=require('fs');
const s=fs.readFileSync('ui-ngx/src/styles.scss','utf8').replace(/\r\n/g,'\n');
const out={};
s.split('\n').forEach((l,i)=>{const m=l.match(/(--aq-[a-z0-9-]+)\s*:\s*([^;]+);/);
  if(m)(out[m[1]]=out[m[1]]||[]).push({line:i+1,value:m[2].trim()});});
const before=require('./.claude/team/artifacts/left-menu-defect-fixes/baseline/tokens-light.json');
const same=JSON.stringify(before)===JSON.stringify(out);
console.log('AC-28 light palette byte-identical:',same);
if(!same) for(const k of new Set([...Object.keys(before),...Object.keys(out)]))
  if(JSON.stringify(before[k])!==JSON.stringify(out[k]))
    console.log('CHANGED',k,JSON.stringify(before[k]),'->',JSON.stringify(out[k]));
process.exit(same?0:1);
"
```
Expected: `true`, exit 0. This work item touches no `styles.scss` line, so any diff is a mistake.

- [ ] **Step 2: AC-26a — dark declaration-level identity (and the multiset proof)**

Re-run Task 1 Step 8's script and compare:
```bash
cd /d/Github/airlinq-air
# re-dump, then diff the multiset against the baseline
node -e "
const fs=require('fs');
const a=require('./.claude/team/artifacts/left-menu-defect-fixes/baseline/dark-declarations.json');
// (re-extract into b using the identical brace-matching routine from T1S8)
const b=JSON.parse(fs.readFileSync('./.claude/team/artifacts/left-menu-defect-fixes/final/dark-declarations.json','utf8'));
const ms=x=>x.reduce((m,d)=>(m[d]=(m[d]||0)+1,m),{});
const A=ms(a),B=ms(b);
const keys=new Set([...Object.keys(A),...Object.keys(B)]);
const diff=[...keys].filter(k=>(A[k]||0)!==(B[k]||0));
console.log('AC-26a declaration MULTISET diff:',JSON.stringify(diff));
process.exit(diff.length?1:0);
"
```
Expected: `[]`, exit 0. Use the **multiset** comparison (name+value with counts), which is the correct proof when only a selector wrapper changes and the digest necessarily moves. Publish the hash convention alongside any digest: UTF-8 → CRLF→LF → brace-match the **second** top-level `.tb-dark {` → join with `\n`, no trailing newline → sha256.

- [ ] **Step 3: AC-26b — measure a per-route noise floor FIRST (same server vs itself)**

A small cross-server pixel delta means nothing until the same server is compared against itself. Do this before any cross-server diff, and let it pick the targets.

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node noisefloor.js --server=http://localhost:4200 --theme=dark --runs=2 \
  --out=../final/noise-floor.json
cat ../final/noise-floor.json
```
Expected: `/entities/devices`, `/entities/assets`, `/alarms`, `/profiles/deviceProfiles` at ~0px self-difference. **`/home` is NOT stable — 4.07% self-difference from animating widgets and streaming telemetry — and MUST be excluded** from the cross-server comparison.

Every capture must set `reducedMotion: 'reduce'`, park the pointer, blur focus, and assert zero hovered rows: `:hover` follows the mouse across navigation and one hovered table row cost 74k phantom pixels last item.

- [ ] **Step 4: Serve pristine `d2263de9da` alongside and diff dark chrome**

```bash
cd /d/tmp/airlinq-pristine/ui-ngx
node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js serve --port 4300 &
```
Wait for "Compiled successfully", then:
```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
node twoserver.js --a=http://localhost:4300 --b=http://localhost:4200 \
  --theme=dark --exclude=/home --routes-from=../final/noise-floor.json \
  --out=../final/dark-pixel-diff.json
node -e "
const r=require('../final/dark-pixel-diff.json');
const bad=r.filter(x=>x.diffPixels>x.noiseFloorPixels);
console.log('AC-26b routes compared:',r.length);
console.log('EXCEEDING NOISE FLOOR:',JSON.stringify(bad,null,2));
process.exit(bad.length?1:0);
"
```
Expected: every route's cross-server diff is **at or below its measured noise floor**, exit 0 (**AC-26b**).

Note: the rail is present on every route, so a dark rail regression from Tasks 3/4/6/7/8 shows up here on all of them at once.

- [ ] **Step 5: AC-29 — no new `!important`, counted as DECLARATIONS not text hits**

```bash
cd /d/Github/airlinq-air
git diff -- ui-ngx/ | grep '^+' | grep -v '^+++' | grep '!important' | tee /tmp/imp.txt
wc -l < /tmp/imp.txt
```
Expected: `0`. If non-zero, for each hit confirm it is **inside a `/* */` or `//` comment span** (specificity prose produced 27 string hits and 0 real declarations last item) and that it is **not** pre-existing at HEAD:
```bash
while read -r l; do
  txt=$(echo "$l" | sed 's/^+//')
  echo "--- $txt"
  git grep -c -F "$txt" d2263de9da -- ui-ngx/ || echo "NOT AT BASELINE - REAL NEW !important"
done < /tmp/imp.txt
```

- [ ] **Step 6: AC-30 — every rule is in the OWNING component's stylesheet**

Read `_nghost`/`_ngcontent` off the **real** elements, not from the source. The rail has four owners plus `tb-user-menu`.

```js
const owners = {
  '.tb-brand-wordmark': 'home.component',
  '.tb-menu-badge': 'tb-menu-link',
  '.tb-menu-section': 'tb-side-menu',
  'tb-menu-toggle a': 'tb-menu-toggle',
  '.tb-user-overflow': 'tb-user-menu'
};
for (const [sel, expected] of Object.entries(owners)) {
  const el = document.querySelector(sel);
  if (!el) { console.log(sel, 'NOT FOUND'); continue; }
  const attrs = [...el.attributes].map(a => a.name).filter(n => /_ngcontent|_nghost/.test(n));
  console.log(sel, '=> expected owner', expected, '| attrs', attrs);
}
```
Expected: each element's `_ngcontent-*` matches the component whose stylesheet carries its rule — `.tb-brand-wordmark` → `home.component` (`_ngcontent-ng-c935555661`), `.tb-menu-badge` → `tb-menu-link`, `.tb-user-overflow` → `tb-user-menu`. A rule in a neighbouring component's file is **unmatchable**, however specific it looks.

- [ ] **Step 7: AC-27 — contrast sweep with PAINTED rows, both themes**

Run the rail contrast sweep over: the wordmark, every nav label and icon, the active-row label, the badge text and background, the user display name, the user authority, and the overflow glyph.

For each pair record **both** the computed value **and** the decoded painted pixel. `getComputedStyle` can be right while the painted pixel is wrong for three recorded reasons — `opacity` compositing, a gradient's varying width, and a z-index sibling painting over (the `/home` navy lives on `div.mat-fab-toolbar-background`, z-index 21, so an ancestor-walking `bgOf()` reported `#eeeeee`). Pair every background claim with `elementFromPoint` **plus** a PNG pixel decode.

Expected: **no pair that passed at baseline now fails**; new/changed inks meet 4.5:1 (text) and 3:1 (non-text). No colour is changed by this item, so this should pass by construction — the risk is that D2/D3 moved elements onto different background pixels.

- [ ] **Step 8: AC-31 — build exits 0 and the lint delta is zero**

```bash
export JAVA_HOME=/d/tmp/tools/jdk-25
export PATH="$JAVA_HOME/bin:/d/tmp/tools/apache-maven-3.9.9/bin:$PATH"
cd /d/Github/airlinq-air
mvn install -DskipTests --projects ui-ngx -Dlicense.skip=true; echo "exit=$?"
cd ui-ngx
node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint 2>&1 | grep -E '✖ [0-9]+ problems'
cat ../.claude/team/artifacts/left-menu-defect-fixes/baseline/lint-baseline.txt
```
Expected: `exit=0`, and the two lint lines **identical** (**AC-31**). Do NOT run `mvn license:format`.

- [ ] **Step 9: AC-32 — the final screenshot matrix**

```bash
cd /d/Github/airlinq-air/.claude/team/artifacts/left-menu-defect-fixes/harness
for theme in light dark; do for rail in expanded collapsed; do for size in 1600x1000 390x844; do
  node capture.js --theme=$theme --rail=$rail --width=$size --out=../final/$theme-$rail-$size.png
done; done; done
ls ../final/*.png | wc -l
```
Expected: 8 PNGs, paired with Task 1's 8 baselines — 4 defects × 2 themes × 2 rail states × 2 widths all represented (**AC-32**).

- [ ] **Step 10: Write the AC coverage table**

Produce `final/ac-coverage.md`: one row per AC-1..AC-32 with the measured value, PASS/FAIL, and the artifact path holding the evidence. Any FAIL or any "not measured" is a G3 blocker — report it, do not narrate around it.

- [ ] **Step 11: Tear down the pristine server and worktree**

```bash
cd /d/Github/airlinq-air
git worktree remove /d/tmp/airlinq-pristine --force
git worktree list
```
Expected: only the main worktree remains. (Kill the port-4300 `ng serve` first.)

---

## Task 10: ADR 0005, and the supersede notes on all three prior documents (AC-25)

Docs only. Do not leave ADR 0003 contradicting the code.

**Files:**
- Create: `docs/adr/0005-collapsible-menu-groups-supersedes-0003.md`
- Modify: `docs/adr/0003-sectioned-menu-model.md` — header only, body untouched
- Modify: `docs/requirements/left-menu-and-favicon.md` — supersede note
- Modify: `docs/design/left-menu-and-favicon.md` — supersede note

**Interfaces:**
- Consumes: the measured outcomes from Tasks 7–9 (the ADR's Consequences must cite real numbers)
- Produces: three documents agreeing with the code and with each other

- [ ] **Step 1: Confirm the ADR number is `max + 1` and no number is reused**

```bash
cd /d/Github/airlinq-air && ls docs/adr/
```
Expected: `0001`…`0004` present, `0005` absent. **Never reuse a retired number.**

- [ ] **Step 2: Write ADR 0005**

Create `docs/adr/0005-collapsible-menu-groups-supersedes-0003.md` in MADR short-Nygard form (Context / Decision / Consequences / Alternatives), matching the house style of 0001–0004:

```markdown
# 0005 — Collapsible menu groups (Option B), superseding the sectioned menu model

- **Status:** proposed (awaiting human approval at G2)
- **Date:** 2026-09-08
- **Deciders:** human (product owner), technical-architect
- **Context work item:** `left-menu-defect-fixes`
- **Supersedes:** [ADR 0003 — A section-heading type in the menu model, and a sectioned TENANT_ADMIN tree](0003-sectioned-menu-model.md)

## Context

ADR 0003 adopted Option A ("Sectioned"): every page one click away, groups replaced by
uppercase section headings, `toggle` retained for only five true sub-menus. It shipped.

Option A optimised the EXPANDED rail and silently degraded the COLLAPSED one — which is
the state the rail ships in most of the time. Flattening every multi-page group into
top-level `link` rows meant the collapsed rail rendered **one icon per page instead of one
per group**. Two consequences, both observed on the deployed demo:

1. **It does not scale.** The collapsed rail became a long undifferentiated icon column
   that grows with every page added, with no visual grouping to navigate by.
2. **It loses the group affordance entirely.** The flyout popover is the collapsed rail's
   only way to express a group. With no `toggle` parents there was nothing to show, so the
   collapsed rail could no longer tell the user which pages belonged together.

The human reviewed the deployed result and reversed the decision on **2026-09-08**.

## Decision

**Multi-page groups return to `type: 'toggle'` (Option B). The collapsed rail shows one
icon per group with a click-to-open flyout.**

Constraints, all binding:

1. **Click, not hover.** Collapsed groups open as flyout popovers OUTSIDE the rail, so a
   hover-expand would collapse the moment the pointer travelled to the flyout. Hover-expand
   stays abandoned (human ruling Q1). Today's `tbPopoverTrigger="click"` mechanism is kept
   unmodified.
2. **Groups default to COLLAPSED on first login**; per-user state persists thereafter via
   the existing `openedMenuSections` preference (human ruling Q2).
3. **`'section'` is RETAINED.** `MenuSectionType` keeps its fourth member and its
   `@switch` arm. The headings still group the expanded rail, they are already shipped and
   inert, and the type is used by all three authority trees. This reversal is about
   `link`-vs-`toggle`, not about headings.
4. **`menuFilters` is still not edited.** Not one line. ADR 0003 constraint 3 survives the
   reversal intact.
5. **`homeMenuMap` is the reference shape.** It preserved the pre-reshape tree verbatim, so
   the rail tree converges back onto the tree the Home page never stopped using. The
   reversal is largely a DELETION of the fork's own divergence, not new invention.
6. **The opened-state restore must be depth-independent.** `updateOpenedMenuSections()`
   originally filtered only top-level sections; Option B nests toggles inside toggles, so it
   now filters the flattened `_availableMenuSections`. Without this a nested group never
   restores its state and hides the active row.
7. **Equivalence is proved, not argued** — carried forward from ADR 0003 constraint 6 and
   strengthened: a per-authority pageset diff (LOST []/GAINED []) after redirect resolution,
   AND a RENDERED all-routes sweep counting `.tb-side-menu` children > 0.

## Consequences

**Positive**
- The collapsed rail regains one icon per group and a flyout that has something to show.
- Re-nesting restores `filterMenuReference`'s parent-hiding, which flattening bypassed —
  ADR 0003 constraint 4 is now honoured *a fortiori*.
- Fork divergence DECREASES: the tree returns toward upstream's own shape.

**Negative / accepted costs**
- **The `.pages` hazard class is live again, in mirror image.** Option A's risk was a
  consumer dereferencing `.pages` on a pages-less `link`. Option B's is a `toggle` whose
  `pages` is absent or empty. `menu-toggle.component.ts:57` (`sectionHeight()`, bound to
  `[style.height]` and therefore run on every change-detection cycle) was unguarded and is
  now guarded. This failure class BUILDS, LINTS AND GREPS CLEAN while blanking the entire
  side menu, so the rendered route sweep is the only sufficient check.
- **Badge propagation is now a group concern.** `MenuId.alarms` carries the only
  `badge: 'alarmCount'` and moved from a top-level row (whose renderer passes `badgeCount`)
  into a group child (whose renderer did not). `tb-menu-toggle` now propagates it. The
  collapsed-rail FLYOUT rows are hand-written anchors with no badge mechanism — accepted
  and recorded as a follow-up, not fixed here.
- **Pages are one click further away in the expanded rail.** This is the trade ADR 0003
  made in the other direction, now made deliberately in favour of the collapsed rail.

## What of ADR 0003's rationale still stands

Most of it. This is a reversal of one decision, not a repudiation of the analysis:

- **The reachability finding is fully vindicated.** "No stylesheet can invent a heading the
  data has no type for, and none can turn an accordion into a navigating link" is exactly
  the argument this reversal uses in the opposite direction: restoring groups is likewise a
  MODEL change, not a styling change. The layer-reachability check stays a G1 gate.
- **The `'section'` type was a genuine model gap** and is kept (constraint 3 above).
- **`menuFilters` immutability** (0003 constraint 3) remains binding.
- **Never flatten a group whose children are all filtered** (0003 constraint 4) is honoured
  by not flattening at all.
- **Equivalence proved, not argued** (0003 constraint 6) is carried forward and strengthened.
- **The recorded silent failure mode** — a `MenuSectionType` value with no `@switch` arm
  renders nothing, with no error — stands as a live warning, and is why `'section'` keeps
  its arm rather than being deleted.

**What is actually overturned** is ADR 0003 constraint 2 ("`toggle` is retained for exactly
five true sub-menus; every other row navigates directly") and the flattened TENANT_ADMIN
tree that followed from it.

## Alternatives considered

- **Keep Option A and fix only the collapsed rail's density** (e.g. smaller icons, a
  scrolling rail). Rejected: it treats the symptom. The collapsed rail's problem is not
  size but the absent grouping, which no amount of density recovers.
- **Hybrid — flat in the expanded rail, grouped when collapsed.** Rejected: it needs two
  divergent trees for one menu, doubling the equivalence-proof surface, and the rail would
  reorganise itself as the user collapses it, which is disorienting.
- **Amend ADR 0003 in place** rather than superseding it. Rejected on process grounds: an
  ADR is an immutable decision record, and editing 0003's Decision to say the opposite would
  destroy the audit trail this note exists to protect. MADR has a `superseded` status for
  exactly this case.
```

Fill the Consequences with the **measured** outcomes from Tasks 7–9 (pageset diff result, route-sweep count, badge verification) rather than predictions.

- [ ] **Step 3: Mark ADR 0003 superseded — header only**

Edit **only** the header block of `docs/adr/0003-sectioned-menu-model.md`:

```markdown
- **Status:** superseded by [ADR 0005](0005-collapsible-menu-groups-supersedes-0003.md) on 2026-09-08
- **Superseded by:** [0005 — Collapsible menu groups (Option B)](0005-collapsible-menu-groups-supersedes-0003.md)
```

Then insert immediately below the header, before `## Context`:

```markdown
> **SUPERSEDED 2026-09-08.** Option A ("sectioned / every page one click away") was
> **reversed by human decision** in work item `left-menu-defect-fixes`. On the COLLAPSED
> rail, flattening groups rendered one icon per PAGE rather than one per GROUP — which does
> not scale and loses the group affordance entirely, because the flyout (the collapsed
> rail's only way to express a group) had nothing to show. Multi-page groups are `toggle`
> parents again. **What still stands:** the reachability finding below, the `'section'` type
> (retained), constraint 3 (`menuFilters` untouched), constraint 4, and constraint 6
> (equivalence proved, not argued). **What is overturned:** constraint 2's link/toggle
> assignment and the flattened TENANT_ADMIN tree. See
> [ADR 0005](0005-collapsible-menu-groups-supersedes-0003.md). The body below is preserved
> unedited as the historical record.
```

**Do not edit 0003's Context, Decision, Consequences or Alternatives.** The body is the audit trail.

- [ ] **Step 4: Add the supersede note to the previous requirement**

At the top of `docs/requirements/left-menu-and-favicon.md`, immediately after the title:

```markdown
> **PARTIALLY SUPERSEDED 2026-09-08.** The menu-structure decision in this document
> (Option A · Sectioned — flat rows under uppercase headings, every page one click away)
> was **reversed by human decision** in work item `left-menu-defect-fixes`: multi-page
> groups are collapsible `toggle` parents again, and the collapsed rail shows one icon per
> group with a click-to-open flyout. Rationale and scope in
> [ADR 0005](../adr/0005-collapsible-menu-groups-supersedes-0003.md). Every other
> requirement in this document (favicon, rail anatomy, the 64px head band, the user block,
> the alarm badge) still stands.
```

- [ ] **Step 5: Add the supersede note to the previous design doc**

At the top of `docs/design/left-menu-and-favicon.md`, immediately after the title, the same note reworded for a design doc — naming explicitly that its Option A section, its `MenuSectionType` reshape and its flattened TENANT_ADMIN tree are the superseded parts, and that the `'section'` type itself is **retained**.

- [ ] **Step 6: Verify all four documents agree — no contradiction survives**

```bash
cd /d/Github/airlinq-air
grep -l "SUPERSEDED\|superseded" docs/adr/0003-sectioned-menu-model.md \
  docs/requirements/left-menu-and-favicon.md docs/design/left-menu-and-favicon.md
grep -c "0005" docs/adr/0003-sectioned-menu-model.md \
  docs/requirements/left-menu-and-favicon.md docs/design/left-menu-and-favicon.md
ls docs/adr/0005-*.md
```
Expected: all three prior documents carry a supersede note pointing at 0005, and 0005 exists (**AC-25**).

- [ ] **Step 7: Confirm no `.dc.html` artboard was touched**

```bash
cd /d/Github/airlinq-air && git status --porcelain -- 'docs/design/**/*.dc.html'
```
Expected: empty. `mvn license:format` would inject Apache headers into these spec artboards and corrupt the source of truth — it must not have been run.

- [ ] **Step 8: Report the four document paths to Jarvis, do not commit**

**Rollback if rejected:** `git checkout -- docs/` and delete `docs/adr/0005-*.md`. Docs only; no code risk.

---

## Handover notes for the Developer

- **G2 must pass before you start.** This plan reaches you only after human approval via Jarvis.
- **You do not redesign.** If a STOP CONDITION fires — a measured winning rule that differs from the design's, an AC-2 centring miss, an AC-18 toolbar regression, an unenumerated `.pages` consumer, or an AC-14 residual misalignment — record the measurement and return to the architect. Tasks 4 and 5 in particular are **confirm-then-fix**: the D2/D3 winning rules are read from source and from Material's shipped template, and source reading is a hypothesis until the browser agrees.
- **Two steps are BLOCKED pending human rulings** and must not be started until Jarvis relays them: Task 4 Step 8 (the "99+" cap, which **does not currently exist in the code** despite ruling Q3 — design §9.2) and the `'section'`-retention question (design §9.3, which would change Task 7 Step 4 and the AC-19/AC-22 expectations).
- **AC-20 is confounded as written** (design §9.4). Test the three behaviours in Task 8 Step 7 separately and report the auto-open as expected, not as a failure.
- **Structural proof is not visual proof.** Task 6 Step 6 and Task 7 Step 10 are the only checks that catch a blanked menu; a build and a lint do not.
- **No commits, no deploy.** Report; the human commits.
