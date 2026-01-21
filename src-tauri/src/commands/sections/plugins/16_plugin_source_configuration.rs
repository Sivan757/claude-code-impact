// ============================================================================

/// Plugin source configuration
#[derive(Debug, Clone)]
struct PluginSource {
    id: &'static str,
    name: &'static str,
    icon: &'static str,
    priority: u32,
    path: &'static str, // Relative to project root
}

/// Available marketplace sources (ordered by priority)
const PLUGIN_SOURCES: &[PluginSource] = &[
    PluginSource {
        id: "anthropic",
        name: "Anthropic Official",
        icon: "🔷",
        priority: 1,
        path: "third-parties/claude-plugins-official",
    },
    PluginSource {
        id: "lovstudio",
        name: "Lovstudio",
        icon: "💜",
        priority: 2,
        path: "marketplace/lovstudio",
    },
    PluginSource {
        id: "lovstudio-plugins",
        name: "Lovstudio Plugins",
        icon: "💜",
        priority: 3,
        path: "../lovstudio-plugins-official",
    },
    PluginSource {
        id: "community",
        name: "Community",
        icon: "🌍",
        priority: 4,
        path: "third-parties/claude-code-templates/docs/components.json",
    },
];

/// Plugin metadata from .claude-plugin/plugin.json
#[derive(Debug, Serialize, Deserialize, Clone)]
struct PluginMetadata {
    name: String,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    author: Option<PluginAuthor>,
    #[serde(default)]
    repository: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PluginAuthor {
    name: String,
    #[serde(default)]
    email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TemplateComponent {
    pub name: String,
    pub path: String,
    pub category: String,
    #[serde(rename = "type")]
    pub component_type: String,
    pub description: Option<String>,
    pub downloads: Option<u32>,
    pub content: Option<String>,
    // Source attribution
    #[serde(default)]
    pub source_id: Option<String>,
    #[serde(default)]
    pub source_name: Option<String>,
    #[serde(default)]
    pub source_icon: Option<String>,
    #[serde(default)]
    pub plugin_name: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TemplatesCatalog {
    pub agents: Vec<TemplateComponent>,
    pub commands: Vec<TemplateComponent>,
    pub mcps: Vec<TemplateComponent>,
    pub hooks: Vec<TemplateComponent>,
    pub settings: Vec<TemplateComponent>,
    pub skills: Vec<TemplateComponent>,
    pub statuslines: Vec<TemplateComponent>,
    #[serde(default)]
    pub sources: Vec<SourceInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SourceInfo {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub count: usize,
}

/// Resolve source path (handles both bundled and development paths)
fn resolve_source_path(
    app_handle: Option<&tauri::AppHandle>,
    relative_path: &str,
) -> Option<PathBuf> {
    // In production: try bundled resources first
    if let Some(handle) = app_handle {
        if let Ok(resource_path) = handle.path().resource_dir() {
            // Tauri maps "../" to "_up_/" in the resource bundle
            let bundled_path = relative_path.replace("../", "_up_/");
            let bundled = resource_path.join("_up_").join(&bundled_path);
            if bundled.exists() {
                return Some(bundled);
            }
        }
    }

    // In development: try from current dir and parent
    let candidates = [
        std::env::current_dir().ok(),
        std::env::current_dir()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf())),
    ];

    for candidate in candidates.into_iter().flatten() {
        let path = candidate.join(relative_path);
        if path.exists() {
            return Some(path);
        }
    }

    None
}

/// Load community catalog from JSON file (claude-code-templates)
fn load_community_catalog(
    app_handle: Option<&tauri::AppHandle>,
    source: &PluginSource,
) -> Vec<TemplateComponent> {
    let Some(path) = resolve_source_path(app_handle, source.path) else {
        return Vec::new();
    };

    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };

    let Ok(raw): Result<serde_json::Value, _> = serde_json::from_str(&content) else {
        return Vec::new();
    };

    let mut components = Vec::new();

    // Load each component type and add source info
    for (key, comp_type) in [
        ("agents", "agent"),
        ("commands", "command"),
        ("mcps", "mcp"),
        ("hooks", "hook"),
        ("settings", "setting"),
        ("skills", "skill"),
    ] {
        if let Some(items) = raw.get(key) {
            if let Ok(mut parsed) = serde_json::from_value::<Vec<TemplateComponent>>(items.clone())
            {
                for comp in &mut parsed {
                    comp.source_id = Some(source.id.to_string());
                    comp.source_name = Some(source.name.to_string());
                    comp.source_icon = Some(source.icon.to_string());
                    if comp.component_type.is_empty() {
                        comp.component_type = comp_type.to_string();
                    }
                }
                components.extend(parsed);
            }
        }
    }

    components
}

/// Parse SKILL.md frontmatter to extract metadata
fn parse_skill_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    if !content.starts_with("---") {
        return (None, None);
    }

    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() < 3 {
        return (None, None);
    }

    let frontmatter = parts[1];
    let mut name = None;
    let mut description = None;

    for line in frontmatter.lines() {
        let line = line.trim();
        if let Some(val) = line.strip_prefix("name:") {
            name = Some(val.trim().to_string());
        } else if let Some(val) = line.strip_prefix("description:") {
            description = Some(val.trim().to_string());
        }
    }

    (name, description)
}

/// Load plugins from a directory structure (claude-plugins-official style)
fn load_plugin_directory(
    app_handle: Option<&tauri::AppHandle>,
    source: &PluginSource,
) -> Vec<TemplateComponent> {
    let Some(base_path) = resolve_source_path(app_handle, source.path) else {
        return Vec::new();
    };

    let mut components = Vec::new();

    // Scan both plugins/ and external_plugins/ directories
    for subdir in ["plugins", "external_plugins"] {
        let dir = base_path.join(subdir);
        if !dir.exists() {
            continue;
        }

        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };

        for entry in entries.filter_map(|e| e.ok()) {
            let plugin_dir = entry.path();
            if !plugin_dir.is_dir() {
                continue;
            }

            // Read plugin metadata
            let plugin_json = plugin_dir.join(".claude-plugin/plugin.json");
            let metadata: Option<PluginMetadata> = fs::read_to_string(&plugin_json)
                .ok()
                .and_then(|c| serde_json::from_str(&c).ok());

            let plugin_name = metadata
                .as_ref()
                .map(|m| m.name.clone())
                .unwrap_or_else(|| {
                    plugin_dir
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string()
                });

            let plugin_desc = metadata.as_ref().and_then(|m| m.description.clone());
            let author = metadata
                .as_ref()
                .and_then(|m| m.author.as_ref().map(|a| a.name.clone()));

            // Scan commands/
            let commands_dir = plugin_dir.join("commands");
            if commands_dir.exists() {
                if let Ok(cmd_entries) = fs::read_dir(&commands_dir) {
                    for cmd_entry in cmd_entries.filter_map(|e| e.ok()) {
                        let cmd_path = cmd_entry.path();
                        if cmd_path.extension().map_or(false, |e| e == "md") {
                            let name = cmd_path
                                .file_stem()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            let content = fs::read_to_string(&cmd_path).ok();

                            components.push(TemplateComponent {
                                name: name.clone(),
                                path: cmd_path.to_string_lossy().to_string(),
                                category: plugin_name.clone(),
                                component_type: "command".to_string(),
                                description: plugin_desc.clone(),
                                downloads: None,
                                content,
                                source_id: Some(source.id.to_string()),
                                source_name: Some(source.name.to_string()),
                                source_icon: Some(source.icon.to_string()),
                                plugin_name: Some(plugin_name.clone()),
                                author: author.clone(),
                            });
                        }
                    }
                }
            }

            // Scan skills/
            let skills_dir = plugin_dir.join("skills");
            if skills_dir.exists() {
                if let Ok(skill_entries) = fs::read_dir(&skills_dir) {
                    for skill_entry in skill_entries.filter_map(|e| e.ok()) {
                        let skill_path = skill_entry.path();
                        if skill_path.is_dir() {
                            let skill_md = skill_path.join("SKILL.md");
                            if skill_md.exists() {
                                let name = skill_path
                                    .file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                                    .to_string();
                                let content = fs::read_to_string(&skill_md).ok();
                                let (parsed_name, parsed_desc) = content
                                    .as_ref()
                                    .map(|c| parse_skill_frontmatter(c))
                                    .unwrap_or((None, None));

                                components.push(TemplateComponent {
                                    name: parsed_name.unwrap_or(name.clone()),
                                    path: skill_md.to_string_lossy().to_string(),
                                    category: plugin_name.clone(),
                                    component_type: "skill".to_string(),
                                    description: parsed_desc.or_else(|| plugin_desc.clone()),
                                    downloads: None,
                                    content,
                                    source_id: Some(source.id.to_string()),
                                    source_name: Some(source.name.to_string()),
                                    source_icon: Some(source.icon.to_string()),
                                    plugin_name: Some(plugin_name.clone()),
                                    author: author.clone(),
                                });
                            }
                        }
                    }
                }
            }

            // Scan agents/
            let agents_dir = plugin_dir.join("agents");
            if agents_dir.exists() {
                if let Ok(agent_entries) = fs::read_dir(&agents_dir) {
                    for agent_entry in agent_entries.filter_map(|e| e.ok()) {
                        let agent_path = agent_entry.path();
                        if agent_path.extension().map_or(false, |e| e == "md") {
                            let name = agent_path
                                .file_stem()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string();
                            let content = fs::read_to_string(&agent_path).ok();

                            components.push(TemplateComponent {
                                name: name.clone(),
                                path: agent_path.to_string_lossy().to_string(),
                                category: plugin_name.clone(),
                                component_type: "agent".to_string(),
                                description: plugin_desc.clone(),
                                downloads: None,
                                content,
                                source_id: Some(source.id.to_string()),
                                source_name: Some(source.name.to_string()),
                                source_icon: Some(source.icon.to_string()),
                                plugin_name: Some(plugin_name.clone()),
                                author: author.clone(),
                            });
                        }
                    }
                }
            }

            // Check for .mcp.json
            let mcp_json = plugin_dir.join(".mcp.json");
            if mcp_json.exists() {
                let content = fs::read_to_string(&mcp_json).ok();
                components.push(TemplateComponent {
                    name: plugin_name.clone(),
                    path: mcp_json.to_string_lossy().to_string(),
                    category: plugin_name.clone(),
                    component_type: "mcp".to_string(),
                    description: plugin_desc.clone(),
                    downloads: None,
                    content,
                    source_id: Some(source.id.to_string()),
                    source_name: Some(source.name.to_string()),
                    source_icon: Some(source.icon.to_string()),
                    plugin_name: Some(plugin_name.clone()),
                    author: author.clone(),
                });
            }
        }
    }

    components
}

/// Load a single plugin (lovstudio-plugins-official style)
fn load_single_plugin(
    app_handle: Option<&tauri::AppHandle>,
    source: &PluginSource,
) -> Vec<TemplateComponent> {
    let Some(base_path) = resolve_source_path(app_handle, source.path) else {
        return Vec::new();
    };

    let mut components = Vec::new();

    // Read plugin metadata
    let plugin_json = base_path.join(".claude-plugin/plugin.json");
    let metadata: Option<PluginMetadata> = fs::read_to_string(&plugin_json)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok());

    let plugin_name = metadata
        .as_ref()
        .map(|m| m.name.clone())
        .unwrap_or_else(|| source.id.to_string());

    let plugin_desc = metadata.as_ref().and_then(|m| m.description.clone());
    let author = metadata
        .as_ref()
        .and_then(|m| m.author.as_ref().map(|a| a.name.clone()));

    // Scan skills/
    let skills_dir = base_path.join("skills");
    if skills_dir.exists() {
        if let Ok(skill_entries) = fs::read_dir(&skills_dir) {
            for skill_entry in skill_entries.filter_map(|e| e.ok()) {
                let skill_path = skill_entry.path();
                if skill_path.is_dir() {
                    let skill_md = skill_path.join("SKILL.md");
                    if skill_md.exists() {
                        let name = skill_path
                            .file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        let content = fs::read_to_string(&skill_md).ok();
                        let (parsed_name, parsed_desc) = content
                            .as_ref()
                            .map(|c| parse_skill_frontmatter(c))
                            .unwrap_or((None, None));

                        components.push(TemplateComponent {
                            name: parsed_name
                                .unwrap_or_else(|| format!("{}:{}", plugin_name, name)),
                            path: skill_md.to_string_lossy().to_string(),
                            category: plugin_name.clone(),
                            component_type: "skill".to_string(),
                            description: parsed_desc.or_else(|| plugin_desc.clone()),
                            downloads: None,
                            content,
                            source_id: Some(source.id.to_string()),
                            source_name: Some(source.name.to_string()),
                            source_icon: Some(source.icon.to_string()),
                            plugin_name: Some(plugin_name.clone()),
                            author: author.clone(),
                        });
                    }
                }
            }
        }
    }

    // Scan commands/
    let commands_dir = base_path.join("commands");
    if commands_dir.exists() {
        if let Ok(cmd_entries) = fs::read_dir(&commands_dir) {
            for cmd_entry in cmd_entries.filter_map(|e| e.ok()) {
                let cmd_path = cmd_entry.path();
                if cmd_path.extension().map_or(false, |e| e == "md") {
                    let name = cmd_path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let content = fs::read_to_string(&cmd_path).ok();

                    components.push(TemplateComponent {
                        name: name.clone(),
                        path: cmd_path.to_string_lossy().to_string(),
                        category: plugin_name.clone(),
                        component_type: "command".to_string(),
                        description: plugin_desc.clone(),
                        downloads: None,
                        content,
                        source_id: Some(source.id.to_string()),
                        source_name: Some(source.name.to_string()),
                        source_icon: Some(source.icon.to_string()),
                        plugin_name: Some(plugin_name.clone()),
                        author: author.clone(),
                    });
                }
            }
        }
    }

    // Scan hooks/ (read hooks.json if exists)
    let hooks_json = base_path.join("hooks/hooks.json");
    if hooks_json.exists() {
        let content = fs::read_to_string(&hooks_json).ok();
        components.push(TemplateComponent {
            name: format!("{}-hooks", plugin_name),
            path: hooks_json.to_string_lossy().to_string(),
            category: plugin_name.clone(),
            component_type: "hook".to_string(),
            description: Some("Automation hooks configuration".to_string()),
            downloads: None,
            content,
            source_id: Some(source.id.to_string()),
            source_name: Some(source.name.to_string()),
            source_icon: Some(source.icon.to_string()),
            plugin_name: Some(plugin_name.clone()),
            author: author.clone(),
        });
    }

    // Scan statuslines/ (.sh files)
    let statuslines_dir = base_path.join("statuslines");
    if statuslines_dir.exists() {
        if let Ok(entries) = fs::read_dir(&statuslines_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().map_or(false, |e| e == "sh") {
                    let name = path
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let content = fs::read_to_string(&path).ok();

                    // Parse description from script header comment
                    let description = content.as_ref().and_then(|c| {
                        c.lines()
                            .find(|l| l.starts_with("# Description:"))
                            .map(|l| l.trim_start_matches("# Description:").trim().to_string())
                    });

                    components.push(TemplateComponent {
                        name: name.clone(),
                        path: path.to_string_lossy().to_string(),
                        category: plugin_name.clone(),
                        component_type: "statusline".to_string(),
                        description,
                        downloads: None,
                        content,
                        source_id: Some(source.id.to_string()),
                        source_name: Some(source.name.to_string()),
                        source_icon: Some(source.icon.to_string()),
                        plugin_name: Some(plugin_name.clone()),
                        author: author.clone(),
                    });
                }
            }
        }
    }

    components
}

/// Load personal/installed statuslines from ~/.lovstudio/claudecodeimpact/statusline/
fn load_personal_statuslines() -> Vec<TemplateComponent> {
    let statusline_dir = get_lovstudio_dir().join("statusline");
    let mut components = Vec::new();

    if !statusline_dir.exists() {
        return components;
    }

    if let Ok(entries) = fs::read_dir(&statusline_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "sh") {
                let name = path.file_stem().unwrap_or_default().to_string_lossy();

                // Skip backup files (starting with _)
                if name.starts_with('_') {
                    continue;
                }

                let name = name.to_string();
                let content = fs::read_to_string(&path).ok();

                // Parse description from script header comment
                let description = content.as_ref().and_then(|c| {
                    c.lines()
                        .find(|l| l.starts_with("# Description:"))
                        .map(|l| l.trim_start_matches("# Description:").trim().to_string())
                });

                components.push(TemplateComponent {
                    name: name.clone(),
                    path: path.to_string_lossy().to_string(),
                    category: "personal".to_string(),
                    component_type: "statusline".to_string(),
                    description,
                    downloads: None,
                    content,
                    source_id: Some("personal".to_string()),
                    source_name: Some("Installed".to_string()),
                    source_icon: Some("📦".to_string()),
                    plugin_name: None,
                    author: None,
                });
            }
        }
    }

    components
}

#[tauri::command]
fn get_templates_catalog(app_handle: tauri::AppHandle) -> Result<TemplatesCatalog, String> {
    let mut all_components: Vec<TemplateComponent> = Vec::new();
    let mut source_counts: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();

    // Load from each source
    for source in PLUGIN_SOURCES {
        let components = if source.path.ends_with(".json") {
            // Community catalog (JSON file)
            load_community_catalog(Some(&app_handle), source)
        } else if source.id == "lovstudio" {
            // Single plugin directory
            load_single_plugin(Some(&app_handle), source)
        } else {
            // Multi-plugin directory
            load_plugin_directory(Some(&app_handle), source)
        };

        source_counts.insert(source.id.to_string(), components.len());
        all_components.extend(components);
    }

    // Separate by type
    let mut agents = Vec::new();
    let mut commands = Vec::new();
    let mut mcps = Vec::new();
    let mut hooks = Vec::new();
    let mut settings = Vec::new();
    let mut skills = Vec::new();
    let mut statuslines = Vec::new();

    for comp in all_components {
        match comp.component_type.as_str() {
            "agent" => agents.push(comp),
            "command" => commands.push(comp),
            "mcp" => mcps.push(comp),
            "hook" => hooks.push(comp),
            "setting" => settings.push(comp),
            "skill" => skills.push(comp),
            "statusline" => statuslines.push(comp),
            _ => {} // Ignore unknown types
        }
    }

    // Add personal/installed statuslines
    let personal_statuslines = load_personal_statuslines();
    let personal_count = personal_statuslines.len();
    statuslines.extend(personal_statuslines);

    // Build source info
    let mut sources: Vec<SourceInfo> = PLUGIN_SOURCES
        .iter()
        .map(|s| SourceInfo {
            id: s.id.to_string(),
            name: s.name.to_string(),
            icon: s.icon.to_string(),
            count: *source_counts.get(s.id).unwrap_or(&0),
        })
        .collect();

    // Add personal source if there are installed statuslines
    if personal_count > 0 {
        sources.insert(
            0,
            SourceInfo {
                id: "personal".to_string(),
                name: "Installed".to_string(),
                icon: "📦".to_string(),
                count: personal_count,
            },
        );
    }

    Ok(TemplatesCatalog {
        agents,
        commands,
        mcps,
        hooks,
        settings,
        skills,
        statuslines,
        sources,
    })
}

#[tauri::command]
fn install_command_template(name: String, content: String) -> Result<String, String> {
    let commands_dir = get_claude_dir().join("commands");
    fs::create_dir_all(&commands_dir).map_err(|e| e.to_string())?;

    let file_path = commands_dir.join(format!("{}.md", name));
    fs::write(&file_path, content).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

/// Install a skill template to ~/.claude/skills/{name}/SKILL.md
#[tauri::command]
fn install_skill_template(
    name: String,
    content: String,
    source_id: Option<String>,
    source_name: Option<String>,
    author: Option<String>,
    downloads: Option<i64>,
    template_path: Option<String>,
) -> Result<String, String> {
    if name.is_empty() {
        return Err("Skill name cannot be empty".to_string());
    }
    if name.contains('/') || name.contains('\\') || name.contains('\0') {
        return Err("Skill name contains invalid characters".to_string());
    }

    // Create directory structure: ~/.claude/skills/{name}/
    let skill_dir = get_claude_dir().join("skills").join(&name);
    fs::create_dir_all(&skill_dir)
        .map_err(|e| format!("Failed to create skill directory: {}", e))?;

    // Write SKILL.md file
    let skill_file = skill_dir.join("SKILL.md");
    fs::write(&skill_file, &content).map_err(|e| format!("Failed to write SKILL.md: {}", e))?;

    // Save marketplace metadata if provided
    if source_id.is_some() || source_name.is_some() || author.is_some() {
        let meta = MarketplaceMeta {
            source_id,
            source_name,
            author,
            downloads,
            template_path,
        };
        let meta_path = skill_dir.join(".meta.json");
        if let Ok(meta_json) = serde_json::to_string_pretty(&meta) {
            let _ = fs::write(&meta_path, meta_json);
        }
    }

    Ok(skill_file.to_string_lossy().to_string())
}

/// Uninstall a skill by removing its directory
#[tauri::command]
fn uninstall_skill(name: String) -> Result<String, String> {
    if name.is_empty() {
        return Err("Skill name cannot be empty".to_string());
    }

    let skill_dir = get_claude_dir().join("skills").join(&name);
    if !skill_dir.exists() {
        return Err(format!("Skill '{}' not found", name));
    }

    fs::remove_dir_all(&skill_dir).map_err(|e| format!("Failed to remove skill: {}", e))?;
    Ok(format!("Uninstalled skill: {}", name))
}

/// Check if a skill is already installed
#[tauri::command]
fn check_skill_installed(name: String) -> bool {
    let skill_file = get_claude_dir().join("skills").join(&name).join("SKILL.md");
    skill_file.exists()
}

#[tauri::command]
fn install_mcp_template(name: String, config: String) -> Result<String, String> {
    // MCP servers are stored in ~/.claude.json (not ~/.claude/settings.json)
    let claude_json_path = get_claude_json_path();

    // Parse the MCP config
    let mcp_config: serde_json::Value = serde_json::from_str(&config).map_err(|e| e.to_string())?;

    // Helper to check if a value looks like an actual MCP server config
    // (has type, url, or command field)
    fn is_server_config(v: &serde_json::Value) -> bool {
        v.get("type").is_some() || v.get("url").is_some() || v.get("command").is_some()
    }

    // Recursively extract the actual server config, unwrapping any nesting
    fn extract_server_config(v: serde_json::Value) -> serde_json::Value {
        // If it's already a valid config, return it
        if is_server_config(&v) {
            return v;
        }

        // Try to unwrap {"mcpServers": {...}}
        if let Some(mcp_servers) = v.get("mcpServers").and_then(|x| x.as_object()) {
            if let Some(inner) = mcp_servers.values().next() {
                return extract_server_config(inner.clone());
            }
        }

        // Try to unwrap {"someName": {config}}
        if let Some(obj) = v.as_object() {
            if obj.len() == 1 {
                if let Some(inner) = obj.values().next() {
                    if is_server_config(inner) || inner.is_object() {
                        return extract_server_config(inner.clone());
                    }
                }
            }
        }

        v
    }

    let server_config = extract_server_config(mcp_config);

    // Read existing ~/.claude.json or create new
    let mut claude_json: serde_json::Value = if claude_json_path.exists() {
        let content = fs::read_to_string(&claude_json_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure mcpServers exists
    if !claude_json.get("mcpServers").is_some() {
        claude_json["mcpServers"] = serde_json::json!({});
    }

    // Ensure the server config has a 'type' field (required by Claude Code)
    // Infer type from the config if not present:
    // - If has "url" field -> "http" (or "sse" if url contains /sse)
    // - If has "command" field -> "stdio"
    let mut server_config = server_config;
    if server_config.get("type").is_none() {
        if let Some(url) = server_config.get("url").and_then(|v| v.as_str()) {
            // Check if it's an SSE endpoint
            let transport_type = if url.ends_with("/sse") || url.contains("/sse/") {
                "sse"
            } else {
                "http"
            };
            server_config["type"] = serde_json::json!(transport_type);
        } else if server_config.get("command").is_some() {
            server_config["type"] = serde_json::json!("stdio");
        }
    }

    // Add the MCP server with the extracted config
    claude_json["mcpServers"][&name] = server_config;

    // Write back
    let output = serde_json::to_string_pretty(&claude_json).map_err(|e| e.to_string())?;
    fs::write(&claude_json_path, output).map_err(|e| e.to_string())?;

    Ok(format!("Installed MCP: {}", name))
}

#[tauri::command]
fn uninstall_mcp_template(name: String) -> Result<String, String> {
    let claude_json_path = get_claude_json_path();

    if !claude_json_path.exists() {
        return Err("No MCP configuration found".to_string());
    }

    let content = fs::read_to_string(&claude_json_path).map_err(|e| e.to_string())?;
    let mut claude_json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(mcp_servers) = claude_json
        .get_mut("mcpServers")
        .and_then(|v| v.as_object_mut())
    {
        if mcp_servers.remove(&name).is_none() {
            return Err(format!("MCP '{}' not found", name));
        }
    } else {
        return Err("No mcpServers found".to_string());
    }

    let output = serde_json::to_string_pretty(&claude_json).map_err(|e| e.to_string())?;
    fs::write(&claude_json_path, output).map_err(|e| e.to_string())?;

    Ok(format!("Uninstalled MCP: {}", name))
}

#[tauri::command]
fn check_mcp_installed(name: String) -> bool {
    let claude_json_path = get_claude_json_path();

    if !claude_json_path.exists() {
        return false;
    }

    let Ok(content) = fs::read_to_string(&claude_json_path) else {
        return false;
    };

    let Ok(claude_json) = serde_json::from_str::<serde_json::Value>(&content) else {
        return false;
    };

    claude_json
        .get("mcpServers")
        .and_then(|v| v.as_object())
        .map(|servers| servers.contains_key(&name))
        .unwrap_or(false)
}

#[tauri::command]
fn install_hook_template(name: String, config: String) -> Result<String, String> {
    let settings_path = get_claude_dir().join("settings.json");

    // Parse the hook config (should be an object with event type as key)
    let hook_config: serde_json::Value =
        serde_json::from_str(&config).map_err(|e| e.to_string())?;

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Ensure hooks exists
    if !settings.get("hooks").is_some() {
        settings["hooks"] = serde_json::json!({});
    }

    // Merge hook config - hooks are typically structured as {"PreToolUse": [...], "PostToolUse": [...]}
    if let Some(hook_obj) = hook_config.as_object() {
        for (event_type, handlers) in hook_obj {
            if let Some(handlers_arr) = handlers.as_array() {
                // Get existing handlers for this event type
                let existing = settings["hooks"]
                    .get(event_type)
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();

                // Merge (append new handlers)
                let mut merged: Vec<serde_json::Value> = existing;
                merged.extend(handlers_arr.clone());
                settings["hooks"][event_type] = serde_json::Value::Array(merged);
            }
        }
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok(format!("Installed hook: {}", name))
}

#[tauri::command]
fn install_setting_template(config: String) -> Result<String, String> {
    let settings_path = get_claude_dir().join("settings.json");

    // Parse the setting config
    let new_settings: serde_json::Value =
        serde_json::from_str(&config).map_err(|e| e.to_string())?;

    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    // Deep merge the new settings
    if let (Some(existing_obj), Some(new_obj)) =
        (settings.as_object_mut(), new_settings.as_object())
    {
        for (key, value) in new_obj {
            existing_obj.insert(key.clone(), value.clone());
        }
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;

    Ok("Settings updated".to_string())
}

#[tauri::command]
fn update_settings_statusline(statusline: serde_json::Value) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    settings["statusLine"] = statusline;

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn remove_settings_statusline() -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");
    if !settings_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let mut settings: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("statusLine");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn write_statusline_script(content: String) -> Result<String, String> {
    let script_path = get_claude_dir().join("statusline.sh");
    fs::write(&script_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(script_path.to_string_lossy().to_string())
}

/// Install statusline template to ~/.lovstudio/claudecodeimpact/statusline/{name}.sh
#[tauri::command]
fn install_statusline_template(name: String, content: String) -> Result<String, String> {
    let statusline_dir = get_lovstudio_dir().join("statusline");
    fs::create_dir_all(&statusline_dir).map_err(|e| e.to_string())?;

    let script_path = statusline_dir.join(format!("{}.sh", name));
    fs::write(&script_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(script_path.to_string_lossy().to_string())
}

/// Apply statusline: copy from ~/.lovstudio/claudecodeimpact/statusline/{name}.sh to ~/.claude/statusline.sh
/// If ~/.claude/statusline.sh exists and is not already installed, backup to ~/.lovstudio/claudecodeimpact/statusline/_previous.sh
#[tauri::command]
fn apply_statusline(name: String) -> Result<String, String> {
    let source_path = get_lovstudio_dir()
        .join("statusline")
        .join(format!("{}.sh", name));
    if !source_path.exists() {
        return Err(format!("Statusline template not found: {}", name));
    }

    let target_path = get_claude_dir().join("statusline.sh");
    let backup_dir = get_lovstudio_dir().join("statusline");
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    // Backup existing statusline.sh if it exists and differs from source
    if target_path.exists() {
        let existing_content = fs::read_to_string(&target_path).unwrap_or_default();
        let new_content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;

        if existing_content != new_content {
            let backup_path = backup_dir.join("_previous.sh");
            fs::copy(&target_path, &backup_path).map_err(|e| e.to_string())?;
        }
    }

    let content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
    fs::write(&target_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&target_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&target_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(target_path.to_string_lossy().to_string())
}

/// Restore previous statusline from backup
#[tauri::command]
fn restore_previous_statusline() -> Result<String, String> {
    let backup_path = get_lovstudio_dir().join("statusline").join("_previous.sh");
    if !backup_path.exists() {
        return Err("No previous statusline to restore".to_string());
    }

    let content = fs::read_to_string(&backup_path).map_err(|e| e.to_string())?;
    let target_path = get_claude_dir().join("statusline.sh");
    fs::write(&target_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&target_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&target_path, perms).map_err(|e| e.to_string())?;
    }

    // Remove backup after restore
    fs::remove_file(&backup_path).ok();

    Ok(target_path.to_string_lossy().to_string())
}

/// Check if previous statusline backup exists
#[tauri::command]
fn has_previous_statusline() -> bool {
    get_lovstudio_dir()
        .join("statusline")
        .join("_previous.sh")
        .exists()
}

/// Context passed to Claude Code Impact statusbar script
#[derive(Debug, Serialize, Deserialize)]
pub struct StatusBarContext {
    pub app_name: String,
    pub version: String,
    pub projects_count: usize,
    pub features_count: usize,
    pub today_lines_added: usize,
    pub today_lines_deleted: usize,
    pub timestamp: String,
    pub home_dir: String,
}

/// Execute Claude Code Impact's GUI statusbar script and return output
#[tauri::command]
fn execute_statusbar_script(
    script_path: String,
    context: StatusBarContext,
) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    // Expand ~ to home dir
    let home = dirs::home_dir().unwrap_or_default();
    let expanded_path = if script_path.starts_with("~") {
        script_path.replacen("~", &home.to_string_lossy(), 1)
    } else {
        script_path
    };

    let path = std::path::Path::new(&expanded_path);
    if !path.exists() {
        return Err(format!("Script not found: {}", expanded_path));
    }

    // Serialize context to JSON
    let context_json = serde_json::to_string(&context).map_err(|e| e.to_string())?;

    // Determine how to execute the script
    #[cfg(unix)]
    let mut child = Command::new(&expanded_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn script: {}", e))?;

    #[cfg(windows)]
    let mut child = Command::new("powershell")
        .args(["-ExecutionPolicy", "Bypass", "-File", &expanded_path])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn script: {}", e))?;

    // Write context JSON to stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(context_json.as_bytes()).ok();
    }

    // Wait for output with timeout
    let output = child
        .wait_with_output()
        .map_err(|e| format!("Script execution failed: {}", e))?;

    // Get first line of stdout
    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout.lines().next().unwrap_or("").to_string();

    Ok(first_line)
}

/// Get Claude Code Impact statusbar settings from workspace.json
#[tauri::command]
fn get_statusbar_settings() -> Result<Option<serde_json::Value>, String> {
    let settings_path = get_lovstudio_dir().join("statusbar-settings.json");
    if !settings_path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let settings: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(Some(settings))
}

/// Save Claude Code Impact statusbar settings
#[tauri::command]
fn save_statusbar_settings(settings: serde_json::Value) -> Result<(), String> {
    let settings_path = get_lovstudio_dir().join("statusbar-settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, content).map_err(|e| e.to_string())
}

/// Write Claude Code Impact statusbar script to ~/.lovstudio/claudecodeimpact/statusbar/
#[tauri::command]
fn write_claudecodeimpact_statusbar_script(
    name: String,
    content: String,
) -> Result<String, String> {
    let statusbar_dir = get_lovstudio_dir().join("statusbar");
    fs::create_dir_all(&statusbar_dir).map_err(|e| e.to_string())?;

    let script_path = statusbar_dir.join(format!("{}.sh", name));
    fs::write(&script_path, &content).map_err(|e| e.to_string())?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&script_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&script_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(script_path.to_string_lossy().to_string())
}

/// Remove installed statusline template
#[tauri::command]
fn remove_statusline_template(name: String) -> Result<(), String> {
    let script_path = get_lovstudio_dir()
        .join("statusline")
        .join(format!("{}.sh", name));
    if script_path.exists() {
        fs::remove_file(&script_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

