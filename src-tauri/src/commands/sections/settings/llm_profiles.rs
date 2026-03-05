use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

const LLM_PROFILES_STATE_KEY: &str = "settings.llm_profiles_state";
const LLM_PROFILES_FILE_RECOVERY_MARKER_KEY: &str = "_system.llm_profiles_file_recovery_v3";
const DEFAULT_ANTHROPIC_BASE_URL: &str = "https://api.anthropic.com";
const MAX_DISCOVERED_PROFILE_COUNT: usize = 5;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
struct LlmProfile {
    id: String,
    name: String,
    auth_token: String,
    base_url: String,
    default_opus_model: String,
    default_sonnet_model: String,
    default_haiku_model: String,
    model: String,
    small_fast_model: String,
    updated_at: i64,
}

fn default_llm_view_mode() -> String {
    "list".to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LlmProfilesState {
    #[serde(default)]
    profiles: Vec<LlmProfile>,
    #[serde(default = "default_llm_view_mode")]
    view_mode: String,
}

impl Default for LlmProfilesState {
    fn default() -> Self {
        Self {
            profiles: Vec::new(),
            view_mode: default_llm_view_mode(),
        }
    }
}

fn load_state_from_store() -> Result<LlmProfilesState, String> {
    if let Some(value) = read_data_key(LLM_PROFILES_STATE_KEY)? {
        let state: LlmProfilesState = serde_json::from_value(value).unwrap_or_default();
        return Ok(state);
    }
    Ok(LlmProfilesState::default())
}

fn save_state_to_store(state: &LlmProfilesState) -> Result<(), String> {
    let value: Value = serde_json::to_value(state).map_err(|e| e.to_string())?;
    write_data_key(LLM_PROFILES_STATE_KEY, value)
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

fn normalize_token(value: &str) -> String {
    value.trim().to_string()
}

fn normalize_base_url(value: &str) -> String {
    let trimmed = value.trim();
    let resolved = if trimmed.is_empty() {
        DEFAULT_ANTHROPIC_BASE_URL
    } else {
        trimmed
    };
    resolved.trim_end_matches('/').to_lowercase()
}

fn profile_fingerprint(profile: &LlmProfile) -> String {
    format!(
        "{}@@{}",
        normalize_token(&profile.auth_token),
        normalize_base_url(&profile.base_url)
    )
}

fn hash_to_profile_id(seed: &str) -> String {
    let mut hasher = DefaultHasher::new();
    seed.hash(&mut hasher);
    format!("migrated-{:x}", hasher.finish())
}

fn infer_provider_name(base_url: &str) -> String {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return "Anthropic API".to_string();
    }
    let host_with_path = trimmed
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let host = host_with_path.split('/').next().unwrap_or("").trim();
    let normalized_host = host.strip_prefix("api.").unwrap_or(host);
    if normalized_host.is_empty() {
        "Anthropic API".to_string()
    } else {
        normalized_host.to_string()
    }
}

fn is_placeholder_token(token: &str) -> bool {
    let lower = token.trim().to_lowercase();
    matches!(
        lower.as_str(),
        "" | "a" | "aa" | "your-api-key" | "your_api_key" | "your api key" | "placeholder"
    )
}

fn is_valid_token(token: &str) -> bool {
    let trimmed = token.trim();
    !is_placeholder_token(trimmed) && trimmed.len() >= 8
}

fn is_valid_base_url(base_url: &str) -> bool {
    let trimmed = base_url.trim();
    (trimmed.starts_with("https://") || trimmed.starts_with("http://"))
        && trimmed.split('/').nth(2).is_some_and(|host| !host.trim().is_empty())
}

fn backup_timestamp_from_filename(path: &Path) -> Option<i64> {
    let file_name = path.file_name()?.to_str()?;
    let raw_ts = file_name.strip_prefix("settings.json.backup.")?;
    if !raw_ts.chars().all(|ch| ch.is_ascii_digit()) {
        return None;
    }
    let parsed = raw_ts.parse::<i64>().ok()?;
    if parsed > 10_000_000_000 {
        Some(parsed)
    } else {
        Some(parsed * 1000)
    }
}

fn file_modified_timestamp(path: &Path) -> i64 {
    fs::metadata(path)
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_else(now_millis)
}

fn read_profile_from_settings_file(path: &Path) -> Option<LlmProfile> {
    let text = fs::read_to_string(path).ok()?;
    let parsed: Value = serde_json::from_str(&text).ok()?;
    let env = parsed.get("env")?.as_object()?;

    let token = env
        .get("ANTHROPIC_AUTH_TOKEN")
        .or_else(|| env.get("ANTHROPIC_API_KEY"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let base_url = env
        .get("ANTHROPIC_BASE_URL")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let default_opus_model = env
        .get("ANTHROPIC_DEFAULT_OPUS_MODEL")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let default_sonnet_model = env
        .get("ANTHROPIC_DEFAULT_SONNET_MODEL")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let default_haiku_model = env
        .get("ANTHROPIC_DEFAULT_HAIKU_MODEL")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let model = env
        .get("ANTHROPIC_MODEL")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let small_fast_model = env
        .get("ANTHROPIC_SMALL_FAST_MODEL")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let token_valid = is_valid_token(&token);
    let base_valid = is_valid_base_url(&base_url);
    if !token_valid && !base_valid {
        return None;
    }

    let updated_at = backup_timestamp_from_filename(path).unwrap_or_else(|| file_modified_timestamp(path));
    let name = infer_provider_name(&base_url);
    let fingerprint_seed = format!("{}@@{}", normalize_token(&token), normalize_base_url(&base_url));

    Some(LlmProfile {
        id: hash_to_profile_id(&fingerprint_seed),
        name,
        auth_token: if token_valid { token } else { String::new() },
        base_url,
        default_opus_model,
        default_sonnet_model,
        default_haiku_model,
        model,
        small_fast_model,
        updated_at,
    })
}

fn collect_native_user_settings_files() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let claude_dir = get_claude_dir();
    if !claude_dir.exists() {
        return paths;
    }

    if let Ok(entries) = fs::read_dir(&claude_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
            let is_settings = file_name == "settings.json"
                || file_name == "settings.local.json"
                || file_name.starts_with("settings.json.backup.");
            if path.is_file() && is_settings {
                paths.push(path);
            }
        }
    }
    paths
}

fn collect_managed_recovery_settings_files(root: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let user_settings = root.join("settings-scopes").join("user-settings.json");
    if user_settings.is_file() {
        paths.push(user_settings);
    }

    let user_scope_claude = root.join("scopes").join("user").join("claude");
    if let Ok(entries) = fs::read_dir(&user_scope_claude) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
            let is_settings = file_name == "settings.json" || file_name.starts_with("settings.json.backup.");
            if path.is_file() && is_settings {
                paths.push(path);
            }
        }
    }

    paths
}

fn collect_launch_settings_files(root: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(entries) = fs::read_dir(root.join("launch-settings")) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if path.is_file() && file_name.starts_with("settings-") && file_name.ends_with(".json") {
                paths.push(path);
            }
        }
    }
    paths
}

fn discover_profiles_from_files() -> Vec<LlmProfile> {
    let root = get_claudecodeimpact_dir();
    let mut candidate_paths = Vec::new();
    candidate_paths.extend(collect_native_user_settings_files());
    candidate_paths.extend(collect_managed_recovery_settings_files(&root));
    candidate_paths.extend(collect_launch_settings_files(&root));

    let mut dedup = HashMap::<String, LlmProfile>::new();
    for path in candidate_paths {
        let Some(profile) = read_profile_from_settings_file(&path) else {
            continue;
        };
        let key = profile_fingerprint(&profile);
        match dedup.get(&key) {
            Some(existing) if existing.updated_at >= profile.updated_at => {}
            _ => {
                dedup.insert(key, profile);
            }
        }
    }

    let mut profiles: Vec<LlmProfile> = dedup.into_values().collect();
    profiles.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    if profiles.len() > MAX_DISCOVERED_PROFILE_COUNT {
        profiles.truncate(MAX_DISCOVERED_PROFILE_COUNT);
    }
    profiles
}

fn merge_profiles(existing: &[LlmProfile], discovered: &[LlmProfile]) -> Vec<LlmProfile> {
    let mut merged = HashMap::<String, LlmProfile>::new();

    for profile in existing {
        merged.insert(profile_fingerprint(profile), profile.clone());
    }

    for profile in discovered {
        let key = profile_fingerprint(profile);
        if let Some(current) = merged.get_mut(&key) {
            if current.name.trim().is_empty() {
                current.name = profile.name.clone();
            }
            if current.auth_token.trim().is_empty() {
                current.auth_token = profile.auth_token.clone();
            }
            if current.base_url.trim().is_empty() {
                current.base_url = profile.base_url.clone();
            }
            if current.default_opus_model.trim().is_empty() {
                current.default_opus_model = profile.default_opus_model.clone();
            }
            if current.default_sonnet_model.trim().is_empty() {
                current.default_sonnet_model = profile.default_sonnet_model.clone();
            }
            if current.default_haiku_model.trim().is_empty() {
                current.default_haiku_model = profile.default_haiku_model.clone();
            }
            if current.model.trim().is_empty() {
                current.model = profile.model.clone();
            }
            if current.small_fast_model.trim().is_empty() {
                current.small_fast_model = profile.small_fast_model.clone();
            }
            if profile.updated_at > current.updated_at {
                current.updated_at = profile.updated_at;
            }
            continue;
        }
        merged.insert(key, profile.clone());
    }

    let mut values: Vec<LlmProfile> = merged.into_values().collect();
    values.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    values
}

fn should_attempt_file_recovery(state: &LlmProfilesState) -> Result<bool, String> {
    if state.profiles.len() > 1 {
        return Ok(false);
    }
    let marker = read_data_key(LLM_PROFILES_FILE_RECOVERY_MARKER_KEY)?;
    Ok(!matches!(marker, Some(Value::Bool(true))))
}

#[tauri::command]
fn get_llm_profiles_state() -> Result<LlmProfilesState, String> {
    let mut state = load_state_from_store()?;

    if should_attempt_file_recovery(&state)? {
        let discovered = discover_profiles_from_files();
        if !discovered.is_empty() {
            let merged = merge_profiles(&state.profiles, &discovered);
            if merged.len() > state.profiles.len() {
                state.profiles = merged;
                save_state_to_store(&state)?;
            }
        }
        let _ = write_data_key(LLM_PROFILES_FILE_RECOVERY_MARKER_KEY, Value::Bool(true));
    }

    Ok(state)
}

#[tauri::command]
fn save_llm_profiles_state(state: LlmProfilesState) -> Result<(), String> {
    save_state_to_store(&state)
}
