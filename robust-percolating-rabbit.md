# LinkedPilot Frontend Redesign Plan

## Context

The `.impeccable.md` design spec calls for **"Brass & Obsidian"** — warm dark editorial feel like Bloomberg Terminal + Notion dark. Current UI uses **teal/cyan primary on cold blue-tinted dark** which is explicitly listed as an anti-reference ("cyan-on-dark AI startup"). Multiple pages use hardcoded hex colors instead of design tokens.

**Goal:** Transform from generic dark-mode SaaS into premium "weapon, not a toy" interface matching the design spec.

## Current Problems (from screenshot + code audit)

1. **Wrong palette**: Primary is teal `oklch(0.55 0.14 195)` — spec says warm amber/brass
2. **Cold backgrounds**: Hue 280 (blue-purple tint) — spec says hue ~50 (warm obsidian)
3. **No Fraunces font**: Spec says "Fraunces headings do the heavy lifting" — missing entirely
4. **Gradient buttons banned**: Sidebar "Create campaign" + logo use decorative gradients — spec bans these
5. **Hardcoded colors**: LinkedInAccounts, CampaignDetail use `bg-[#1e1e1e]`, `text-[#94a3b8]`, `bg-purple-600` instead of tokens
6. **Stat cards cut off**: Top stat cards partially hidden, visible at scroll
7. **Low data density**: Big gaps, Bloomberg-like information density missing

## Implementation Phases

### Phase 1: Design Foundation (index.css + tailwind.config.js + index.html)
**Files:** `src/index.css`, `tailwind.config.js`, `index.html`

- Swap color tokens to warm amber/brass palette:
  - `--background`: warm obsidian hue ~50 (not 280)
  - `--primary`: warm amber/brass `oklch(0.65 0.15 65)` range
  - `--accent`: warm gold `oklch(0.7 0.12 80)` range
  - All neutrals tint toward amber, not blue
- Add Fraunces via Google Fonts `<link>` in index.html
- Add `fontFamily.display` to tailwind config for Fraunces
- Remove `--ease-spring` (bounce banned by spec — "expo ease only")
- Keep existing animation utilities, just remove any bounce curves

### Phase 2: Layout Shell (Sidebar + Header + AppShell)
**Files:** `src/components/layout/Sidebar.jsx`, `src/components/layout/Header.jsx`

- **Sidebar**: Remove gradient from logo + "Create campaign" button — use flat primary
- **Sidebar**: Use Fraunces for "linkedpilot" wordmark
- **Header**: Clean breadcrumbs, tighten spacing
- Remove all `bg-gradient-to-*` from layout components
- Replace gradient avatar with flat primary background

### Phase 3: UI Primitives (button + card)
**Files:** `src/components/ui/button.jsx`, `src/components/ui/card.jsx`

- **Button**: Remove `gradient` variant entirely. Default stays flat primary. Reduce hover translate to -1px (more confident, less playful)
- **Card**: Reduce default hover effects. Cards should be quiet — no translate-y on every card

### Phase 4: Dashboard + Components
**Files:** `src/pages/Dashboard.jsx`, `src/components/StatCard.jsx`, `src/components/ActivityChart.jsx`

- **StatCard**: Replace gradient top bar with thin solid accent line. Use Fraunces for numbers. Tighter padding for Bloomberg density
- **ActivityChart**: Update chart colors to warm palette (amber, gold, copper tones). Improve tooltip styling
- **Dashboard**: Apply Fraunces to h1. Tighten vertical spacing. Replace hardcoded stat colors with warm variants

### Phase 5: Campaign Pages
**Files:** `src/pages/Campaigns.jsx`, `src/components/campaigns/CampaignCard.jsx`, `src/pages/CampaignDetail.jsx`

- **CampaignCard**: Warm status dot colors. Remove aggressive hover translate. Tighten StatBox
- **CampaignDetail**: Replace all hardcoded colors (`bg-green-500`, `bg-yellow-500`, `bg-purple-500`, `text-gray-400`) with semantic tokens
- **Campaigns**: Already decent — just normalize tab colors to warm palette

### Phase 6: LinkedInAccounts Page (worst offender)
**File:** `src/pages/LinkedInAccounts.jsx`

- Replace ALL hardcoded: `bg-[#1e1e1e]` → `bg-card`, `text-[#94a3b8]` → `text-muted-foreground`, `bg-purple-600` → `bg-primary`, `border-white/5` → `border-border`, `bg-green-500` badges → semantic tokens
- Progress bars: use primary/success colors from tokens

### Phase 7: Remaining Pages
**Files:** `src/pages/Inbox.jsx`, `src/pages/Settings.jsx`, `src/pages/LeadDatabase.jsx`, `src/pages/LeadExtractor.jsx`, `src/pages/CampaignBuilder.jsx`, `src/pages/InboundAutomations.jsx`

- Same pattern: replace hardcoded hex → semantic tokens
- Apply Fraunces to page h1 headers
- Normalize spacing to match Dashboard rhythm

## Key Design Decisions

| Element | Current | Target |
|---------|---------|--------|
| Primary | Teal oklch(0.55 0.14 195) | Warm amber oklch(0.65 0.15 65) |
| Backgrounds | Cold hue 280 | Warm hue 50 |
| Headings font | Plus Jakarta Sans | Fraunces (display) |
| Body font | Plus Jakarta Sans | Plus Jakarta Sans (keep) |
| Gradients | Everywhere | Banned — flat only |
| Card hover | translateY(-2px) + shadow | Subtle border glow only |
| Motion | Spring + bounce curves | Expo ease only |

## Verification

After each phase:
1. Check browser at localhost:5173 — screenshot key pages
2. Verify warm color tone across sidebar, header, cards, chart
3. Verify no gradient buttons or decorative gradients remain
4. Verify Fraunces renders on headings
5. Check all pages for leftover hardcoded hex colors
