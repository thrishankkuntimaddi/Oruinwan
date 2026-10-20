# Page kit: how every screen is laid out

Import from `components/ui/page.js` (it re-exports `components/company-dash/dashUi.jsx`).
Keep the theme as it is: Monolith Gloss tokens and `gl-*` / `cd-*` classes only. **Never write a
colour literal** (`#6366f1`, `rgba(…)`, Tailwind `bg-blue-500`, `text-gray-600`…) in a screen; use
`var(--accent)`, `var(--text-primary|secondary|muted)`, `var(--bg-base|surface|hover|active)`,
`var(--border-subtle|default)`, `var(--state-success|warning|danger)`, `var(--gl-accent-soft|line)`.

## Structure (top to bottom)

```
<DashPage head={<PageHead eyebrow=… title=… lead=… icon=… actions=…/>}>
  <Toolbar>  search + filters (only when there is a list to filter)
  <KpiGrid>  3–4 key numbers (only when they help a decision)
  <Section title lead action>  the content: cards in <Grid>, rows in <Panel flush>, tables in <DataTable>
</DashPage>
```

- **Eyebrow** = where you are (workspace name or area, e.g. "Agents & tools"). **Title** = the page
  noun ("Workflows"). **Lead** = one sentence: what this page is for, in plain words.
- **Primary action** (one): top-right in `PageHead actions`, `<Btn variant="primary">`. Secondary
  actions are ghost buttons beside it. Never repeat the same primary button elsewhere on the page,
  except inside an empty state.
- **Empty state**: `<EmptyState icon title text action>` inside the section where content would be,
  not centred in the whole viewport. Title says what's missing ("No workflows yet"), text says why
  it's useful, action is the primary action. Where it helps, show 2–3 starter suggestions (cards)
  that do the setup for the user.
- **Loading / error**: `<LoadingState>` / `<ErrorState onRetry>` in the same spot as the content.
- **Lists**: rows in `<Panel flush>`; the whole row is the click target; row actions on the right,
  revealed on hover on desktop and always visible on touch.
- **Dialogs**: `<Dialog>` / `<Confirm>` from the kit, never `window.confirm`.
- **Icons**: lucide-react, 14–18 px, `var(--accent)` for marks, `currentColor` elsewhere. No emoji as
  UI icons (fine inside user content).
- **Copy**: sentence case, plain words, no "Coming soon" unless it truly is; say what happens.

## Sizes

Must work at 390 px (phone), 834/1024 px (tablets) and 1280–1440 px (desktop), in light and dark.
The kit handles padding and grid collapse; avoid fixed widths and absolute positioning.

## Surfaces: monolith base, liquid-glass layers

- **Base (monolith)**: page backgrounds, side panels, lists, cards and tables stay solid
  (`--bg-base` / `--bg-surface`, `gl-card`, `cd-panel`), near-square (`--gl-radius-sm`, 3px).
- **Floating layers (liquid glass)**: anything that floats over content — popovers, menus,
  dialogs, toasts, the search/command palette, docks — uses the glass material: `gl-liquid`
  (add `gl-liquid--strong` when it holds a lot of text), or the ready-made `gl-dialog` + `gl-scrim`,
  `gl-x-menu`, `gl-toast`, `cd-dialog`, `cd-menu`. Radius `--gl-radius-md` (7px) for popovers and
  menus, `--gl-radius-lg` (10px) for dialogs and sheets. Never put `backdrop-filter` on a long
  scrolling list. Glass tokens: `--lg-tint(-strong)`, `--lg-sheen`, `--lg-border`, `--lg-edge`,
  `--lg-shadow(-sm)`, `--lg-scrim`, `--lg-solid` (fallback without blur).
- **App chrome** (top bars, icon rail, split-view and panel headers): `gl-glass-bar` or
  `--lg-chrome` + `--lg-sheen` + `--lg-edge` (glass look, no blur).
- **Gloss**: the one primary action per view is `gl-btn--primary` (gold + specular top light).
- **Motion**: `--gl-dur-1|2|3` (150/190/220ms) with `--gl-ease`; hover lift only on cards and the
  primary button, a small press-in on buttons. `prefers-reduced-motion` and Settings → Reduce
  motion turn it off.
- **Light mode**: `--accent` is a deeper gold that reads as text (AA); for gold *fills* use
  `--gl-accent-grad` with `--gl-on-accent` text. Shadows in light are warm and soft (`--gl-drop`,
  `--lg-shadow-sm`), never `rgba(0,0,0,…)`.
