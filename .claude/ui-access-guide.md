# How to Access the Configuration Management UI

## Quick Access

The new configuration management system can be accessed in **two ways**:

### Option 1: Direct Route (Standalone Page)
Navigate to: **`/settings/config`**

This page shows the ConfigEditor in a full-page view.

### Option 2: Settings Tab (Integrated)
1. Go to **Settings** (Cmd+, or from navigation)
2. The configuration management is available as the **"Advanced"** tab

However, **the tab button is not visible yet** because the tab navigation UI needs to be added to the FeaturesLayout or navigation component.

---

## What You Can Do

The ConfigEditor provides:

### 1. **Write Configuration**
- Select target scope (User, User Local, Project, Project Local)
- Enter key (e.g., `model`)
- Enter value in JSON format (e.g., `"opus"`)
- Click "Write Configuration"

### 2. **View Merged Configuration**
Three tabs to explore:

**Effective Config Tab**:
- Shows the final merged configuration
- All scopes combined with correct precedence

**Provenance Tab**:
- Click any key to see where it comes from
- Shows source file path and scope
- Color-coded scope badges

**CLAUDE.md Tab**:
- Combined content from all CLAUDE.md files
- Shows sources with scope indicators

### 3. **Real-Time Updates**
- File watcher automatically detects external changes
- UI refreshes when config files are modified
- No need to manually reload

---

## To Make It More Visible

To add a visible tab button in the Settings page, you'll need to:

1. **Find where tab buttons are rendered** (likely in `FeaturesLayout` or a settings header component)
2. **Add a tab button** for "Advanced" or "Config Manager"
3. **Link it to the "advanced" tab value**

Example pattern (wherever tabs are rendered):
```tsx
<TabsList>
  <TabsTrigger value="general">General</TabsTrigger>
  <TabsTrigger value="provider">LLM</TabsTrigger>
  <TabsTrigger value="plugins">Plugins</TabsTrigger>
  <TabsTrigger value="env">Environment</TabsTrigger>
  <TabsTrigger value="hooks">Hooks</TabsTrigger>
  <TabsTrigger value="advanced">Advanced Config</TabsTrigger> {/* NEW */}
</TabsList>
```

---

## Current Status

✅ **Backend**: Fully implemented and tested
✅ **Frontend Components**: ConfigEditor, MergeViewer, ScopeIndicator
✅ **Hooks**: useConfig, useConfigWatcher
✅ **Integration**: Added to GlobalSettingsView as "advanced" tab
⏳ **Navigation UI**: Tab button needs to be added to make it visible

---

## Alternative: Standalone Access

For now, you can access it via the direct route:
- Create a navigation link to `/settings/config`
- Or use the URL directly

The page is fully functional even without the tab button!
