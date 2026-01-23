// ============================================================================

// Plugin repository scan models
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScannedMarketplace {
    pub id: String,
    pub name: String,
    pub install_location: Option<String>,
    pub source: Option<String>,
    pub plugin_count: usize,
    pub last_updated: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginComponent {
    pub name: String,
    pub description: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PluginComponents {
    pub agents: Vec<PluginComponent>,
    pub commands: Vec<PluginComponent>,
    pub skills: Vec<PluginComponent>,
    pub hooks: Vec<PluginComponent>,
    pub mcps: Vec<PluginComponent>,
    pub lsps: Vec<PluginComponent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScannedPlugin {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub repository: Option<String>,
    pub marketplace: String,
    pub is_installed: bool,
    pub is_enabled: bool,
    pub local_path: Option<String>,
    pub components: PluginComponents,
    pub components_source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PluginScanResult {
    pub marketplaces: Vec<ScannedMarketplace>,
    pub plugins: Vec<ScannedPlugin>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone)]
struct MarketplaceRecord {
    id: String,
    install_location: Option<String>,
    source: Option<String>,
    last_updated: Option<String>,
}

#[derive(Debug, Clone)]
struct InstalledPluginRecord {
    path: Option<String>,
    version: Option<String>,
}

#[derive(Debug, Clone)]
struct MarketplacePluginEntry {
    name: String,
    description: Option<String>,
    path: Option<String>,
    remote_source: bool,
    version: Option<String>,
    author: Option<String>,
    repository: Option<String>,
    lsp_servers: Vec<PluginComponent>,
}

#[derive(Debug, Default, Clone)]
struct PluginManifestMetadata {
    name: Option<String>,
    description: Option<String>,
    version: Option<String>,
    author: Option<String>,
    repository: Option<String>,
}

fn read_json_value(path: &Path) -> Option<Value> {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

fn get_string_field(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(val) = value.get(*key).and_then(|v| v.as_str()) {
            if !val.is_empty() {
                return Some(val.to_string());
            }
        }
    }
    None
}

fn looks_like_remote_source(value: &str) -> bool {
    let lower = value.to_lowercase();
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("git://")
        || lower.starts_with("ssh://")
        || lower.starts_with("git+")
        || lower.starts_with("git@")
        || lower.starts_with("gh://")
        || lower.starts_with("github.com/")
}

fn is_remote_source_type(value: &str) -> bool {
    matches!(
        value.to_lowercase().as_str(),
        "url" | "git" | "github" | "http" | "https" | "ssh" | "remote"
    )
}

fn is_remote_source_value(value: &Value) -> bool {
    match value {
        Value::String(source) => looks_like_remote_source(source) || is_remote_source_type(source),
        Value::Object(obj) => {
            if let Some(ty) = obj.get("type").and_then(|v| v.as_str()) {
                let lower = ty.to_lowercase();
                if lower.contains("url")
                    || lower.contains("http")
                    || lower.contains("git")
                    || lower.contains("github")
                    || lower.contains("remote")
                {
                    return true;
                }
            }
            if let Some(source) = obj.get("source").and_then(|v| v.as_str()) {
                if looks_like_remote_source(source) || is_remote_source_type(source) {
                    return true;
                }
            }
            if let Some(url) = obj.get("url").and_then(|v| v.as_str()) {
                if looks_like_remote_source(url) {
                    return true;
                }
            }
            false
        }
        _ => false,
    }
}

fn extract_local_source_path(value: &Value) -> Option<String> {
    match value {
        Value::String(source) => {
            if looks_like_remote_source(source) || is_remote_source_type(source) {
                None
            } else {
                Some(source.to_string())
            }
        }
        Value::Object(obj) => {
            let candidates = get_string_field(value, &["path", "dir", "location"]);
            if let Some(candidate) = candidates {
                if looks_like_remote_source(&candidate) || is_remote_source_type(&candidate) {
                    return None;
                }
                return Some(candidate);
            }

            if let Some(source) = obj.get("source").and_then(|v| v.as_str()) {
                if looks_like_remote_source(source) || is_remote_source_type(source) {
                    return None;
                }
                return Some(source.to_string());
            }

            None
        }
        _ => None,
    }
}

fn parse_author(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(name)) => Some(name.clone()),
        Some(Value::Object(obj)) => obj
            .get("name")
            .and_then(|v| v.as_str())
            .map(|v| v.to_string()),
        _ => None,
    }
}

fn summarize_marketplace_source(value: Option<&Value>) -> Option<String> {
    let Some(value) = value else {
        return None;
    };
    match value {
        Value::String(val) => Some(val.clone()),
        Value::Object(obj) => {
            let kind = obj.get("type").and_then(|v| v.as_str());
            let repo = obj.get("repo").and_then(|v| v.as_str());
            let url = obj.get("url").and_then(|v| v.as_str());
            let path = obj.get("path").and_then(|v| v.as_str());

            if let (Some(kind), Some(repo)) = (kind, repo) {
                return Some(format!("{}:{}", kind, repo));
            }
            if let (Some(kind), Some(url)) = (kind, url) {
                return Some(format!("{}:{}", kind, url));
            }
            if let (Some(kind), Some(path)) = (kind, path) {
                return Some(format!("{}:{}", kind, path));
            }
            if let Some(repo) = repo {
                return Some(repo.to_string());
            }
            if let Some(url) = url {
                return Some(url.to_string());
            }
            if let Some(path) = path {
                return Some(path.to_string());
            }
            kind.map(|k| k.to_string())
        }
        _ => None,
    }
}

fn extract_frontmatter(content: &str) -> Option<String> {
    let mut lines = content.lines();
    let start = lines.next()?.trim();
    if start != "---" {
        return None;
    }

    let mut frontmatter = Vec::new();
    for line in lines {
        let line = line.trim_end();
        if line.trim() == "---" {
            break;
        }
        frontmatter.push(line);
    }

    if frontmatter.is_empty() {
        None
    } else {
        Some(frontmatter.join("\n"))
    }
}

fn parse_frontmatter_value(content: &str, key: &str) -> Option<String> {
    let frontmatter = extract_frontmatter(content)?;
    for line in frontmatter.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(rest) = line.strip_prefix(key) {
            if let Some(value) = rest.strip_prefix(':') {
                let trimmed = value.trim().trim_matches('"').trim_matches('\'');
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

fn scan_markdown_components(dir: &Path) -> Vec<PluginComponent> {
    let mut components = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return components;
    };

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("md") {
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let content = fs::read_to_string(&path).ok();
            let description = content
                .as_ref()
                .and_then(|c| parse_frontmatter_value(c, "description"));
            let display_name = content
                .as_ref()
                .and_then(|c| parse_frontmatter_value(c, "name"))
                .unwrap_or(name);

            components.push(PluginComponent {
                name: display_name,
                description,
                path: Some(path.to_string_lossy().to_string()),
            });
        }
    }

    components
}

fn scan_skill_components(dir: &Path) -> Vec<PluginComponent> {
    let mut components = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return components;
    };

    for entry in entries.filter_map(|e| e.ok()) {
        let skill_dir = entry.path();
        if !skill_dir.is_dir() {
            continue;
        }

        let skill_file = skill_dir.join("SKILL.md");
        if !skill_file.exists() {
            continue;
        }

        let folder_name = skill_dir
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let content = fs::read_to_string(&skill_file).ok();
        let name = content
            .as_ref()
            .and_then(|c| parse_frontmatter_value(c, "name"))
            .unwrap_or(folder_name);
        let description = content
            .as_ref()
            .and_then(|c| parse_frontmatter_value(c, "description"));

        components.push(PluginComponent {
            name,
            description,
            path: Some(skill_file.to_string_lossy().to_string()),
        });
    }

    components
}

fn scan_hook_components(dir: &Path) -> Vec<PluginComponent> {
    let hooks_path = dir.join("hooks").join("hooks.json");
    let fallback_path = dir.join("hooks.json");
    let path = if hooks_path.exists() {
        hooks_path
    } else if fallback_path.exists() {
        fallback_path
    } else {
        return Vec::new();
    };

    let Some(value) = read_json_value(&path) else {
        return Vec::new();
    };

    let entries = if let Some(array) = value.as_array() {
        array.clone()
    } else if let Some(array) = value.get("hooks").and_then(|v| v.as_array()) {
        array.clone()
    } else {
        Vec::new()
    };

    entries
        .iter()
        .filter_map(|entry| {
            let name = get_string_field(entry, &["name", "command", "prompt", "type"])
                .unwrap_or_else(|| "hook".to_string());
            let description = get_string_field(entry, &["description"]);
            Some(PluginComponent {
                name,
                description,
                path: Some(path.to_string_lossy().to_string()),
            })
        })
        .collect()
}

fn parse_mcp_map(map: &serde_json::Map<String, Value>) -> Vec<PluginComponent> {
    map.iter()
        .map(|(name, entry)| PluginComponent {
            name: name.clone(),
            description: get_string_field(entry, &["description", "url", "command"]),
            path: None,
        })
        .collect()
}

fn parse_mcp_entries(value: &Value) -> Vec<PluginComponent> {
    if let Some(array) = value.as_array() {
        return array
            .iter()
            .map(|entry| PluginComponent {
                name: get_string_field(entry, &["name", "id", "command", "url"])
                    .unwrap_or_else(|| "mcp".to_string()),
                description: get_string_field(entry, &["description"]),
                path: None,
            })
            .collect();
    }

    if let Some(obj) = value.as_object() {
        if let Some(map) = obj.get("mcpServers").and_then(|v| v.as_object()) {
            return parse_mcp_map(map);
        }

        if let Some(array) = obj.get("mcpServers").and_then(|v| v.as_array()) {
            return array
                .iter()
                .map(|entry| PluginComponent {
                    name: get_string_field(entry, &["name", "id", "command", "url"])
                        .unwrap_or_else(|| "mcp".to_string()),
                    description: get_string_field(entry, &["description"]),
                    path: None,
                })
                .collect();
        }

        if let Some(map) = obj.get("servers").and_then(|v| v.as_object()) {
            return parse_mcp_map(map);
        }

        if let Some(array) = obj.get("servers").and_then(|v| v.as_array()) {
            return array
                .iter()
                .map(|entry| PluginComponent {
                    name: get_string_field(entry, &["name", "id", "command", "url"])
                        .unwrap_or_else(|| "mcp".to_string()),
                    description: get_string_field(entry, &["description"]),
                    path: None,
                })
                .collect();
        }

        return parse_mcp_map(obj);
    }

    Vec::new()
}

fn resolve_plugin_mcp_path(plugin_path: &Path, raw_path: &str) -> PathBuf {
    let candidate = PathBuf::from(raw_path);
    if candidate.is_absolute() {
        return candidate;
    }

    let root_path = plugin_path.join(&candidate);
    if root_path.exists() {
        return root_path;
    }

    plugin_path.join(".claude-plugin").join(candidate)
}

fn scan_mcp_components(dir: &Path) -> Vec<PluginComponent> {
    let mcp_path = dir.join(".mcp.json");
    let Some(value) = read_json_value(&mcp_path) else {
        return Vec::new();
    };

    let mut components = parse_mcp_entries(&value);
    for component in &mut components {
        component.path = Some(mcp_path.to_string_lossy().to_string());
    }
    components
}

fn scan_manifest_mcp_components(plugin_path: &Path) -> Vec<PluginComponent> {
    let manifest_path = plugin_path.join(".claude-plugin").join("plugin.json");
    let Some(value) = read_json_value(&manifest_path) else {
        return Vec::new();
    };

    let Some(mcp_value) = value.get("mcpServers") else {
        return Vec::new();
    };

    match mcp_value {
        Value::String(path) => {
            let resolved = resolve_plugin_mcp_path(plugin_path, path);
            let Some(config_value) = read_json_value(&resolved) else {
                return Vec::new();
            };
            let mut components = parse_mcp_entries(&config_value);
            for component in &mut components {
                component.path = Some(resolved.to_string_lossy().to_string());
            }
            components
        }
        _ => {
            let mut components = parse_mcp_entries(mcp_value);
            for component in &mut components {
                component.path = Some(manifest_path.to_string_lossy().to_string());
            }
            components
        }
    }
}

fn parse_lsp_components(value: Option<&Value>) -> Vec<PluginComponent> {
    let Some(value) = value else {
        return Vec::new();
    };

    if let Some(array) = value.as_array() {
        return array
            .iter()
            .map(|entry| PluginComponent {
                name: get_string_field(entry, &["name", "language", "id"])
                    .unwrap_or_else(|| "lsp".to_string()),
                description: get_string_field(entry, &["description", "language"]),
                path: None,
            })
            .collect();
    }

    if let Some(obj) = value.as_object() {
        return obj
            .iter()
            .map(|(name, entry)| PluginComponent {
                name: name.clone(),
                description: get_string_field(entry, &["description", "language"]),
                path: None,
            })
            .collect();
    }

    Vec::new()
}

fn parse_plugin_manifest(path: &Path) -> PluginManifestMetadata {
    let Some(value) = read_json_value(path) else {
        return PluginManifestMetadata::default();
    };

    PluginManifestMetadata {
        name: get_string_field(&value, &["name"]),
        description: get_string_field(&value, &["description"]),
        version: get_string_field(&value, &["version"]),
        author: parse_author(value.get("author")),
        repository: get_string_field(&value, &["repository", "repo"]),
    }
}

fn parse_marketplace_entries(value: &Value) -> Vec<MarketplacePluginEntry> {
    let entries = if let Some(array) = value.get("plugins").and_then(|v| v.as_array()) {
        array.clone()
    } else if let Some(array) = value.as_array() {
        array.clone()
    } else {
        Vec::new()
    };

    entries
        .iter()
        .filter_map(|entry| {
            let name = get_string_field(entry, &["name", "id", "plugin", "slug", "directory"])?;
            let description = get_string_field(entry, &["description", "summary"]);
            let source_value = entry.get("source");
            let remote_source = source_value.map(is_remote_source_value).unwrap_or(false);
            let source_path = source_value.and_then(extract_local_source_path);
            let path = get_string_field(entry, &["path", "dir", "location"]).or(source_path);
            let version = get_string_field(entry, &["version"]);
            let repository = get_string_field(entry, &["repository", "repo"]);
            let author = parse_author(entry.get("author"))
                .or_else(|| get_string_field(entry, &["maintainer"]));
            let lsp_servers =
                parse_lsp_components(entry.get("lspServers").or_else(|| entry.get("lsp_servers")));

            Some(MarketplacePluginEntry {
                name,
                description,
                path,
                remote_source,
                version,
                author,
                repository,
                lsp_servers,
            })
        })
        .collect()
}

fn load_enabled_plugins(claude_dir: &Path, errors: &mut Vec<String>) -> HashMap<String, bool> {
    let settings_path = claude_dir.join("settings.json");
    if !settings_path.exists() {
        return HashMap::new();
    }

    let content = match fs::read_to_string(&settings_path) {
        Ok(content) => content,
        Err(err) => {
            errors.push(format!("Failed to read settings.json: {}", err));
            return HashMap::new();
        }
    };

    let settings: Value = match serde_json::from_str(&content) {
        Ok(settings) => settings,
        Err(err) => {
            errors.push(format!("Failed to parse settings.json: {}", err));
            return HashMap::new();
        }
    };

    settings
        .get("enabledPlugins")
        .and_then(|v| v.as_object())
        .map(|map| {
            map.iter()
                .map(|(key, value)| (key.clone(), value.as_bool().unwrap_or(false)))
                .collect()
        })
        .unwrap_or_default()
}

fn load_known_marketplaces(
    claude_dir: &Path,
    errors: &mut Vec<String>,
) -> HashMap<String, MarketplaceRecord> {
    let path = claude_dir.join("plugins").join("known_marketplaces.json");
    let mut records = HashMap::new();
    if !path.exists() {
        return records;
    }
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(err) => {
            errors.push(format!("Failed to read known_marketplaces.json: {}", err));
            return records;
        }
    };
    let value: Value = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(err) => {
            errors.push(format!("Failed to parse known_marketplaces.json: {}", err));
            return records;
        }
    };

    let map = value
        .get("marketplaces")
        .and_then(|v| v.as_object())
        .or_else(|| value.as_object());

    let Some(map) = map else {
        errors.push("known_marketplaces.json has unexpected format".to_string());
        return records;
    };

    for (id, entry) in map {
        let install_location = get_string_field(
            entry,
            &["install_location", "installLocation", "installPath", "path"],
        );
        let last_updated = get_string_field(entry, &["last_updated", "lastUpdated"]);
        let source = summarize_marketplace_source(entry.get("source"));

        records.insert(
            id.clone(),
            MarketplaceRecord {
                id: id.clone(),
                install_location,
                source,
                last_updated,
            },
        );
    }

    records
}

fn extract_install_records(value: &Value) -> Vec<InstalledPluginRecord> {
    let mut records = Vec::new();
    match value {
        Value::Array(entries) => {
            for entry in entries {
                records.extend(extract_install_records(entry));
            }
        }
        Value::Object(_obj) => {
            let path =
                get_string_field(value, &["path", "install_path", "installPath", "location"]);
            let version = get_string_field(value, &["version"]);
            records.push(InstalledPluginRecord { path, version });
        }
        Value::String(path) => {
            records.push(InstalledPluginRecord {
                path: Some(path.clone()),
                version: None,
            });
        }
        _ => {}
    }
    records
}

fn load_installed_plugins(
    claude_dir: &Path,
    errors: &mut Vec<String>,
) -> HashMap<String, Vec<InstalledPluginRecord>> {
    let path = claude_dir.join("plugins").join("installed_plugins.json");
    if !path.exists() {
        return HashMap::new();
    }
    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(err) => {
            errors.push(format!("Failed to read installed_plugins.json: {}", err));
            return HashMap::new();
        }
    };
    let value: Value = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(err) => {
            errors.push(format!("Failed to parse installed_plugins.json: {}", err));
            return HashMap::new();
        }
    };

    let map = value
        .get("plugins")
        .and_then(|v| v.as_object())
        .or_else(|| value.as_object());

    let Some(map) = map else {
        errors.push("installed_plugins.json has unexpected format".to_string());
        return HashMap::new();
    };

    let mut records = HashMap::new();
    for (id, entry) in map {
        records.insert(id.clone(), extract_install_records(entry));
    }
    records
}

fn collect_marketplace_locations(
    claude_dir: &Path,
    known_marketplaces: &HashMap<String, MarketplaceRecord>,
) -> Vec<MarketplaceRecord> {
    let mut locations: HashMap<String, MarketplaceRecord> = known_marketplaces.clone();
    let marketplaces_dir = claude_dir.join("plugins").join("marketplaces");

    if let Ok(entries) = fs::read_dir(&marketplaces_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let id = entry.file_name().to_string_lossy().to_string();
            locations.entry(id.clone()).or_insert(MarketplaceRecord {
                id,
                install_location: Some(path.to_string_lossy().to_string()),
                source: None,
                last_updated: None,
            });
        }
    }

    for record in locations.values_mut() {
        if record.install_location.is_none() {
            record.install_location = Some(
                marketplaces_dir
                    .join(&record.id)
                    .to_string_lossy()
                    .to_string(),
            );
        }
    }

    let mut result: Vec<MarketplaceRecord> = locations.into_values().collect();
    result.sort_by(|a, b| a.id.cmp(&b.id));
    result
}

fn is_not_installed_error(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("not found in installed plugins")
        || lower.contains("not found in installed")
        || lower.contains("not installed")
}

fn is_marketplace_missing_error(message: &str) -> bool {
    let lower = message.to_lowercase();
    if !lower.contains("marketplace") {
        return false;
    }
    lower.contains("not found")
        || lower.contains("missing")
        || lower.contains("no such file")
        || lower.contains("does not exist")
        || lower.contains("os error 2")
}

fn is_already_state_error(action: &str, message: &str) -> bool {
    let lower = message.to_lowercase();
    if action == "enable" {
        lower.contains("already enabled")
    } else if action == "disable" {
        lower.contains("already disabled")
    } else {
        false
    }
}

fn collect_marketplace_plugin_ids(claude_dir: &Path, marketplace: &str) -> Vec<String> {
    let mut errors = Vec::new();
    let installed_plugins = load_installed_plugins(claude_dir, &mut errors);
    let enabled_plugins = load_enabled_plugins(claude_dir, &mut errors);
    let suffix = format!("@{}", marketplace);
    let mut ids = HashSet::new();

    for key in installed_plugins.keys() {
        if key.ends_with(&suffix) {
            ids.insert(key.clone());
        }
    }
    for key in enabled_plugins.keys() {
        if key.ends_with(&suffix) {
            ids.insert(key.clone());
        }
    }

    let mut list: Vec<String> = ids.into_iter().collect();
    list.sort();
    list
}

fn prune_enabled_plugins(claude_dir: &Path, marketplace: &str, errors: &mut Vec<String>) {
    let settings_path = claude_dir.join("settings.json");
    if !settings_path.exists() {
        return;
    }

    let content = match fs::read_to_string(&settings_path) {
        Ok(content) => content,
        Err(err) => {
            errors.push(format!("Failed to read settings.json: {}", err));
            return;
        }
    };
    let mut settings: Value = match serde_json::from_str(&content) {
        Ok(settings) => settings,
        Err(err) => {
            errors.push(format!("Failed to parse settings.json: {}", err));
            return;
        }
    };

    let Some(enabled) = settings
        .get_mut("enabledPlugins")
        .and_then(|v| v.as_object_mut())
    else {
        return;
    };

    let suffix = format!("@{}", marketplace);
    let keys: Vec<String> = enabled.keys().cloned().collect();
    let mut removed = false;
    for key in keys {
        if key.ends_with(&suffix) {
            enabled.remove(&key);
            removed = true;
        }
    }

    if removed {
        if let Some(obj) = settings.as_object_mut() {
            obj.remove("_claudecodeimpact_disabled_env");
        }
        let output = match serde_json::to_string_pretty(&settings) {
            Ok(output) => output,
            Err(err) => {
                errors.push(format!("Failed to serialize settings.json: {}", err));
                return;
            }
        };
        if let Err(err) = fs::write(&settings_path, output) {
            errors.push(format!("Failed to write settings.json: {}", err));
        }
    }
}

fn prune_installed_plugins_file(claude_dir: &Path, marketplace: &str, errors: &mut Vec<String>) {
    let path = claude_dir.join("plugins").join("installed_plugins.json");
    if !path.exists() {
        return;
    }

    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(err) => {
            errors.push(format!("Failed to read installed_plugins.json: {}", err));
            return;
        }
    };
    let mut value: Value = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(err) => {
            errors.push(format!("Failed to parse installed_plugins.json: {}", err));
            return;
        }
    };

    let map_opt = if let Some(map) = value.get_mut("plugins").and_then(|v| v.as_object_mut()) {
        Some(map)
    } else {
        value.as_object_mut()
    };

    let Some(map) = map_opt else {
        errors.push("installed_plugins.json has unexpected format".to_string());
        return;
    };

    let suffix = format!("@{}", marketplace);
    let keys: Vec<String> = map.keys().cloned().collect();
    let mut removed = false;
    for key in keys {
        if key.ends_with(&suffix) {
            map.remove(&key);
            removed = true;
        }
    }

    if removed {
        let output = match serde_json::to_string_pretty(&value) {
            Ok(output) => output,
            Err(err) => {
                errors.push(format!(
                    "Failed to serialize installed_plugins.json: {}",
                    err
                ));
                return;
            }
        };
        if let Err(err) = fs::write(&path, output) {
            errors.push(format!("Failed to write installed_plugins.json: {}", err));
        }
    }
}

fn prune_plugin_records(claude_dir: &Path, plugin_id: &str, errors: &mut Vec<String>) {
    let settings_path = claude_dir.join("settings.json");
    if settings_path.exists() {
        let content = match fs::read_to_string(&settings_path) {
            Ok(content) => content,
            Err(err) => {
                errors.push(format!("Failed to read settings.json: {}", err));
                return;
            }
        };
        let mut settings: Value = match serde_json::from_str(&content) {
            Ok(settings) => settings,
            Err(err) => {
                errors.push(format!("Failed to parse settings.json: {}", err));
                return;
            }
        };
        let mut removed = false;
        if let Some(enabled) = settings
            .get_mut("enabledPlugins")
            .and_then(|v| v.as_object_mut())
        {
            if enabled.remove(plugin_id).is_some() {
                removed = true;
            }
        }
        if removed {
            let output = match serde_json::to_string_pretty(&settings) {
                Ok(output) => output,
                Err(err) => {
                    errors.push(format!("Failed to serialize settings.json: {}", err));
                    return;
                }
            };
            if let Err(err) = fs::write(&settings_path, output) {
                errors.push(format!("Failed to write settings.json: {}", err));
            }
        }
    }

    let installed_path = claude_dir.join("plugins").join("installed_plugins.json");
    if installed_path.exists() {
        let content = match fs::read_to_string(&installed_path) {
            Ok(content) => content,
            Err(err) => {
                errors.push(format!("Failed to read installed_plugins.json: {}", err));
                return;
            }
        };
        let mut value: Value = match serde_json::from_str(&content) {
            Ok(value) => value,
            Err(err) => {
                errors.push(format!("Failed to parse installed_plugins.json: {}", err));
                return;
            }
        };

        let map_opt = if let Some(map) = value.get_mut("plugins").and_then(|v| v.as_object_mut()) {
            Some(map)
        } else {
            value.as_object_mut()
        };

        let Some(map) = map_opt else {
            errors.push("installed_plugins.json has unexpected format".to_string());
            return;
        };

        if map.remove(plugin_id).is_some() {
            let output = match serde_json::to_string_pretty(&value) {
                Ok(output) => output,
                Err(err) => {
                    errors.push(format!(
                        "Failed to serialize installed_plugins.json: {}",
                        err
                    ));
                    return;
                }
            };
            if let Err(err) = fs::write(&installed_path, output) {
                errors.push(format!("Failed to write installed_plugins.json: {}", err));
            }
        }
    }
}

fn repair_orphaned_plugin_records(claude_dir: &Path, plugin_id: &str) -> Result<String, String> {
    let mut errors = Vec::new();
    prune_plugin_records(claude_dir, plugin_id, &mut errors);
    if errors.is_empty() {
        Ok("plugin records removed".to_string())
    } else {
        Err(errors.join("\n"))
    }
}

fn prune_known_marketplaces_file(claude_dir: &Path, marketplace: &str, errors: &mut Vec<String>) {
    let path = claude_dir.join("plugins").join("known_marketplaces.json");
    if !path.exists() {
        return;
    }

    let content = match fs::read_to_string(&path) {
        Ok(content) => content,
        Err(err) => {
            errors.push(format!("Failed to read known_marketplaces.json: {}", err));
            return;
        }
    };
    let mut value: Value = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(err) => {
            errors.push(format!("Failed to parse known_marketplaces.json: {}", err));
            return;
        }
    };

    let map_opt = if let Some(map) = value
        .get_mut("marketplaces")
        .and_then(|v| v.as_object_mut())
    {
        Some(map)
    } else {
        value.as_object_mut()
    };

    let Some(map) = map_opt else {
        errors.push("known_marketplaces.json has unexpected format".to_string());
        return;
    };

    if map.remove(marketplace).is_some() {
        let output = match serde_json::to_string_pretty(&value) {
            Ok(output) => output,
            Err(err) => {
                errors.push(format!(
                    "Failed to serialize known_marketplaces.json: {}",
                    err
                ));
                return;
            }
        };
        if let Err(err) = fs::write(&path, output) {
            errors.push(format!("Failed to write known_marketplaces.json: {}", err));
        }
    }
}

fn remove_marketplace_dir(claude_dir: &Path, marketplace: &str, errors: &mut Vec<String>) {
    if marketplace.contains('/') || marketplace.contains('\\') {
        errors.push("Invalid marketplace name".to_string());
        return;
    }

    let path = claude_dir
        .join("plugins")
        .join("marketplaces")
        .join(marketplace);
    if path.exists() {
        if let Err(err) = fs::remove_dir_all(&path) {
            errors.push(format!(
                "Failed to remove marketplace directory {}: {}",
                path.to_string_lossy(),
                err
            ));
        }
    }
}

fn resolve_plugin_path(
    marketplace_path: &Path,
    entry: &MarketplacePluginEntry,
    installed_records: Option<&Vec<InstalledPluginRecord>>,
) -> Option<PathBuf> {
    if let Some(records) = installed_records {
        for record in records {
            if let Some(path) = &record.path {
                let candidate = PathBuf::from(path);
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }

    if let Some(entry_path) = &entry.path {
        let candidate = marketplace_path.join(entry_path);
        if candidate.exists() {
            return Some(candidate);
        }
    }

    let candidate = marketplace_path.join(&entry.name);
    if candidate.exists() {
        return Some(candidate);
    }

    let candidate = marketplace_path.join("plugins").join(&entry.name);
    if candidate.exists() {
        return Some(candidate);
    }

    None
}

fn scan_plugin_components(
    plugin_path: &Path,
    lsp_components: Vec<PluginComponent>,
) -> PluginComponents {
    let mut components = PluginComponents {
        lsps: lsp_components,
        ..PluginComponents::default()
    };

    let commands_dir = plugin_path.join("commands");
    if commands_dir.exists() {
        components.commands = scan_markdown_components(&commands_dir);
    }

    let agents_dir = plugin_path.join("agents");
    if agents_dir.exists() {
        components.agents = scan_markdown_components(&agents_dir);
    }

    let skills_dir = plugin_path.join("skills");
    if skills_dir.exists() {
        components.skills = scan_skill_components(&skills_dir);
    }

    components.hooks = scan_hook_components(plugin_path);
    let mcp_components = scan_mcp_components(plugin_path);
    components.mcps = if mcp_components.is_empty() {
        scan_manifest_mcp_components(plugin_path)
    } else {
        mcp_components
    };

    components
}

fn scan_plugin_repository() -> PluginScanResult {
    let claude_dir = get_claude_dir();
    let mut errors = Vec::new();

    let enabled_plugins = load_enabled_plugins(&claude_dir, &mut errors);
    let known_marketplaces = load_known_marketplaces(&claude_dir, &mut errors);
    let installed_plugins = load_installed_plugins(&claude_dir, &mut errors);
    let marketplace_locations = collect_marketplace_locations(&claude_dir, &known_marketplaces);

    let mut scanned_plugins = Vec::new();
    let mut scanned_marketplaces = Vec::new();
    let mut scanned_ids = HashSet::new();

    for marketplace in marketplace_locations {
        let Some(install_location) = marketplace.install_location.clone() else {
            continue;
        };

        let marketplace_path = PathBuf::from(&install_location);
        let manifest_path = marketplace_path
            .join(".claude-plugin")
            .join("marketplace.json");
        let manifest_value = read_json_value(&manifest_path);

        let (entries, marketplace_name) = if let Some(value) = manifest_value.as_ref() {
            (
                parse_marketplace_entries(value),
                get_string_field(value, &["name"]).unwrap_or_else(|| marketplace.id.clone()),
            )
        } else {
            if manifest_path.exists() {
                errors.push(format!(
                    "Failed to parse marketplace manifest: {}",
                    manifest_path.to_string_lossy()
                ));
            } else {
                errors.push(format!(
                    "Missing marketplace manifest: {}",
                    manifest_path.to_string_lossy()
                ));
            }
            (Vec::new(), marketplace.id.clone())
        };

        scanned_marketplaces.push(ScannedMarketplace {
            id: marketplace.id.clone(),
            name: marketplace_name.clone(),
            install_location: Some(install_location.clone()),
            source: marketplace.source.clone(),
            plugin_count: entries.len(),
            last_updated: marketplace.last_updated.clone(),
        });

        for entry in entries {
            let plugin_id = format!("{}@{}", entry.name, marketplace.id);
            let installed_records = installed_plugins.get(&plugin_id);
            let plugin_path = resolve_plugin_path(&marketplace_path, &entry, installed_records);
            let is_installed = installed_records
                .map(|records| records.iter().any(|r| r.path.is_some()))
                .unwrap_or(false);
            let is_enabled = enabled_plugins.get(&plugin_id).copied().unwrap_or(false);

            let manifest_metadata = plugin_path
                .as_ref()
                .map(|path| parse_plugin_manifest(&path.join(".claude-plugin").join("plugin.json")))
                .unwrap_or_default();

            let name = manifest_metadata
                .name
                .clone()
                .unwrap_or_else(|| entry.name.clone());
            let description = manifest_metadata
                .description
                .clone()
                .or_else(|| entry.description.clone());
            let version = manifest_metadata
                .version
                .clone()
                .or_else(|| entry.version.clone());
            let author = manifest_metadata
                .author
                .clone()
                .or_else(|| entry.author.clone());
            let repository = manifest_metadata
                .repository
                .clone()
                .or_else(|| entry.repository.clone());

            let components = if let Some(path) = plugin_path.as_ref() {
                scan_plugin_components(path, entry.lsp_servers.clone())
            } else {
                PluginComponents {
                    lsps: entry.lsp_servers.clone(),
                    ..PluginComponents::default()
                }
            };
            let components_source = if plugin_path.is_none() && entry.remote_source {
                Some("remote".to_string())
            } else {
                None
            };

            scanned_ids.insert(plugin_id.clone());
            scanned_plugins.push(ScannedPlugin {
                id: plugin_id,
                name,
                description,
                version,
                author,
                repository,
                marketplace: marketplace.id.clone(),
                is_installed,
                is_enabled,
                local_path: plugin_path.map(|p| p.to_string_lossy().to_string()),
                components,
                components_source,
            });
        }
    }

    for (plugin_id, records) in &installed_plugins {
        if scanned_ids.contains(plugin_id) {
            continue;
        }

        let (name, marketplace) = plugin_id
            .split_once('@')
            .map(|(name, marketplace)| (name.to_string(), marketplace.to_string()))
            .unwrap_or_else(|| (plugin_id.clone(), "unknown".to_string()));
        let plugin_path = records
            .iter()
            .filter_map(|record| record.path.as_ref())
            .find(|path| PathBuf::from(path).exists())
            .map(PathBuf::from);
        let is_enabled = enabled_plugins.get(plugin_id).copied().unwrap_or(false);
        let manifest_metadata = plugin_path
            .as_ref()
            .map(|path| parse_plugin_manifest(&path.join(".claude-plugin").join("plugin.json")))
            .unwrap_or_default();
        let components = if let Some(path) = plugin_path.as_ref() {
            scan_plugin_components(path, Vec::new())
        } else {
            PluginComponents::default()
        };

        if scanned_marketplaces
            .iter()
            .all(|market| market.id != marketplace)
        {
            scanned_marketplaces.push(ScannedMarketplace {
                id: marketplace.clone(),
                name: marketplace.clone(),
                install_location: None,
                source: None,
                plugin_count: 0,
                last_updated: None,
            });
        }

        scanned_plugins.push(ScannedPlugin {
            id: plugin_id.clone(),
            name: manifest_metadata.name.unwrap_or(name),
            description: manifest_metadata.description,
            version: manifest_metadata.version,
            author: manifest_metadata.author,
            repository: manifest_metadata.repository,
            marketplace,
            is_installed: true,
            is_enabled,
            local_path: plugin_path.map(|p| p.to_string_lossy().to_string()),
            components,
            components_source: None,
        });
    }

    let mut marketplace_counts: HashMap<String, usize> = HashMap::new();
    for plugin in &scanned_plugins {
        *marketplace_counts
            .entry(plugin.marketplace.clone())
            .or_insert(0) += 1;
    }
    for marketplace in &mut scanned_marketplaces {
        if let Some(count) = marketplace_counts.get(&marketplace.id) {
            marketplace.plugin_count = *count;
        }
    }

    scanned_plugins.sort_by(|a, b| a.name.cmp(&b.name));
    scanned_marketplaces.sort_by(|a, b| a.name.cmp(&b.name));

    PluginScanResult {
        marketplaces: scanned_marketplaces,
        plugins: scanned_plugins,
        errors,
    }
}

#[tauri::command]
fn scan_plugins() -> Result<PluginScanResult, String> {
    Ok(scan_plugin_repository())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledPlugin {
    pub id: String,
    pub name: String,
    pub marketplace: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExtensionMarketplace {
    pub id: String,
    pub name: String,
    pub repo: Option<String>,
    pub path: Option<String>,
    pub is_official: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MarketplacePlugin {
    pub name: String,
    pub description: Option<String>,
    pub path: String,
}

#[tauri::command]
fn list_installed_plugins() -> Result<Vec<InstalledPlugin>, String> {
    let settings_path = get_claude_dir().join("settings.json");

    if !settings_path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let settings: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let mut plugins = vec![];

    if let Some(enabled_plugins) = settings.get("enabledPlugins").and_then(|v| v.as_object()) {
        for (id, enabled) in enabled_plugins {
            let parts: Vec<&str> = id.split('@').collect();
            let (name, marketplace) = if parts.len() >= 2 {
                (parts[0].to_string(), parts[1..].join("@"))
            } else {
                (id.clone(), "unknown".to_string())
            };

            plugins.push(InstalledPlugin {
                id: id.clone(),
                name,
                marketplace,
                enabled: enabled.as_bool().unwrap_or(false),
            });
        }
    }

    Ok(plugins)
}

#[tauri::command]
fn list_extension_marketplaces() -> Result<Vec<ExtensionMarketplace>, String> {
    let settings_path = get_claude_dir().join("settings.json");

    let mut marketplaces = vec![ExtensionMarketplace {
        id: "claude-plugins-official".to_string(),
        name: "Claude Plugins Official".to_string(),
        repo: Some("anthropics/claude-code".to_string()),
        path: None,
        is_official: true,
    }];

    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        let settings: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

        if let Some(extra) = settings
            .get("extraKnownMarketplaces")
            .and_then(|v| v.as_object())
        {
            for (id, config) in extra {
                let repo = config
                    .get("source")
                    .and_then(|s| s.get("repo"))
                    .and_then(|r| r.as_str())
                    .map(|s| s.to_string());
                let path = config
                    .get("source")
                    .and_then(|s| s.get("path"))
                    .and_then(|p| p.as_str())
                    .map(|s| s.to_string());

                marketplaces.push(ExtensionMarketplace {
                    id: id.clone(),
                    name: id.clone(),
                    repo,
                    path,
                    is_official: false,
                });
            }
        }
    }

    Ok(marketplaces)
}

#[tauri::command]
async fn fetch_marketplace_plugins(
    owner: String,
    repo: String,
    plugins_path: Option<String>,
) -> Result<Vec<MarketplacePlugin>, String> {
    let path = plugins_path.unwrap_or_else(|| "plugins".to_string());
    let url = format!(
        "https://api.github.com/repos/{}/{}/contents/{}",
        owner, repo, path
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "claudecodeimpact")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    let items: Vec<Value> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let mut plugins = vec![];

    for item in items {
        if item.get("type").and_then(|t| t.as_str()) == Some("dir") {
            let name = item
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .to_string();
            let path = item
                .get("path")
                .and_then(|p| p.as_str())
                .unwrap_or("")
                .to_string();

            if !name.is_empty() && !name.starts_with('.') {
                plugins.push(MarketplacePlugin {
                    name: name.clone(),
                    description: None,
                    path,
                });
            }
        }
    }

    Ok(plugins)
}

#[tauri::command]
async fn install_extension(
    plugin_id: String,
    marketplace: Option<String>,
) -> Result<String, String> {
    let full_id = if let Some(mkt) = marketplace {
        format!("{}@{}", plugin_id, mkt)
    } else {
        plugin_id
    };

    let command = format!(
        "claude plugin install {}",
        shell_escape::escape(full_id.into())
    );
    let home = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .to_string_lossy()
        .to_string();

    exec_shell_command(command, home).await
}

#[tauri::command]
async fn uninstall_extension(plugin_id: String) -> Result<String, String> {
    let command = format!(
        "claude plugin uninstall {}",
        shell_escape::escape(plugin_id.into())
    );
    let home = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .to_string_lossy()
        .to_string();

    exec_shell_command(command, home).await
}

#[tauri::command]
async fn add_extension_marketplace(source: String) -> Result<String, String> {
    let command = format!(
        "claude plugin marketplace add {}",
        shell_escape::escape(source.into())
    );
    let home = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .to_string_lossy()
        .to_string();

    exec_shell_command(command, home).await
}

#[tauri::command]
async fn remove_extension_marketplace(name: String) -> Result<String, String> {
    let command = format!(
        "claude plugin marketplace remove {}",
        shell_escape::escape(name.into())
    );
    let home = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .to_string_lossy()
        .to_string();

    exec_shell_command(command, home).await
}

#[tauri::command]
async fn update_extension_marketplace(name: Option<String>) -> Result<String, String> {
    let command = if let Some(name) = name {
        format!(
            "claude plugin marketplace update {}",
            shell_escape::escape(name.into())
        )
    } else {
        "claude plugin marketplace update".to_string()
    };
    let home = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .to_string_lossy()
        .to_string();

    exec_shell_command(command, home).await
}

#[tauri::command]
async fn remove_extension_marketplace_safe(name: String) -> Result<String, String> {
    let claude_dir = get_claude_dir();
    let plugin_ids = collect_marketplace_plugin_ids(&claude_dir, &name);
    let mut errors = Vec::new();

    for plugin_id in &plugin_ids {
        if let Err(err) = uninstall_plugin_with_fallback(plugin_id).await {
            errors.push(format!("Failed to uninstall plugin {}: {}", plugin_id, err));
        }
    }

    if let Err(err) = remove_extension_marketplace(name.clone()).await {
        if !is_marketplace_missing_error(&err) {
            errors.push(format!("Failed to remove marketplace {}: {}", name, err));
        }
    }

    prune_enabled_plugins(&claude_dir, &name, &mut errors);
    prune_installed_plugins_file(&claude_dir, &name, &mut errors);
    prune_known_marketplaces_file(&claude_dir, &name, &mut errors);
    remove_marketplace_dir(&claude_dir, &name, &mut errors);

    if errors.is_empty() {
        Ok("ok".to_string())
    } else {
        Err(errors.join("\n"))
    }
}

async fn run_plugin_cli_action(action: &str, plugin_id: String) -> Result<String, String> {
    let command = format!(
        "claude plugin {} {}",
        action,
        shell_escape::escape(plugin_id.into())
    );
    let home = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .to_string_lossy()
        .to_string();

    exec_shell_command(command, home).await
}

async fn uninstall_plugin_with_fallback(plugin_id: &str) -> Result<String, String> {
    let claude_dir = get_claude_dir();
    match uninstall_extension(plugin_id.to_string()).await {
        Ok(output) => Ok(output),
        Err(err) => {
            if is_not_installed_error(&err) {
                if install_extension(plugin_id.to_string(), None).await.is_ok() {
                    match uninstall_extension(plugin_id.to_string()).await {
                        Ok(output) => return Ok(output),
                        Err(uninstall_err) => {
                            if !is_not_installed_error(&uninstall_err) {
                                return Err(uninstall_err);
                            }
                        }
                    }
                }
                return repair_orphaned_plugin_records(&claude_dir, plugin_id);
            }
            Err(err)
        }
    }
}

async fn run_plugin_action_with_fallback(action: &str, plugin_id: &str) -> Result<String, String> {
    let claude_dir = get_claude_dir();
    match run_plugin_cli_action(action, plugin_id.to_string()).await {
        Ok(output) => Ok(output),
        Err(err) => {
            if is_already_state_error(action, &err) {
                return Ok(err);
            }
            if is_not_installed_error(&err) {
                if install_extension(plugin_id.to_string(), None).await.is_ok() {
                    match run_plugin_cli_action(action, plugin_id.to_string()).await {
                        Ok(output) => return Ok(output),
                        Err(action_err) => {
                            if !is_not_installed_error(&action_err) {
                                return Err(action_err);
                            }
                        }
                    }
                }
                return repair_orphaned_plugin_records(&claude_dir, plugin_id);
            }
            Err(err)
        }
    }
}

#[tauri::command]
async fn install_plugin(plugin_id: String) -> Result<String, String> {
    install_extension(plugin_id, None).await
}

#[tauri::command]
async fn uninstall_plugin(plugin_id: String) -> Result<String, String> {
    uninstall_plugin_with_fallback(&plugin_id).await
}

#[tauri::command]
async fn enable_plugin(plugin_id: String) -> Result<String, String> {
    run_plugin_action_with_fallback("enable", &plugin_id).await
}

#[tauri::command]
async fn disable_plugin(plugin_id: String) -> Result<String, String> {
    run_plugin_action_with_fallback("disable", &plugin_id).await
}

#[tauri::command]
async fn update_plugin(plugin_id: String) -> Result<String, String> {
    run_plugin_cli_action("update", plugin_id).await
}

// Disabled hooks storage path
fn get_disabled_hooks_path() -> std::path::PathBuf {
    get_claudecodeimpact_dir().join("disabled_hooks.json")
}

fn load_disabled_hooks() -> Result<Value, String> {
    let path = get_disabled_hooks_path();
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(serde_json::json!({}))
    }
}

fn save_disabled_hooks(disabled_hooks: &Value) -> Result<(), String> {
    let path = get_disabled_hooks_path();
    let output = serde_json::to_string_pretty(disabled_hooks).map_err(|e| e.to_string())?;
    fs::write(&path, output).map_err(|e| e.to_string())?;
    Ok(())
}

// Generate a unique key for a hook based on its content
fn get_hook_content_key(hook: &Value) -> String {
    // Use command or prompt as the key, with type prefix for uniqueness
    let hook_type = hook
        .get("type")
        .and_then(|t| t.as_str())
        .unwrap_or("unknown");
    let content = hook
        .get("command")
        .or_else(|| hook.get("prompt"))
        .and_then(|c| c.as_str())
        .unwrap_or("");
    format!("{}:{}", hook_type, content)
}

#[tauri::command]
fn toggle_hook_item(
    event_type: String,
    matcher_index: usize,
    hook_index: usize,
    disabled: bool,
) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");
    let mut settings: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        return Err("No settings.json found".to_string());
    };

    let mut disabled_hooks = load_disabled_hooks()?;

    if disabled {
        // Disable: Remove from settings.json and backup to disabled_hooks.json
        // First get matcher info (immutable borrow)
        let matcher = settings
            .get("hooks")
            .and_then(|h| h.get(&event_type))
            .and_then(|arr| arr.get(matcher_index))
            .and_then(|m| m.get("matcher"))
            .cloned()
            .unwrap_or(Value::String("".to_string()));

        // Then get mutable borrow
        let hooks_arr = settings
            .get_mut("hooks")
            .and_then(|h| h.get_mut(&event_type))
            .and_then(|arr| arr.get_mut(matcher_index))
            .and_then(|m| m.get_mut("hooks"))
            .and_then(|hooks| hooks.as_array_mut())
            .ok_or("Hook not found")?;

        if hook_index >= hooks_arr.len() {
            return Err("Hook index out of bounds".to_string());
        }

        // Backup the hook before removing
        let removed_hook = hooks_arr.remove(hook_index);
        let hook_key = get_hook_content_key(&removed_hook);

        // Store in disabled_hooks with context for restoration
        if !disabled_hooks.get(&event_type).is_some() {
            disabled_hooks[&event_type] = serde_json::json!([]);
        }

        // Store as array to preserve order and allow multiple disabled hooks
        if let Some(arr) = disabled_hooks[&event_type].as_array_mut() {
            arr.push(serde_json::json!({
                "matcher": matcher,
                "hook": removed_hook,
                "key": hook_key
            }));
        }

        save_disabled_hooks(&disabled_hooks)?;
    } else {
        // Enable: Restore from disabled_hooks.json to settings.json
        // First, get the hook to restore based on index in disabled list
        let hooks_arr = settings
            .get_mut("hooks")
            .and_then(|h| h.get_mut(&event_type))
            .and_then(|arr| arr.get_mut(matcher_index))
            .and_then(|m| m.get_mut("hooks"))
            .and_then(|hooks| hooks.as_array_mut())
            .ok_or("Hook location not found")?;

        // Get the hook_index-th item from disabled hooks for this event type
        let disabled_arr = disabled_hooks
            .get_mut(&event_type)
            .and_then(|v| v.as_array_mut())
            .ok_or("No disabled hooks for this event type")?;

        if hook_index >= disabled_arr.len() {
            return Err("Disabled hook index out of bounds".to_string());
        }

        let backup = disabled_arr.remove(hook_index);
        let hook_data = backup.get("hook").ok_or("Invalid backup data")?.clone();

        // Insert at the end of the active hooks
        hooks_arr.push(hook_data);

        save_disabled_hooks(&disabled_hooks)?;
    }

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_disabled_hooks() -> Result<Value, String> {
    load_disabled_hooks()
}

#[tauri::command]
fn delete_hook_item(
    event_type: String,
    matcher_index: usize,
    hook_index: usize,
) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");
    let mut settings: Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        return Err("No settings.json found".to_string());
    };

    let hooks_arr = settings
        .get_mut("hooks")
        .and_then(|h| h.get_mut(&event_type))
        .and_then(|arr| arr.get_mut(matcher_index))
        .and_then(|m| m.get_mut("hooks"))
        .and_then(|hooks| hooks.as_array_mut())
        .ok_or("Hook not found")?;

    if hook_index >= hooks_arr.len() {
        return Err("Hook index out of bounds".to_string());
    }

    // Permanently remove without backup
    hooks_arr.remove(hook_index);

    if let Some(obj) = settings.as_object_mut() {
        obj.remove("_claudecodeimpact_disabled_env");
    }

    let output = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_disabled_hook(event_type: String, index: usize) -> Result<(), String> {
    let mut disabled_hooks = load_disabled_hooks()?;

    let disabled_arr = disabled_hooks
        .get_mut(&event_type)
        .and_then(|v| v.as_array_mut())
        .ok_or("No disabled hooks for this event type")?;

    if index >= disabled_arr.len() {
        return Err("Index out of bounds".to_string());
    }

    // Permanently remove from disabled list
    disabled_arr.remove(index);
    save_disabled_hooks(&disabled_hooks)?;
    Ok(())
}

#[derive(Serialize)]
struct ConnectionTestResult {
    ok: bool,
    status: u16,
    body: String,
}

#[tauri::command]
async fn test_anthropic_connection(
    base_url: String,
    auth_token: String,
    model: String,
) -> Result<ConnectionTestResult, String> {
    if auth_token.trim().is_empty() {
        return Err("ANTHROPIC_AUTH_TOKEN is empty".to_string());
    }

    let base = base_url.trim_end_matches('/');
    let url = format!("{}/v1/messages", base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;
    let payload = serde_json::json!({
        "model": model,
        "max_tokens": 1,
        "messages": [
            { "role": "user", "content": "ping" }
        ]
    });

    println!("anthropic test request url={}", url);
    println!("anthropic test request headers x-api-key={} anthropic-version=2023-06-01 content-type=application/json", auth_token);
    println!("anthropic test request body={}", payload);

    let response = client
        .post(&url)
        .header("x-api-key", auth_token)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    println!("anthropic test status={} body={}", status, body);

    Ok(ConnectionTestResult {
        ok: status.is_success(),
        status: status.as_u16(),
        body,
    })
}

#[tauri::command]
async fn test_openai_connection(
    base_url: String,
    api_key: String,
) -> Result<ConnectionTestResult, String> {
    if api_key.trim().is_empty() {
        return Err("API key is empty".to_string());
    }

    let base = base_url.trim_end_matches('/');
    let url = format!("{}/models", base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    Ok(ConnectionTestResult {
        ok: status.is_success(),
        status: status.as_u16(),
        body,
    })
}

#[derive(Serialize)]
struct ClaudeCliTestResult {
    ok: bool,
    code: i32,
    stdout: String,
    stderr: String,
}

#[tauri::command]
async fn test_claude_cli(
    base_url: String,
    auth_token: String,
) -> Result<ClaudeCliTestResult, String> {
    if auth_token.trim().is_empty() {
        return Err("ANTHROPIC_AUTH_TOKEN is empty".to_string());
    }

    let output = tokio::process::Command::new("claude")
        .arg("--print")
        .arg("reply 1")
        .env("ANTHROPIC_BASE_URL", &base_url)
        .env("ANTHROPIC_AUTH_TOKEN", &auth_token)
        .output()
        .await
        .map_err(|e| format!("Failed to execute claude CLI: {}", e))?;

    let code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    println!(
        "claude cli test code={} stdout={} stderr={}",
        code, stdout, stderr
    );

    Ok(ClaudeCliTestResult {
        ok: output.status.success(),
        code,
        stdout,
        stderr,
    })
}

