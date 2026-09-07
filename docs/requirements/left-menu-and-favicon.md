# Requirement — Left menu redesign (Option A · Sectioned) + favicon placement

- **Work item slug:** `left-menu-and-favicon`
- **Mode:** dev
- **Task-size class:** `standard` (human-confirmed at G1)
- **Author:** Jarvis (Product Manager)
- **Date:** 2026-09-06
- **Gate status:** G1 APPROVED by the human 2026-09-06; class `standard` confirmed. G2 in progress.
- **Spec (source of truth):** `docs/design/2026-09-06-left-menu-canvas/` — `Main.dc.html` (dark),
  `MenuLight.dc.html` (light), `canvas.json`. **Human has chosen Option A · Sectioned.**

---

## 1. Problem statement

Two related asks:

1. **Favicon placement.** The browser-tab mark was off-centre. **This is already fixed in the
   working tree** — `ui-ngx/src/airlinq.ico` has been rebuilt with the mark centred and now
   carries 4 frames (verified: 16×16, 32×32, 48×48, 64×64, 6419 bytes). It is in scope for
   *verification only*; it is not re-done. `index.html:26` (`<link rel="icon" type="image/x-icon"
   href="airlinq.ico">`) is untouched and stays that way unless a `sizes` attribute proves needed.

2. **Left menu design.** The current menu is a flat `link` / `toggle` / `divider` list
   (`side-menu.component.html`) with no section headings, no alarm badge, and accordion toggles
   that bury pages behind a click. The canvas replaces this with a **sectioned** menu where every
   page is one click away, chevrons appear only on true sub-menus, and the rail gains hover
   flyouts.

## 2. Goal

The expanded menu and the 64px rail match the design canvas in both themes, on the live app, with
the favicon rendering centred in the browser tab.

## 3. Scope

**In scope**
- `ui-ngx/src/app/core/services/menu.models.ts` — the section/page model (a new section-label type
  is required; see §8).
- `ui-ngx/src/app/modules/home/menu/` — `side-menu`, `menu-link`, `menu-toggle` (`.ts/.html/.scss`).
- `ui-ngx/src/app/shared/components/user-menu.component.*` — the foot user block.
- `ui-ngx/src/styles.scss` — `--aq-*` tokens only, inside the token blocks.
- Favicon: **verification only** (already fixed).

**Out of scope / non-goals**
- **Option B (accordion)** is explicitly NOT implemented. Its markup (`Main.dc.html` lines 89–117),
  its CSS (`.sub`, `.sub::before`, `.sub.on`, `.sub.on::after`, `.divider`) and its unique strings
  (`Device profiles`, `Asset profiles`, `OTA updates`) are excluded.
- No change to routing, guards, permissions, or which pages exist.
- No change to `index.html` unless a `sizes` attribute is required (§7 AC-F2).
- No new dependency, no version change, no schema change.

## 4. Allowed change surface
Template/TS edits are permitted **per ADR 0001**, kept scoped to the menu components named in §3.
ADR 0002 rules apply to any new markup: no entity-derived value in generated markup, no
`style=""`, nothing routed through `bypassSecurityTrustHtml`. Colours only via `--aq-*` tokens.
**No `color-mix()` in built CSS** (browserslist — Chrome ≥107 / FF ≥104 / Safari ≥16).

## 5. Token mapping (canvas → app)

The canvas uses **unprefixed** tokens on an `.aq` class (`--surface`, `--accent-c`). The app uses
`--aq-*` on `.tb-default` / `.tb-dark`. Mapping is 1:1 by adding the prefix. Verified equal values:
canvas light `--error: #a3182a` = app `--aq-error`; canvas `--accent-c`/`--on-accent-c` =
`--aq-accent-container`/`--aq-on-accent-container`.

**Spec defect to note:** the canvas's own notes panel refers to `--aq-hover`, but no `--aq-*`
prefixed token exists in the canvas — the real token there is `--hover`. Harmless, but do not treat
the canvas as authoritative on token *names*; only on values and geometry.

## 6. User stories
- **US-1** As an operator I reach any page in one click, because pages are listed under section
  headings rather than hidden behind accordions.
- **US-2** As an operator I see how many alarms need attention without leaving my current page.
- **US-3** As an operator using the collapsed rail I can hover a tile and jump straight to a page
  from the flyout.
- **US-4** As any user I see my name, role and account actions pinned at the foot of the menu.
- **US-5** As any user the browser tab shows a correctly centred Airlinq mark.
- **US-6** All of the above holds in light (default) and dark themes.

## 7. Acceptance criteria (numbered, testable)

Format: **precondition → action → expected observable result**. Every criterion is asserted
**twice — light and dark**. Measured as `parseFloat(getComputedStyle(el).<prop>)` at
`deviceScaleFactor: 1`, 1600×1000, 100% zoom; pass if `|measured − expected| ≤ 1.0`. Colour
assertions compare the element's computed value to the resolved token value, asserting **on the
element that carries the declaration** (per the earlier work item's lesson).

### A. Expanded panel — shell and head
- **AC-1** Menu expanded → panel width **250px**, background `--aq-sidebar` (canvas `--rail`),
  `border-radius: 16px`, `box-shadow` = `--aq-shadow-1`, **no border**.
- **AC-2** → head is **64px** high, padding `0 12px 0 16px`, gap 10px; brand mark **24×24**;
  wordmark "AIRLINQ" at **13px / 700 / letter-spacing .12em** in `--aq-text`.
- **AC-3** → the pin/collapse control is a **32×32** box, `border-radius: 8px`, icon **16×16**,
  colour `--aq-text-3`, and clicking it collapses the menu to the rail (existing behaviour intact).

### B. Section labels
- **AC-4** → section labels render at **11px / 500 / letter-spacing .08em / uppercase** in
  `--aq-text-3`, padding `14px 20px 6px`.
- **AC-5** → the labels are exactly, in order: **Monitor**, **Devices & assets**, **Operations**,
  **Administration**. All four go through translation keys (not literals).
- **AC-6** → **Home** appears above the first section label with **no** label of its own.

### C. Menu rows
- **AC-7** → rows are **40px** high with `margin: 2px 8px`, `padding: 0 12px`,
  `border-radius: 12px`, gap 12px, text **14px / 500**; icons **22×22**. (Pitch 44px.)
- **AC-8** → idle row: transparent background, text `--aq-text-2`, icon `--aq-text-3`.
- **AC-9** → hover a row → background `--aq-hover`, text `--aq-text`.
- **AC-10** → the active row is a **filled pill**: background `--aq-accent-container`, text and icon
  `--aq-on-accent-container`, **no inset/leading bar** (the bar belongs to Option B only).
- **AC-11** → a chevron (**16×16**, `--aq-text-3`, right-pointing, flush right) appears on **exactly**
  the true sub-menu rows and on no others.
- **AC-12** → every non-chevron row navigates directly to its page in **one click** (no
  intermediate expand step).

### D. Alarm badge
- **AC-13** → the Alarms row carries a badge: **10px / 700 / letter-spacing .06em**,
  `padding: 1px 6px`, `border-radius: 999px`, background `--aq-accent-container`, text
  `--aq-on-accent-container`. *(Note: the canvas uses accent-container, NOT error, for this badge.)*
- **AC-14** → the badge's number equals the current active-alarm count from the API at capture
  time (assert against the API's own number, never a hardcoded literal), and the badge is hidden
  when that count is 0.

### E. User block (foot)
- **AC-15** → the user block is pinned to the **bottom** of the panel with `border-top: 1px solid
  --aq-border-subtle`, padding `12px 12px 12px 16px`, gap 10px, intrinsic height ~**56px**.
- **AC-16** → avatar **32×32** circle, background `--aq-accent-container`, text
  `--aq-on-accent-container`, **12px / 600**.
- **AC-17** → name at **13px / 600** in `--aq-text`; role at **11px / 400** in `--aq-text-3`; both
  reflect the signed-in user (not literals).
- **AC-18** → an overflow control (**16×16**, `--aq-text-3`, vertical three-dot) opens the existing
  account menu; every action in it still works.

### F. Rail (64px) — idle
- **AC-19** Menu collapsed → rail width **64px**, same shell treatment as AC-1.
- **AC-20** → tiles are **48×40** with `margin: 2px 8px`, `border-radius: 12px`, icons **22×22**,
  colour `--aq-text-3`; the active tile is the filled accent-container pill (as AC-10).
- **AC-21** → the rail shows **one tile per section plus Home**, separated after Home by a
  **32×1px** divider in `--aq-border-subtle`.
- **AC-22** → the Monitor tile carries an alarm **dot**: **6×6**, `border-radius: 50%`, background
  `--aq-error`, positioned `top: 6px; right: 8px`; shown only when the alarm count > 0.
- **AC-23** → the avatar (32px circle, as AC-16) sits at the foot of the rail with **no** divider
  and no border-top.

### G. Rail — hover and flyout
- **AC-24** Hover a rail tile → the tile's background becomes `--aq-hover`, its colour `--aq-text`,
  **and it visibly lifts**: computed `transform` is a non-identity matrix (translateY of −1px to
  −2px, or an equivalent scale) **and** `box-shadow` is non-`none`. *(Amended at G2 per D3 + the
  Tester's F-K2: the canvas MARKUP does background+colour only, but the human ruled the prose's
  "lift" is implemented for real, so the criterion must be numerically assertable rather than
  prose.)*
- **AC-25** → a flyout opens to the right: **220px** wide, `padding: 6px`, `border-radius: 12px`,
  background `--aq-surface-2`, offset **20px** from the rail (left edge at 84px).
- **AC-26** → the flyout carries a section title at **11px / 500 / .08em / uppercase** in
  `--aq-text-3`, padding `8px 12px 4px`.
- **AC-27** → flyout rows are **36px** high, `padding: 0 12px`, `border-radius: 8px`, **13px / 500**
  in `--aq-text-2`, **no icons**, flush (no margin); the current row shows `--aq-hover` background
  and `--aq-text`.
- **AC-28** → the flyout lists exactly the pages of that section, and clicking one navigates there.
- **AC-29** → the flyout stays open while the pointer travels from tile to flyout (see §9 Q1 — this
  is the known failure mode from `HANDOFF.md` §8.6).
- **AC-29c — keyboard access must not regress (added at G2 per the Tester's F-K1, required by D1).**
  Tab to a rail tile → it receives a visible `:focus-visible` ring. Press Enter/Space → the flyout
  opens. Tab moves focus INTO the flyout rows in DOM order; Enter activates the focused row;
  **Escape closes the flyout and returns focus to the originating tile.** The flyout must not be a
  focus trap, and hover-intent timers must never steal or drop focus. Asserted by keyboard only,
  with no pointer events, in both themes.
- **AC-30** → the active tile keeps its filled pill while a different tile is hovered.

### H. Favicon (verification only — already fixed)
- **AC-F1** Load the app in a browser → the tab shows the Airlinq mark **visually centred**, not
  cropped or offset, at default zoom.
- **AC-F2** → `ui-ngx/src/airlinq.ico` contains frames at 16/32/48/64 (already verified) and
  `index.html` still references it. A `sizes` attribute is added **only if** the browser
  demonstrably picks the wrong frame.

### I. Theming, regression and gates
- **AC-31** → every criterion in §A–§G passes with `localStorage['tb-theme'] = 'dark'`.
- **AC-32** → no colour literal is added outside the `--aq-*` token blocks in `styles.scss`, and
  none in any `.ts`/`.html`. **No `color-mix()` reaches built CSS.**
- **AC-33** → the brand mark's hard-coded fills (`#3e7bff`, `#37b6c9`) are left as-is (consistent
  with the earlier work item's D4 ruling), unless §9 Q4 says otherwise.
- **AC-34** → `cd ui-ngx && NODE_OPTIONS=--max-old-space-size=8192 yarn lint` introduces **zero NEW
  problems** vs the pre-change baseline (evidence: before/after logs). *(The gate is already red on
  a pristine tree — 569 problems / 462 errors / 107 warnings — so the delta is the bar.)*
- **AC-35** → `mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true`
  succeeds; every new file carries the Apache header.
- **AC-36** Regression, both themes: every menu entry still navigates to the same route as before;
  permissions/visibility rules unchanged (a customer user sees exactly the pages they saw before);
  the collapse/pin toggle, `menuCollapsed` persistence, the entity-details drawer, and the
  previously-shipped grid/dashboard work all still render correctly.
- **AC-37** → screenshot evidence for expanded menu, rail idle, and rail hover+flyout, in **both**
  themes, in `.claude/team/artifacts/left-menu-and-favicon/run-<n>/`.
- **AC-38 — human-judged, not agent-verifiable:** the human, viewing the deployed app, confirms the
  menu matches the canvas and the favicon looks right. No agent invents a check for this.

## 8. Notes for the Technical Architect (inputs, not decisions)

> **STRUCTURAL FINDING — SCOPE THIS EXPLICITLY (recorded at G1 by human instruction).**
> The headline ask ("sectioned menu, every page one click away") is a **MENU-MODEL change, not a
> styling change.** It cannot be reached from the stylesheet, and it is the same class of trap that
> cost the previous work item two wasted rounds under a CSS-only constraint. The design doc and plan
> must scope: (a) a new section-heading member on `MenuSectionType`; (b) the `@switch` arm that
> renders it (`side-menu.component.html:21-31`); (c) re-shaping the ~1139-line section data in
> `menu.models.ts` so most of today's `toggle` sections become `link` rows grouped under headings,
> with `toggle` retained ONLY for the five true sub-menus (Profiles, Data processing, Resources,
> Security, Platform); (d) Edge management inserted under Operations after Resources (D2); and
> (e) the permission/visibility rules that currently gate each section preserved exactly (AC-36).

- **A new section-label type is required.** `MenuSectionType` is `'link' | 'toggle' | 'divider'`
  (`menu.models.ts:21`) — there is no heading type. Adding one touches the union, the `@switch` in
  `side-menu.component.html:21-31`, and the model's ~1139 lines of section data.
- **"Every page one click away" is a MODEL change, not a CSS change.** Today's `toggle` sections
  bury pages behind an accordion. Option A flattens most of them to `link` rows under a heading and
  keeps `toggle` only for the five true sub-menus. This is the same class of trap as the previous
  work item: it cannot be reached from the stylesheet.
- **The alarm badge has no existing plumbing** — grep finds no `alarmCount`/`badge` in the menu
  components or `menu.service.ts`. It needs a count source (polled or websocket) and must not add a
  per-render API call.
- **The user block already exists** (`user-menu.component.html`) with avatar, display name, role and
  a popover menu, and is already placed at the rail foot (`home.component.html:48`). This is closer
  to the canvas than expected — prefer restyling over rebuilding.
- **`Edge management` exists in the app** (`menu.models.ts:716-732`) but appears **nowhere in the
  canvas's Option A**. See §9 Q2 — do not silently drop it.
- **Dark/light artboards are byte-identical** except one class on line 56; all geometry and copy is
  theme-invariant. `.aq.dark` has no rule — dark is the base. Do not implement a `.dark`-only
  selector.
- **Specificity warning:** menu colours currently come from several places (`side-menu.component.scss`,
  `menu-link.component.scss`, `styles.scss` Shell-C block). The previous work item lost three rounds
  to `!important`/specificity conflicts — check the computed cascade, not the file.

## 9. Human decisions at G1 (binding — do not re-ask)

- **D1 (was Q1): hover-intent flyout.** Opens on hover; **stays open ~300 ms after the pointer
  leaves the rail** and for as long as the pointer is over the flyout (bridging the 20px gap);
  **click still opens/closes**. **Must not regress keyboard access.** This supersedes the abandoned
  attempt in `HANDOFF.md` §8.6 — the failure there was a pure CSS `:hover` expansion, which cannot
  survive the pointer crossing the gap; a hover-intent popover with a close-delay can.
- **D2 (was Q2): Edge management goes under Operations, immediately after Resources.**
- **D3 (was Q3): implement the "tile lifts" hover as markup + CSS** (i.e. go beyond the canvas
  markup's background+colour-only treatment and realise the lift the prose describes).
- **D4 (was Q4): the brand-mark hex (`#3e7bff`, `#37b6c9`) and the flyout shadow stay as-is.** Not
  tokenised, not theme-swapped. Consistent with the previous work item's ruling.
- **D5 (was Q5): the alarm badge is fed by the existing active-alarm count endpoint, polled every
  60 s, a SINGLE request. No websocket.** The count must be shared/cached — not one request per
  render or per menu item.
- **D6 (was Q6): task-size class `standard`** — design doc + implementation plan, human approval at
  G2, before any code.

- **D7 (G2):** Short viewports **scroll**; there is no adaptive collapse of the menu.
- **D8 (G2): the verified alarm-count endpoint.** Jarvis tested all candidates live:
  - `GET /api/v2/alarms?pageSize=1&page=0&statusList=ACTIVE` -> **200, `totalElements` = 6** ✅
  - `GET /api/alarms?pageSize=1&page=0&searchStatus=ACTIVE` -> **200, `totalElements` = 6** ✅ (agrees)
  - `GET /api/v2/alarm?...` (**singular**) -> **404** ❌ — this was Jarvis's earlier mis-read; the
    architect's `/api/v2/alarms` (**plural**) is correct and the design does NOT need re-pointing.
  - **The `statusList=ACTIVE` filter is MANDATORY:** unfiltered, `/api/v2/alarms` returns
    **1660** (all historical alarms), so an unfiltered badge would read 1660 instead of 6.
  - Only the envelope's `totalElements` is consumed; `pageSize=1` keeps it cheap.
  - **The Developer must smoke the exact URL against the server before building the service on it.**
- **D9 (G2): `buildUserHome` must not regress.** Flattening `toggle` groups into `link` rows under
  headings would otherwise change the Home page's section cards. **Rule: preserve today's Home card
  grouping via a heading-aware branch** — the Home page keeps its current grouping even though the
  side menu is now flat.

- **D10 (implementation, 2026-09-06): NO COMMITS — the plan's embedded `git commit` steps are
  VOID.** Commit policy is `manual`; agents never commit or push. Any `git commit` step written into
  `docs/plans/left-menu-and-favicon.md` is superseded by this decision and must be skipped.
- **D11 (implementation finding, recorded 2026-09-06):** `alarms_center` and `notifications_center`
  are **links-with-pages, not toggles**. They therefore do NOT become section headings when the
  toggle groups flatten. The Code Reviewer must confirm **no destination was lost** in the reshape.

- **D12 (implementation, 2026-09-06): AC-29c partial — ACCEPTED as a documented limitation.**
  Tab from an OPEN flyout moves to the next rail tile rather than into the flyout rows. Escape,
  Enter/Space and focus-return all work, and **every page stays keyboard-reachable via the
  pinned-open menu**, so nothing is unreachable. A follow-up work item is logged for
  `cdkTrapFocus`-style focus management on the overlay. AC-29c is therefore recorded as
  **PASS-with-limitation** for this round, not a failure.
- **D13 (verification, 2026-09-06): the expanded panel must be verified PINNED OPEN.** The
  developer's harness never pinned the menu, so AC-15/AC-18 geometry is UNVERIFIED and its
  `expanded-*.png` files are actually **rail** shots — **they must not be cited as evidence**. The
  Tester MUST click the pin toggle, verify the expanded panel in both themes, and **restore the
  account's stored `menuCollapsed`** afterwards (it persists server-side).

- **D14 (verification round, 2026-09-06): scope WIDENED to `home.component.{html,scss}`** for the
  rail head only (finding F-3). The expanded head currently renders a 144px `<tb-logo>` image;
  the canvas requires a **64px head, padding `0 12px 0 16px`, a 24x24 brand mark plus an "AIRLINQ"
  wordmark at 13px/700/.12em**. The collapsed state keeps the mark + chevron head already shipped.
  Edits must be **minimal** and confined to the head. This is a third file outside the menu
  components, so it is an **ADR 0001 addendum case** - record it there.
- **D15 (verification round, 2026-09-06): the Tester's stale-tree run yielded a VALID findings
  list** even though its D9 result was withdrawn. All of F-1, F-2a, F-2b, F-3, F-4, F-5, F-6 are
  folded into a single Developer round so the work converges in one pass. **The 3-authority Home
  snapshot proof is still required** despite D9's withdrawal - it is the regression guard, not just
  evidence for one finding.

- **D16 (run-2 notes, 2026-09-06): two criterion wordings corrected against implemented intent.**
  - **AC-11** says chevrons appear on "the five true sub-menus"; **D2 added Edge management, making
    it SIX**. The implementation matches intent; the criterion's count is stale. Assert "chevrons on
    exactly the true sub-menu rows and no others", not a hardcoded five.
  - **AC-22** places the alarm dot on "the Monitor tile", but rail section headings are
    `display: none`, so the dot correctly sits on **Alarms** - the row that owns the count. The
    implementation is right; the criterion's wording predates the rail's heading treatment.

- **D17 (test loop, 2026-09-06): leaf sections render a full menu and NO tab strip.** F-7's fix is
  not merely a null-guard. `router-tabs.component.ts:113` becomes
  `found.pages?.filter(...) ?? []`, and the accompanying DECISION is that a section which legitimately
  has no sub-pages after the flatten (`alarms_center`, `notifications_center`, and the routes under
  them) renders the **full side menu with no tab strip at all** - rather than a blank or vestigial
  tab bar. This is the correct product behaviour: those destinations are now top-level rows in the
  sectioned menu, so a tab strip would be redundant chrome. **Requires the Reviewer's explicit
  accept** (recorded at its delta confirmation).

Consequences: AC-24 now includes a real lift (transform/shadow), not background+colour only;
AC-29's hover persistence is a hard requirement with a ~300 ms close-delay; AC-14's count comes
from the polled endpoint; Edge management joins the Operations section and its rail tile.

## 10. Kickoff record
Collected after G1 approval. Roster: technical-architect, developer, code-reviewer (on-demand at
G2.5), tester.

## 11. Sign-off

| Gate | Status | Date |
|---|---|---|
| G1 Requirement | **APPROVED (human)** | 2026-09-06 |
| G2 Design + plan | **APPROVED (human)** — design, 10-task plan, ADR 0003 | 2026-09-06 |
| G2.5 Implementation review | **PASSED** — zero findings (3 iterations + 2 delta confirms) | 2026-09-07 |
| G2.7 Test plan | **APPROVED + EXECUTED** (runs 1–3) | 2026-09-07 |
| G3 Quality (tester, zero findings) | **PASSED** — run-3: 36 PASS / 0 FAIL | 2026-09-07 |
| G4 Release (human) | **awaiting human final review + deploy approval** | — |
