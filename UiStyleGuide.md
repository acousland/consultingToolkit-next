# UI Style Guide — Glassmorphic Theme

This style guide captures the glassmorphic design system used on the Physical → Logical Application Mapping page so you can apply it across the app. It’s designed for Tailwind utility classes and Next.js App Router.

## Principles

- Dark, calm backdrop with soft gradients and masked lighting.
- Glass cards: translucent surfaces, subtle inner/outer borders, tasteful blur.
- Vibrant accents (fuchsia → violet → emerald → cyan) for primary actions and headings.
- Legible typography with high contrast in body text; softer, tinted supporting text.
- Motion used sparingly (pulses, gradient sheens, progress flow) to infer state.
- Accessible defaults: 12–14px minimum UI text size, focus rings, color contrast considered.

## Design Tokens (Tailwind utility equivalents)

- Colors
  - Background base: slate-950 → zinc-900 gradient
  - Glass surface: white/[0.02–0.06]
  - Borders: white/10 (outer), white/5 (inner hairline)
  - Heading gradient: from fuchsia-300 via emerald-300 to cyan-300
  - Emphasis cards: amber-500/10, indigo-500/10, emerald-500/10, rose-600/10
  - Text
    - Primary: slate-100 / slate-200
    - Secondary: slate-300 / slate-400
    - Muted: slate-500 / slate-600
- Radii
  - Cards: rounded-3xl
  - Inputs/Buttons: rounded-xl → rounded-2xl
  - Pills: rounded-full
- Shadows
  - Card: shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.4)]
  - Elevation+: add 0_10px_40px_-2px_rgba(0,0,0,0.35)
- Blur
  - backdrop-blur-xl on primary surfaces
- Spacing
  - Section gutter: px-6 py-10
  - Card padding: p-8 (dense: p-6)
  - Inline chips: px-3 py-1

## Page Background

```jsx
<main className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-900 text-slate-100">
  {/* Lighting mask */}
  <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]">
    <div className="absolute -top-32 -left-32 h-96 w-96 bg-fuchsia-600/10 rounded-full blur-3xl animate-pulse" />
    <div className="absolute top-1/2 -right-40 h-[32rem] w-[32rem] bg-emerald-500/10 rounded-full blur-3xl" />
  </div>
  <div className="mx-auto relative z-10 max-w-screen-2xl px-6 py-10 space-y-10">
    {/* content */}
  </div>
</main>
```

## Header Pattern

```jsx
<header className="space-y-4">
  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 backdrop-blur-sm text-xs uppercase tracking-wider text-fuchsia-300/80">
    <span className="h-2 w-2 rounded-full bg-fuchsia-400 animate-pulse" />
    AI Mapping Workflow
  </div>
  <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-emerald-300 to-cyan-300 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]">
    Page Title
  </h1>
  <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
    Subtitle copy explaining the page briefly.
  </p>
</header>
```

## Cards (Glass Containers)

Primary glass card:

```jsx
<div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.4),0_10px_40px_-2px_rgba(0,0,0,0.35)] p-8 space-y-8">
  {/* content */}
</div>
```

Accent/info cards:

```jsx
<div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">/* info */</div>
<div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5">/* warning */</div>
<div className="rounded-2xl border border-rose-500/30 bg-rose-600/10 p-5">/* error */</div>
<div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">/* success */</div>
```

Inner hairline (optional, creates glass edge):

```jsx
<div className="relative">
  {/* card content */}
  <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/5" />
</div>
```

## Buttons

Primary (gradient):

```jsx
<button className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-emerald-500 px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
  <span className="flex items-center gap-2">🔍 Primary Action</span>
</button>
```

Secondary (glass):

```jsx
<button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition">Secondary</button>
```

Destructive (rose):

```jsx
<button className="rounded-xl bg-rose-600/80 hover:bg-rose-500 px-5 py-2 text-xs font-semibold text-white shadow shadow-rose-900/40 transition">Delete</button>
```

Loading affordance:

```jsx
<span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
```

## Inputs

Text area / input:

```jsx
<textarea className="w-full h-32 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-transparent shadow-inner" />
```

Select:

```jsx
<select className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
```

Checkbox (paired with text):

```jsx
<label className="flex items-center gap-2 text-xs">
  <input type="checkbox" className="h-4 w-4 rounded border-white/20 bg-slate-900 text-fuchsia-400 focus:ring-fuchsia-400/40" />
  <span className="text-slate-200">Label</span>
</label>
```

## Pills & Chips

```jsx
<span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-200">Chip</span>
```

Status pill (warning):

```jsx
<span className="text-[11px] px-2 py-1 rounded bg-amber-400/20 border border-amber-300/20 text-amber-100">Check</span>
```

## Tables

Container card + responsive scroll:

```jsx
<div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.5)]">
  <div className="overflow-x-auto">
    <table className="w-full text-sm table-auto">
      <thead className="bg-white/5">
        <tr className="text-left text-slate-300">
          <th className="p-3 font-semibold text-xs uppercase tracking-wide">Col</th>
          {/* ... */}
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        <tr className="align-top hover:bg-white/3">
          <td className="p-3 text-slate-300">Cell</td>
          {/* ... */}
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

Column width guidance (example used):

- Physical 26%, Logical 26%, Similarity 10%, Rationale 28%, Uncertain 10%
- Debug columns get explicit widths and tinted background (yellow-900/20)

## Progress Bars

Streaming progress:

```jsx
<div className="h-2 rounded-full bg-white/5 overflow-hidden">
  <div className="h-full bg-gradient-to-r from-fuchsia-500 to-emerald-400 transition-all" style={{ width: '42%' }} />
</div>
```

## Layout

- Content container: `max-w-screen-2xl` for wide pages; `max-w-7xl` for default.
- Single-column flow: `grid grid-cols-1 gap-6` for stacked sections on all breakpoints.
- Section spacing: `space-y-8` within cards; `space-y-10` across page sections.

## Alerts & Validation

- Warning:

```jsx
<div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-sm text-amber-100/90">• warning message</div>
```

- Error:

```jsx
<div className="rounded-2xl border border-rose-500/30 bg-rose-600/10 p-5 text-sm text-rose-200">❌ error</div>
```

- Success note:

```jsx
<div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-emerald-200 text-sm">✅ done</div>
```

## Typography

- Headings: bold/black; gradient display for H1 only.
- Body: `text-slate-200/90` (primary), `text-slate-400` (supporting), `text-slate-500` (hints).
- Size ramp: 11–12px pills, 14px table text, 16px body, 18–20px lead, 36–48px display.

## Focus & Accessibility

- Always include visible focus rings: `focus:outline-none focus:ring-2 focus:ring-<accent>/40`.
- Ensure contrast ≥ 4.5:1 for critical text; avoid using color alone to communicate.
- Inputs must have labels; icons/emojis are supportive only.

## Component Recipes (Copy/Paste)

Header + Card Section shell:

```jsx
<header className="space-y-4">/* header */</header>
<section className="space-y-6">
  <h2 className="text-2xl font-semibold tracking-tight">
    <span className="bg-gradient-to-r from-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">1.</span> Section Title
  </h2>
  <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.4)] p-8 space-y-8">
    {/* section content */}
  </div>
</section>
```

Primary action row:

```jsx
<div className="flex flex-wrap gap-3">
  <button className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/30 transition">Action</button>
  <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition">Secondary</button>
</div>
```

Table with debug columns:

```jsx
<table className="w-full text-sm table-auto">
  <thead className="bg-white/5">/* headers */</thead>
  <tbody className="divide-y divide-white/5">
    <tr className="align-top hover:bg-white/3">/* cells */</tr>
  </tbody>
</table>
```

## Applying to Other Pages

- Use the same page shell (background + container + header pattern).
- Wrap logical sections in glass cards with consistent paddings and borders.
- Prefer single-column flows for complex forms; add sub-cards for controls.
- Use chips for summary metrics and statuses.
- Keep primary actions in gradient buttons; include CSV/Excel glass buttons for exports.

## Optional Tailwind Config Hints (non-breaking)

If desired, you can add custom shadows or gradients to `tailwind.config.js` for terser classes. This guide stays within stock utilities plus arbitrary values.

---

This guide is derived from the Physical → Logical Application Mapping page. Reuse these patterns for a cohesive, glassmorphic experience across the toolkit.
