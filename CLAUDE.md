# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design System

This project uses **claudecodeimpact Warm Academic Style **

### Quick Rules
1. **No Hardcoded Colors**: Must use semantic class names (e.g., `bg-primary`, `text-muted-foreground`)
2. **Font Pairing**: Use `font-serif` for Dialog titles, `font-mono` for technical text, and default `font-sans` for body text
3. **Border Radius Style**: Use `rounded-xl` for cards/input fields, `rounded-lg` for buttons/badges, and `rounded-full` for status labels
4. **Primary Color Palette**: Terracotta (buttons/highlights) + warm beige background + charcoal gray text
5. **Component Priority**: Prioritize using shadcn/ui components (Button, Dialog, Switch, etc.)
6. **Compact Sizing**: Icon buttons `h-7 w-7` or `h-6 w-6`, icons `w-3.5 h-3.5` or `w-4 h-4`

### Color Palette
- **Primary**: `bg-primary`, `text-primary`, `bg-primary/10`, `border-primary/10`
- **Background**: `bg-card`, `bg-muted`, `bg-secondary`, `bg-secondary/40`
- **Foreground**: `text-foreground`, `text-ink`, `text-muted-foreground`
- **Border**: `border-border`, `border-border/50`, `border-border/60`
- **Destructive**: `text-destructive`, `bg-destructive/10`, `hover:bg-red-500/10`
- **Success**: `bg-green-500/10`, `text-green-600`

### Common Patterns
- Primary Button: `bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl`
- Icon Button: `h-7 w-7 rounded-lg` + `variant="ghost"` or `size="icon"`
- Card: `bg-card border border-border rounded-lg` or `rounded-xl`
- Dialog Title: `font-serif`
- Input Field: `bg-secondary/40 border border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl px-3.5 py-2 text-sm`
- Status Badge: `text-xs px-2 py-0.5 rounded-full bg-{color}/10 text-{color}`
- Label: `text-xs font-medium text-muted-foreground`
- Delete Button: `text-destructive hover:text-destructive hover:bg-destructive/10`
- Toggle Group: `rounded-lg border border-border/60 bg-card/70 p-0.5`
- Hover Effects: `hover:bg-muted/50` or `hover:bg-secondary/50`

## Project Overview

Claude Code Impact is a Vibe Coding assistant desktop app built with Tauri 2 + React 19 + TypeScript. Primary focus is supporting AI coding tool ecosystems (claude code, codex, etc.) with chat history viewer as the first feature.

## Commands

```bash
# Frontend development (hot reload)
pnpm dev

# Type check + production build
pnpm build

# Run Tauri desktop app (auto-starts pnpm dev)
pnpm tauri dev

# Build distributable
pnpm tauri build
```

## Architecture

**Dual-layer architecture:**
- `src/` - React frontend (Vite, port 1420)
- `src-tauri/` - Rust backend (Tauri 2)

**Frontend-backend communication:**
- Use `invoke()` from `@tauri-apps/api/core` to call Rust commands
- Define Rust commands with `#[tauri::command]` in `src-tauri/src/lib.rs`
- Register commands in `tauri::generate_handler![]`

## Conventions

- CSS: Tailwind CSS preferred
- No dynamic imports or setTimeout unless necessary
- Extract shared components when patterns repeat across multiple components
- Do not output reports arbitrarily unless I request them.

## Work Style

- Act as senior architect: clarify ambiguous needs, think systemically, flag risks
- Ask when requirements are unclear; avoid assumptions

## UI/UX Guidelines

- Default to dense layouts (`density_dense`); reduce padding/margins
- Use meaningful animations (page load, staggered reveal), not generic micro-motions
- Icon-only actions in compact spaces; always include aria labels/tooltips
- For drag-reorder, make the card/blank area draggable (avoid separate drag handles)
