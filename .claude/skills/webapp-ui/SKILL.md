---
name: webapp-ui
description: Build dense, professional SaaS interfaces in the CAOS style — shadcn primitives, zinc neutrals, tight spacing, one accent color used sparingly. Use when creating or modifying React pages, layouts, or components in this project.
---

# CAOS webapp UI rules

Build SaaS screens that look like Linear, Attio, or Vercel Dashboard. No marketing-site aesthetics. No glass. No gradients.

## Primitives
Use shadcn primitives exclusively:
- Layout & nav: shadcn `sidebar-07` (already installed as Layout)
- Controls: `Button`, `Input`, `Select`, `Textarea`, `Label`, `Checkbox`, `Switch` from `src/components/ui/`
- Surfaces: `Card`, `Badge`, `Separator`, `Tabs`, `Dialog`, `Sheet`, `Popover`, `Tooltip`
- Data: `Table` for any multi-row list with filters/sort
- Icons: `lucide-react` at `h-3.5 w-3.5` for inline, `h-4 w-4` for buttons, `h-5 w-5` for nav

Add missing components via the shadcn MCP (`mcp__shadcn__add_component`) or `npx shadcn@latest add <name>` — do not hand-roll a primitive that shadcn provides.

Blocks catalogue: https://ui.shadcn.com/blocks. When you need a multi-component assembly (sidebar, login form, data table) pull the block instead of composing from scratch.

## Color system

**Zinc neutrals carry 95% of every screen.** The accent appears only at 5 sanctioned moments.

```
--background:         zinc-950  (#0A0A0A)  — page
--card:               zinc-900  (#18181B)  — raised surface
--border:             zinc-800  (#27272A)  — all dividers
--foreground:         zinc-50   (#FAFAFA)  — primary text
--muted-foreground:   zinc-400  (#A1A1AA)  — labels, metadata
--primary:            zinc-50              — CTA button bg (dark text on white)
--accent:             hsl(217 91% 60%)     — ONE blue, used sparingly
```

**Accent uses (the only ones allowed):**
1. Active sidebar nav item (subtle bg + left border)
2. Primary CTA buttons when explicitly destructive-or-confirmation
3. Focus ring on inputs/buttons
4. Status pill background for "GREEN / SOLID-CASE / PURSUE-HARD" type positives
5. Link hover underline

**Forbidden:**
- Gradients of any kind
- Box-shadows on cards (use border only)
- Glassmorphism / `backdrop-blur` (except sticky headers at 95% opacity)
- Background color on ai-generated content (use a left border or subtle chip instead)
- Color-coding by category (green/blue/purple swimlanes) — prefer neutral with small colored dots

## Density

Match https://linear.app and https://attio.com density, not https://stripe.com.

- Body text: **13px** leading **1.45** (Inter Variable)
- Card padding: **`p-3` or `p-4`** — never p-5/p-6
- Vertical gap between sections: **`gap-5`** max (not gap-8)
- Sidebar width: **220px** (not 240px)
- Top bar height: **48px**
- Table row height: **36px**
- Button heights: sm `h-8`, default `h-9`, lg `h-10` — avoid h-11+
- Nav item vertical padding: **`py-1.5`** — not py-3

## Typography

- `font-sans` = Inter Variable (body + UI)
- `font-mono` = JetBrains Mono Variable — **only** for IDs, timestamps, currencies, matter numbers
- Display headings: plain `font-semibold`, tracking `-0.01em`, no serif, no custom display font
- Uppercase micro-labels: `text-[11px] uppercase tracking-wider text-muted-foreground`
- Body: `text-[13px] text-foreground`
- Metadata: `text-[12px] text-muted-foreground`

## Layout patterns

**Detail page (inspector pattern):**
```
┌─ sticky sidebar 220px ─┬─ content flex-1 ─┐
│ lead summary           │ tabs or stacked │
│ status chips           │ content per tab │
│ SLA + actions          │                 │
│ timeline (scrollable)  │                 │
└────────────────────────┴─────────────────┘
```
Never let the left rail scroll independently of the page unless timeline is explicitly paginated.

**List page (table pattern):**
```
┌─ filters row (h-10) ─────────────┐
├─ table header (h-9, border-b) ───┤
├─ rows (h-9, hover:bg-zinc-900/30)┤
└──────────────────────────────────┘
```

**Dashboard (Today):**
Cards in a 12-col grid. Hero card (next call) spans 7 cols. Side rail (new leads queue) spans 5 cols. Stats strip full-width at bottom. No card > h-64 above the fold.

## Motion

CSS only. No framer-motion for layout. Transitions should be `duration-150 ease-out`. Page enter: `fade + translate-y-1` over 180ms — no more. Stagger animations forbidden outside of initial mount.

## Checklist before submitting a component

- [ ] Every color I used is from the CSS variables above (no raw hex except via variable)
- [ ] No `backdrop-blur` unless it's a sticky header
- [ ] Card padding is `p-3` or `p-4`
- [ ] Icons sized correctly for their context (h-3.5 inline / h-4 button / h-5 nav)
- [ ] Mono font appears only on IDs/timestamps/currency
- [ ] I reached for a shadcn primitive before rolling my own
- [ ] Build passes: `npm run build`

## Shadcn MCP cheatsheet

- `mcp__shadcn__list_blocks` — browse blocks catalogue
- `mcp__shadcn__get_block` → returns source code for a block; copy into `src/components/`
- `mcp__shadcn__add_component` → adds a component via the CLI (only for primitives in `src/components/ui/`)
- `mcp__shadcn__search` — cross-registry search

When in doubt about a block or component, call the MCP first.
