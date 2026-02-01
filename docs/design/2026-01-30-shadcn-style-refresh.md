# Shadcn/ui Style Refresh

## Context
The current UI theme uses a warm, academic palette and serif accents. We want a simpler, neutral shadcn/ui look for clearer hierarchy and cleaner contrast.

## Goals
- Adopt shadcn/ui neutral palette (light + dark).
- Simplify typography (sans-first).
- Reduce radius to shadcn default.
- Keep layout and components intact to minimize behavioral risk.

## Non-goals
- Component-by-component redesign.
- New font loading or external assets.
- Visual changes to feature information architecture.

## Design Changes
- Theme tokens updated to shadcn/ui neutral defaults.
- `--color-canvas` / `--color-ink` now map to core background/foreground for consistency.
- Radius reduced to `0.5rem` to match shadcn defaults.
- Typography simplified to sans for both serif/sans tokens to reduce stylistic contrast.

## Risks & Mitigations
- **Dark mode contrast**: Use shadcn dark tokens to maintain contrast.
- **Legacy custom colors**: Retain custom tokens and map them to core tokens to avoid regressions.

## Follow-ups
- If needed, tune component-level padding or shadows to align with shadcn “New York” style.
- Consider loading a dedicated font (e.g., Geist) if desired.
