# Settings Page Unified Design Specification

## Overview

This document defines unified design patterns and display structures for the Settings page tabs:
- **通用 (General)** - Form-based settings
- **供应商 (Providers)** - LLM provider profiles
- **扩展 (Extensions)** - Plugin marketplace
- **环境变量 (Environment Variables)** - Key-value configuration
- **钩子 (Hooks)** - Event hooks management

## Layout Structure

### Page Container

All tabs share the same container structure:

```
┌─────────────────────────────────────────────────────────────┐
│  Settings Header (shared across all tabs)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 设置                                            [↻]   │  │
│  │ 集中管理你的所有配置                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Tab Navigation                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [通用] [供应商] [扩展] [环境变量] [钩子]              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Tab Content Area (varies per tab)                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │        (Content specific to each tab)                 │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Content Area Patterns

#### Pattern A: Form Sections (通用, 钩子)
For configuration with grouped settings.

```
┌─────────────────────────────────────────────────────────────┐
│ Section Title                                               │
├─────────────────────────────────────────────────────────────┤
│ Setting Label                              [Control]        │
│ Setting description                                         │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│ Setting Label                              [Control]        │
│ Setting description                                         │
└─────────────────────────────────────────────────────────────┘
```

#### Pattern B: List with Actions (供应商, 环境变量)
For CRUD-based data management.

```
┌─────────────────────────────────────────────────────────────┐
│ [Search Input...            ] [Secondary Action] [+ Add]    │
├──────────────────────────────────────────��──────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Item Row                          [Actions: Edit Delete]│ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Item Row (Active)                 [Actions: Edit Delete]│ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Pattern C: Sidebar + Grid (扩展)
For browsable catalogs with filtering.

```
┌────────────────┬────────────────────────────────────────────┐
│ Sidebar        │ Content Grid                               │
│ ┌────────────┐ │ ┌──────────────────────────────────────┐   │
│ │ Category 1 │ │ │ [Tab Filters: All | Installed | ...]  │   │
│ │ Category 2 │ │ │ [Search Input...                   ]  │   │
│ │ Category 3 │ │ ├──────────────────────────────────────┤   │
│ │ ...        │ │ │ ┌──────────┐  ┌──────────┐           │   │
│ └────────────┘ │ │ │ Card 1   │  │ Card 2   │           │   │
│                │ │ └──────────┘  └──────────┘           │   │
│                │ │ ┌──────────┐  ┌──────────┐           │   │
│                │ │ │ Card 3   │  │ Card 4   │           │   │
│                │ │ └──────────┘  └──────────┘           │   │
│                │ └──────────────────────────────────────┘   │
└────────────────┴────────────────────────────────────────────┘
```

## Component Specifications

### 1. Section Card (Pattern A)

Used in: 通用, 钩子

```tsx
<section className="bg-card rounded-xl border border-border p-4 shadow-sm">
  <h3 className="text-sm font-medium text-ink mb-4">{sectionTitle}</h3>
  <div className="space-y-4">
    {/* Setting rows */}
  </div>
</section>
```

#### Setting Row Structure

```tsx
<div className="flex items-center justify-between">
  <div>
    <p className="text-sm text-ink">{label}</p>
    <p className="text-xs text-muted-foreground">{description}</p>
  </div>
  {/* Control: Select | Switch | Button */}
</div>
```

### 2. List Item Card (Pattern B)

Used in: 供应商, 环境变量

```tsx
<div className={cn(
  "rounded-xl border p-3 flex items-center justify-between transition-colors duration-200",
  isActive
    ? "border-primary bg-primary/5"
    : "border-border/40 bg-card/40 hover:bg-muted/50 hover:shadow-sm"
)}>
  <div className="flex items-center gap-4 min-w-0">
    {/* Avatar/Icon */}
    <div className="w-10 h-10 shrink-0 rounded-full bg-secondary/80 flex items-center justify-center">
      {/* Initial or Icon */}
    </div>
    {/* Content */}
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-sm truncate text-foreground/90">{name}</h3>
        {isActive && <ActiveBadge />}
      </div>
      <p className="text-xs text-blue-500/80 truncate font-mono mt-0.5">{subtitle}</p>
    </div>
  </div>
  {/* Actions */}
  <div className="flex items-center gap-1 shrink-0">
    {/* Action Buttons */}
  </div>
</div>
```

### 3. Plugin Card (Pattern C)

Used in: 扩展

```tsx
<div className="h-full w-full rounded-xl border border-border bg-card p-4 text-left transition hover:bg-muted/50 hover:shadow-sm">
  <div className="flex h-full flex-col gap-3">
    {/* Header: Title + Status Badges */}
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-ink leading-snug line-clamp-2">{name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge />
          <VersionBadge />
        </div>
      </div>
      {/* Toggle if installed */}
    </div>

    {/* Description */}
    <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>

    {/* Component Badges */}
    <ComponentBadgeRow />

    {/* Footer Actions */}
    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
      {/* Install/Uninstall/Update buttons */}
    </div>
  </div>
</div>
```

### 4. Toolbar Pattern

Unified toolbar for list views:

```tsx
<div className="flex items-center gap-3">
  <SearchInput
    placeholder={searchPlaceholder}
    value={search}
    onChange={setSearch}
    className="flex-1 max-w-md"
  />
  {secondaryAction && (
    <Button variant="outline" onClick={secondaryAction.onClick}>
      {secondaryAction.label}
    </Button>
  )}
  <Button
    size="icon"
    className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-full"
    onClick={onAdd}
  >
    <PlusIcon className="w-5 h-5" />
  </Button>
</div>
```

### 5. Table Pattern (环境变量)

For key-value data:

```tsx
<div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
  {/* Table Header */}
  <div className="grid grid-cols-[1fr_2fr_auto] gap-4 px-4 py-2 border-b border-border bg-muted/30">
    <span className="text-xs font-medium text-muted-foreground uppercase">{t('key')}</span>
    <span className="text-xs font-medium text-muted-foreground uppercase">{t('value')}</span>
    <span className="text-xs font-medium text-muted-foreground uppercase">{t('actions')}</span>
  </div>

  {/* Table Body */}
  <div className="divide-y divide-border">
    {items.map(item => (
      <div className="grid grid-cols-[1fr_2fr_auto] gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors">
        <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary font-mono truncate">
          {item.key}
        </span>
        <span className="text-sm text-ink font-mono truncate">{item.value}</span>
        <div className="flex items-center gap-1">
          <IconButton icon={Pencil1Icon} onClick={() => onEdit(item)} />
          <IconButton icon={MinusCircledIcon} onClick={() => onDisable(item)} variant="warning" />
          <IconButton icon={TrashIcon} onClick={() => onDelete(item)} variant="danger" />
        </div>
      </div>
    ))}
  </div>
</div>
```

## Badge Specifications

### Status Badges

```tsx
// Installed
<span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
  已安装
</span>

// Not Installed
<span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
  未安装
</span>

// Active/Enabled
<span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
  活跃
</span>

// Version
<span className="text-xs px-2 py-0.5 rounded-full bg-card-alt text-muted-foreground">
  v1.2.1
</span>

// Component Count (e.g., for plugins)
<span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-600">
  子代理 1
</span>
```

## Empty States

Unified empty state component:

```tsx
<div className="text-center py-12">
  <Icon className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
  <p className="text-muted-foreground">{message}</p>
  {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
</div>
```

## Action Button Patterns

### Primary Actions

```tsx
// Add Button (Rounded)
<Button size="icon" className="h-10 w-10 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full">
  <PlusIcon className="w-5 h-5" />
</Button>

// Apply/Submit Button
<Button size="sm" className="rounded-lg h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90">
  <PlayIcon className="w-3.5 h-3.5 mr-1" />
  {t('apply')}
</Button>
```

### Secondary/Ghost Actions

```tsx
// Edit Button
<Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-foreground hover:bg-secondary/50">
  <Pencil1Icon className="w-4 h-4" />
</Button>

// Delete Button
<Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:text-red-500 hover:bg-red-500/10">
  <TrashIcon className="w-4 h-4" />
</Button>
```

## Spacing Guidelines

| Element | Spacing |
|---------|---------|
| Section gap | `space-y-6` |
| Item gap within section | `space-y-4` |
| Card internal padding | `p-4` |
| List item gap | `gap-3` |
| Badge gap | `gap-2` |
| Action button gap | `gap-1` |

## Typography

| Element | Classes |
|---------|---------|
| Section Title | `text-sm font-medium text-ink` |
| Item Title | `font-medium text-sm text-foreground/90` |
| Card Title | `text-base font-semibold text-ink` |
| Description | `text-sm text-muted-foreground` |
| Subtle Text | `text-xs text-muted-foreground` |
| Code/Mono | `font-mono text-xs` |

## Recommended Refactoring

### Extract Shared Components

1. **SettingRow** - Reusable setting row with label, description, and control slot
2. **ListItemCard** - Unified list item card for providers, env vars, etc.
3. **ActionToolbar** - Search + actions toolbar
4. **TableView** - Generic table component for key-value data
5. **StatusBadge** - Unified status badge component

### Component Hierarchy

```
src/components/settings/
├── SettingRow.tsx          # Form setting row
├── SettingSection.tsx      # Section wrapper with title
├── ListItemCard.tsx        # List item for CRUD views
├── ActionToolbar.tsx       # Search + action buttons
├── TableView.tsx           # Key-value table
├── StatusBadge.tsx         # Status badges
└── index.ts                # Exports
```

## Tab-Specific Notes

### 通用 (General)
- Uses Pattern A (Form Sections)
- Two sections: 常规 (General), 权限 (Permissions)
- Controls: Select, Switch, Button for directory management

### 供应商 (Providers)
- Uses Pattern B (List with Actions)
- Shows active provider with highlight
- Actions: Apply, Edit, Delete
- Add form in Dialog

### 扩展 (Extensions)
- Uses Pattern C (Sidebar + Grid)
- Sidebar: Category filters with counts
- Content: Tab filters (All/Installed/Not Installed), Search, Card Grid
- Card grid: 2-column responsive

### 环境变量 (Environment Variables)
- Uses Pattern B (List with Actions) + Table
- Add row at top with key select + value input
- Table rows with inline editing capability

### 钩子 (Hooks)
- Uses Pattern A (Form Sections) + Expandable List
- Global toggle at section header
- Expandable hook events with nested hook items
- Each hook item: Command, Toggle, Delete

## Implementation Priority

1. Extract `SettingRow` and `SettingSection` components
2. Unify `ListItemCard` component across views
3. Create `ActionToolbar` component
4. Standardize badge styles with `StatusBadge`
5. Create `TableView` component for env vars
