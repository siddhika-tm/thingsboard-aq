# Requirement (backlog) — Focus management for the rail flyout overlay

- **Work item slug:** `menu-flyout-focus-trap`
- **Status:** LOGGED, not started. Raised at implementation of `left-menu-and-favicon` by human
  decision **D12**. Deliberately NOT fixed in that round.
- **Mode:** dev
- **Severity:** Low (accessibility polish; no page is unreachable)
- **Date raised:** 2026-09-06

## Problem

The collapsed-rail hover-intent flyout opens correctly by hover, click, Enter and Space, closes on
Escape, and returns focus to the originating rail tile. **But Tab from an OPEN flyout moves to the
next rail tile rather than into the flyout's rows.**

The flyout is a CDK overlay rendered outside the rail's DOM order, so the natural tab sequence does
not descend into it.

## Why it was accepted for now (D12)

- Escape / Enter / Space and focus-return all behave correctly.
- **Every page remains keyboard-reachable** via the pinned-open (expanded) menu, which lists every
  destination as a normal focusable row.
- So this is a keyboard *ergonomics* gap, not an accessibility blocker.

## Suggested direction (design properly at that work item's G1/G2)

- Apply `cdkTrapFocus` (Angular CDK `A11yModule`) to the flyout overlay, with `autoCapture`
  disabled so opening by hover does not steal focus from the page.
- On Enter/Space open, move focus to the first flyout row; Tab/Shift-Tab cycle within the flyout;
  Escape closes and restores focus to the tile (already works).
- Ensure the hover-intent timers never fight the focus trap — a flyout opened by hover must not trap
  focus until the user deliberately enters it by keyboard.
- Add `role="menu"` / `role="menuitem"` (or `listbox`/`option`) semantics if not already present, and
  verify with a screen reader.

## Draft acceptance criteria (confirm at G1)

- With the rail collapsed, Tab to a rail tile and press Enter → focus moves to the **first flyout row**.
- Tab / Shift-Tab cycle **within** the flyout rows and do not escape to the next rail tile.
- Escape closes the flyout and returns focus to the originating tile (regression check — works today).
- Opening the flyout by **hover** does not move focus.
- No regression to the pinned-open menu's keyboard order.
