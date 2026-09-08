# 0004 — Theme-scoped chrome rules (`.tb-default:not(.tb-dark)`) and a surface-relative chrome-ink token layer

- **Status:** proposed (awaiting human approval at G2)
- **Date:** 2026-09-07
- **Deciders:** human (product owner), technical-architect
- **Context work item:** `airlinq-blue-light-recolour`
- **Supersedes / narrows:** nothing. Extends the colour-is-token-only rule of ADR 0001.

## Context

Two facts about this fork's theming collide in the Airlinq Blue recolour.

**Fact 1 — `.tb-default` is not a light-theme selector.** `index.html` sets
`<body class="tb-default">` statically and `theme.service.ts` only adds and removes `tb-dark` on
top. So a rule scoped `.tb-default { … }` **also matches in the dark theme**. This is already
documented in `styles.scss`:1806-1813 and in team memory, and it has cost three rounds of
"the rule is present, correct and `!important` and still wrong".

**Fact 2 — the light theme has no chrome rules at all.** Every rail and toolbar rule lives in the
block at `styles.scss`:1620-1800, whose own header comment reads "DARK-ONLY additions — chrome the
light theme already handles well". In the light theme the rail is white and the toolbar transparent,
so the ink tokens `--aq-text` / `--aq-text-2` / `--aq-text-3` are correct by default and no rule is
needed.

The Airlinq Blue palette makes the light rail navy `#0a1435` and the light toolbar navy `#1c2545`.
Measured, today's light ink on the rail `#0a1435` is **1.43:1**, **2.68:1** and **3.97:1**, and on
the toolbar `#1c2545` **1.19:1**, **2.22:1** and **3.30:1** — all below the 4.5:1 the work item's
AC-8 requires. (An earlier draft of this ADR quoted 1.01 / 2.04 / 3.97, which was measured against a
darker navy than the palette shipped; corrected in findings-loop round 1.) So a pure token-value change produces dark ink on
navy: unreadable. Light-scoped chrome **rules** are unavoidable, and they must not reach dark, whose
output is frozen byte-for-byte by the same requirement.

Two sub-problems follow.

**(a) How to scope a light-only rule block.** The obvious `.tb-default { … }` does not work (Fact 1).
The historical workaround in this file is a paired block — put the rule in `.tb-default` and add a
mirroring `.tb-dark` rule of equal-or-greater specificity to restore the dark value. That doubles
the rule count and requires every mirror to reproduce, by hand, a value the dark block already
produces — and it means adding lines inside the frozen 1620-1800 range.

**(b) What the ink tokens mean.** `--aq-text*` are *page*-relative: in light they assume a light
sheet, in dark a dark sheet. Chrome ink is relative to *its own* surface, which is now **navy in
light and near-black in dark** — the light and dark chrome surfaces are on the *same* side of the
luminance midpoint, which is the opposite of the usual relationship. Reusing `--aq-text*` for chrome
would force one of the two themes to be wrong.

## Decision

**1. `.tb-default:not(.tb-dark)` is the sanctioned scope for a light-only rule block.**

A single new block, placed after the dark-only block closes (`styles.scss`:1800) and before the
shared anatomy block (:1814). `:not(.tb-dark)` is false whenever `tb-dark` is on `<body>`, so **not
one declaration in the block can reach the dark theme** — the guarantee is *structural*, from
selector matching, not from a value coincidence. It also contributes one class of specificity, which
helps the new rules out-rank shallower upstream rules without `!important`.

This is chosen over the paired-block workaround because dark-theme safety becomes a property of the
selector rather than a property of every value in the block, and because it adds nothing to the
frozen 1620-1800 range.

**2. A surface-relative chrome-ink token layer, defined in both theme blocks.**

Five new tokens — `--aq-chrome-ink`, `--aq-chrome-ink-2`, `--aq-chrome-ink-3`,
`--aq-chrome-ink-disabled`, `--aq-chrome-divider` — carrying ink for the rail and toolbar
specifically. Per the existing both-blocks rule they are defined in the light **and** dark blocks;
each **dark** value is set to the literal that the consuming rule already resolves to in dark today
(e.g. `--aq-chrome-ink`'s dark value is `#e9edf3`, which *is* dark `--aq-text`), so substituting the
token changes nothing in dark. Every such choice is documented token-by-token in the design doc's
§1.2 table, including which token's resolved value was copied and why the substitution is a no-op.

**3. Where a global rule cannot beat a component rule, change the component's token reference
instead of escalating specificity.**

Two of the planned rules (rail nav-label ink, rail icon ink) tie on specificity with
`side-menu.component.scss`:111 and :133 once Angular compiles `:host ::ng-deep`, and lose on source
order because component styles are injected after `styles.scss`. Rather than add `!important`
(forbidden) or nest one level deeper in an arms race against a file we also own, the **component
file's token reference** is changed (`var(--aq-text-2)` → `var(--aq-chrome-ink-2)`). The conflict is
removed rather than won, and there stays exactly one source of truth for rail ink.

**4. A gradient used as a background gets its own single-consumer token, and declares
`background-color` alongside `background-image`.**

`--aq-nav-active-grad` has exactly one consumer, so a gradient cannot leak to the five other
surfaces that share `--aq-accent-container`. Its dark value is `none`, making the declaration a
structural no-op in dark. The consuming rule declares `background-color: transparent` **and**
`background-image: var(…)`, because a gradient is a `background-image` and does not override
`background-color` — without the pair, the old colour survives underneath and the element's computed
`background-color` still reports the old value.

Colour remains **token-only**: no new hex or rgba outside the `--aq-*` token definition blocks. The
one exception this ADR permits is the bounded legacy sweep, which re-points existing literals *to*
tokens and never introduces a new literal.

## Consequences

**Positive**

- Dark-theme safety for light-only rules becomes checkable by reading the selector, instead of
  auditing every value in the block. That is a genuinely cheaper invariant.
- The fourth cascade conflict in this codebase is resolved structurally rather than with
  `!important`, and the pattern is now written down. The fifth, sixth and seventh arrived inside
  this same work item — see the addendum below.
- Chrome ink stops overloading `--aq-text*` with a contradiction, which makes both token families
  easier to reason about.
- The single-consumer gradient token makes "the gradient must not leak" a `grep`-checkable property
  rather than a review judgement.

**Negative / accepted costs**

- `:not()` adds specificity. A `.tb-default:not(.tb-dark) X` rule is one class heavier than
  `.tb-default X`, which is usually helpful but will occasionally out-rank a rule someone expected to
  win. The specificity of every new rule and of the rule it must beat is tabulated in the design doc
  so this is visible rather than discovered.
- The token count grows by 14 pairs. Some (the four `--aq-login-head*`) exist only because a nearer
  token's dark value differed — they are correctness-driven, not design-driven, and they should be
  candidates for consolidation the next time the login is revisited.
- Editing `side-menu.component.scss` puts a fourth area of the fork under local modification for
  colour reasons. The edit is two token references and will rebase trivially, but it does mean rail
  colour is no longer *only* in `styles.scss`.
- Reading `.tb-default:not(.tb-dark)` requires knowing Fact 1. The block carries a header comment
  stating it, because the selector is otherwise puzzling.

**Neutral**

- This does not license `.html` or `.ts` edits. The work item that produced this ADR makes none;
  ADR 0001's allowance is untouched and unused here.
- The theme-aware chart palette is explicitly *not* decided by this ADR. The design doc proves that
  `chartColorScheme`'s `.light` values are read at module load and persisted into saved widget
  configs, and that `.light` is used as the default regardless of the active theme — so editing it
  changes what a dark-theme user sees on newly-created widgets. That is a separate architectural
  decision and belongs to the follow-up requirement.

## Addendum — cascade conflicts five, six and seven (findings-loop round 1)

Three further conflicts surfaced during the code review of this same work item. They do not change
the decision; they bound its reach.

**Fifth — L2 vs N5/N6, inside this stylesheet.** The bounded legacy anchor sweep (`L2`) matches a
breadcrumb parent anchor and is emitted *later* in the light block, so at equal specificity it won
and painted the parent `--aq-link` `#2067ff` — 3.18:1 on the `#1c2545` toolbar, an AA failure.
Resolved by adding one class (`.tb-primary-toolbar`) to the breadcrumb forms, putting them at
`(0,4,1)` against L2's `(0,3,1)`. So chrome ink owns the navy toolbar while L2 still owns anchors on
the white sheet. This is the same move as the ADR's main decision — win on specificity, not on
`!important` — applied to a same-file conflict rather than a cross-file one.

**Sixth and seventh — component `:host` rules are a second class of competitor.** This is the
important limitation, and it is not obvious from the decision above:

> `.tb-default:not(.tb-dark)` does **not** automatically outrank a component-scoped rule.

Angular compiles `:host` to an attribute selector, which counts as a *class* for specificity. So a
component rule nested a few levels deep easily reaches `(0,5,1)` and beats any reasonable global
form, **and** component styles are injected after `styles.scss`, so it also wins every
equal-specificity tie. Two rules in this work item were dead for exactly that reason:

| Competitor | Compiled specificity | Global form that lost |
|---|---|---|
| `user-menu.component.scss` `:182` (rail authority line) | ~`(0,5,1)` | `.tb-default:not(.tb-dark) .tb-site-sidenav .tb-user-authority` `(0,3,0)` |
| `breadcrumb.component.scss` `:42`/`:63` (`opacity: .75`) | `(0,2,1)` | n/a — `opacity` was not contested at all |

The breadcrumb case adds a second failure mode worth recording separately: the competitor set
`opacity`, not `color`. A global `color` rule can win the cascade outright and still not produce the
intended pixel, because `opacity` composites the winning colour against the background afterwards.
`getComputedStyle().color` returns the *declared* value and agrees with the stylesheet, so this
class of defect is invisible to computed-style assertions. Verifying it needs the composited value
(or a screenshot pixel). Measured here: the designed three-tier breadcrumb ramp was painting
7.22 / 7.22 / 11.73 / 11.73:1 — the ramp was absent, not merely compressed.

**Consequence for this ADR's guidance.** Before adding a light-only rule in `styles.scss`, grep the
owning component's `.scss` as well as `styles.scss`. Where a component rule already owns the
property, the preferred fix stays what the side-menu precedent established: change the token
*reference* inside the component (a provable dark no-op, because each `--aq-chrome-ink*` dark value
is a byte-copy of the `--aq-text*` dark value it replaces) rather than escalating specificity or
adding `!important` in the global sheet. That precedent is now applied in a second component
(`user-menu.component.scss`), so it is a pattern rather than a one-off.

One refinement the side-menu case did not surface: a component rule may serve *two* backgrounds.
`user-menu.component.scss` `:73` is shared by the navy `.tb-primary-toolbar` and the
light-sheet `.tb-dashboard-action-panel`, so substituting the token in place would have fixed one
variant (1.25:1) and broken the other. The scoped override is therefore attached to
`.tb-primary-toolbar` alone. Check which surfaces a shared component rule actually renders on before
re-pointing its token.

**Also corrected.** Six of the eight original N5/N6 selectors targeted classes the breadcrumb never
emits (`.tb-inactive`, `.tb-active`, `.state-divider`, `.state-entry` — the `.state-*` pair belongs
to the dashboard-state controllers, a different component), as did `.tb-side-menu-divider` and
`.tb-user-name`. Grep the template for the real class list before writing a selector; a rule that
matches nothing is indistinguishable from a rule that works until the pixel is measured.
