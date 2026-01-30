# Structure Refactor (2026-01-29)

## Goals
- Reduce duplicated navigation mappings and make routes a single source of truth.
- Remove legacy navigation state that no longer matches router-based flow.
- Make shared dialogs reusable and keep layout files focused on orchestration.

## Changes
- Added `src/navigation/featureRoutes.ts` for feature-to-path mapping and path-to-feature detection.
- Extracted `AppSettingsDialog` and `ProfileDialog` into `src/components/dialogs`.
- Removed legacy `src/App.tsx`, view barrel exports, and unused navigation atoms/hooks.
- Added `/settings/version` page using `ClaudeCodeVersionSection`.
- Redirected `/settings/context` to `/context` as the canonical route.

## Decisions
- Canonical feature routes now live in `featureRoutes.ts` and are reused by `Home`, `Features`, and `RootLayout`.
- Legacy Jotai view navigation was removed to avoid drifting from router behavior.

## Risks / Follow-ups
- Audit remaining pages for any hardcoded feature paths and migrate to `featureToPath`.
- Decide whether `basic-version` should appear in `FEATURES` or be kept as a direct link-only page.
