# D5 — the `autoScale` floor: chosen value and why (AC-50)

Scope note: this file records ONLY the D5(a) floor decision. The D1/D3/D4 design lives in
`docs/design/left-menu-defect-fixes.md` (owned by the Technical Architect); this is a
separate file deliberately, to avoid a concurrent-write conflict.

## The defect mechanism

`ValueCardWidgetComponent` does not shrink tile text with `font-size`. It shrinks it with
`transform: scale()`:

- `value-card-widget.component.ts:51` — `const squareLayoutSize = 160;`
- `onResize()` computes `scale = Math.min(panelWidth, panelHeight) / squareLayoutSize`
- and applies it via `renderer.setStyle(content, 'transform', \`scale(${scale})\`)`
- `settings.autoScale` defaults **true**

Two consequences follow, and both are why earlier passes missed this:

1. **A CSS `min-font-size` cannot rescue the text.** The transform multiplies whatever size
   is declared, so an 11px label inside `scale(0.55)` paints ~6px.
2. **`getComputedStyle` reports the DECLARED value, not the painted one.** It returns
   `11px` and therefore *agrees* with the stylesheet. This defect class is invisible to
   computed-style assertions; it must be verified against the **cumulative transform
   chain**.

## The chosen value: 0.70

`autoScaleMin = 0.70`, applied with `Math.max(...)` to both the square and the horizontal
branch.

**Why 0.70 and not lower.** Layer (b) of the D5 fix stores a **16px** label. For a 16px
declared label to paint at an 11px legibility floor:

```
required scale = 11 / 16 = 0.6875
```

0.70 is the nearest round value **above** that minimum, so it clears the floor with a
small margin rather than sitting exactly on it.

**Why the stored-size layer is load-bearing, not complementary.** At the previously stored
11px, the same floor calculation gives `11 / 11 = 1.0`. A scale of 1.0 requires
`min(panelW, panelHeight) >= 160px`, so *every* panel narrower than 160px would clip.
Raising the stored sizes is therefore the only way the post-scale product clears the floor
at realistic panel sizes; the code floor alone cannot do it.

## The cost, stated explicitly

A floor means the content box stops shrinking. `onResize()` applies the floor in **both**
of its branches, and the two branches have **different geometry**, so there are **two**
clip-onset thresholds. Earlier revisions of this file documented only the square one; the
horizontal threshold was added in findings-loop round 1 (F4).

### Square branch (`ValueCardLayout.square`, `.vertical`) — 112px

Below

```
min(panelWidth, panelHeight) = squareLayoutSize * autoScaleMin = 160 * 0.70 = 112px
```

the 160px content box no longer fits its panel and **overflows instead of shrinking**.

That 112px figure is **derived, not assumed**: it is `squareLayoutSize * floor`, and
`squareLayoutSize = 160` is read from the source.

### Horizontal branch (`ValueCardLayout.horizontal`) — 56px panel height / 224px panel width

The horizontal branch does not scale off `squareLayoutSize`. It computes

```
aspect       = min(panelHeight / panelWidth, 0.25)
targetHeight = panelWidth * aspect          // == min(panelHeight, 0.25 * panelWidth)
scale        = max(targetHeight / horizontalLayoutHeight, autoScaleMin)   // 80, 0.70
```

so the painted content **height** is floored at `horizontalLayoutHeight * autoScaleMin =
80 * 0.70 = 56px` while the panel can be shorter than that. Because `aspect` is capped at
0.25, `targetHeight` is whichever of the two terms is smaller, and the onset therefore has
two equivalent forms:

- **`panelHeight < 56px`** — the panel-height term binds, or
- **`panelWidth < 224px`** — the 0.25 aspect cap binds (`56 / 0.25 = 224`)

Measured vertical overflow (content height 56px minus panel height):

| panel W×H | unfloored scale | floored scale | painted content height | vertical overflow |
|-----------|-----------------|---------------|------------------------|-------------------|
| 400×80    | 1.0000          | 1.0000        | 80px                   | 0px               |
| 320×56    | 0.7000          | 0.7000        | 56px                   | 0px (exact onset) |
| 300×50    | 0.6250          | 0.7000        | 56px                   | **6px**           |
| 240×40    | 0.5000          | 0.7000        | 56px                   | **16px**          |
| 200×30    | 0.3750          | 0.7000        | 56px                   | **26px**          |

**There is no horizontal *width* defect.** `width = targetWidth / scale` is applied to the
content element as an explicit inline width, and it remains an **exact inverse** of the
`scale()` transform under the floor, so the painted content width still equals
`panelWidth` at any scale. Only the height overflows.

### Why the floor stays in both branches

Removing the floor from the horizontal branch would leave horizontal value cards with
exactly the AC-50 illegibility defect this floor exists to fix — `scale` falling without
limit as the panel shrinks. AC-50 asks that **no** value card clip or overflow at the
narrowest sheet width, which is a requirement about every layout, not only the square one.
Both thresholds are therefore the deliberate trade — text too small to read is not a usable
rendering either — and the reasoning the human accepted for the square branch is the same
reasoning that applies to the horizontal one.

**Note for the Tester:** AC-51's "two other value-card widgets must be unaffected" check
must include a **horizontal-layout** value card, not two square ones — the horizontal
branch is a separate code path with its own threshold and a desktop-only square-layout
sweep is structurally blind to it.

The clip-onset bound for other candidate floors, for comparison:

| floor  | clips below | 16px label paints |
|--------|-------------|-------------------|
| 0.6500 | 104px       | 10.40px           |
| 0.6875 | 110px       | 11.00px (exact)   |
| **0.70** | **112px** | **11.20px**       |
| 0.7500 | 120px       | 12.00px           |
| 0.8000 | 128px       | 12.80px           |

## Blast radius

The human accepted that this changes shared behaviour for **every** `autoScale` value card.
The enumeration is bounded to a single component:

- **Affected:** `tb-value-card-widget` (`ValueCardWidgetComponent`) only — the widget type
  `system.cards.value_card`, which is what all four Container Ops KPI tiles use.
- **NOT affected:** `aggregated-value-card-widget`, `label-value-card-widget`,
  `label-card-widget` and `progress-bar-widget` each carry their **own independent** scale
  computation in their own file (verified by grepping for the `setStyle(..., 'transform',
  scale)` call), so they do not read this code path and are untouched.

## Verification

Verified in the **production bundle**, not the dev server. The dev server was serving a
stale lazily-loaded chunk for this widget and reported unfloored values; the shipping
artifact is authoritative:

```
ui-ngx/target/generated-resources/public/chunk-OYMCO2I5.js
  iN = 160          # squareLayoutSize
  rJ = .7           # autoScaleMin
  ne = Math.min(E,O); R = Math.max(ne/iN, rJ)   # square branch, floored
  Math.max(Le/aJ, rJ)                            # horizontal branch, floored
  -> this.renderer.setStyle(this.valueCardContent, 'transform', `scale(${R})`)
```

Both branches carry the floor. Build exited 0.
