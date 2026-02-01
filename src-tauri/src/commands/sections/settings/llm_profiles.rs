const LLM_PROFILES_STATE_KEY: &str = "settings.llm_profiles_state";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
struct LlmProfile {
    id: String,
    name: String,
    auth_token: String,
    base_url: String,
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

#[tauri::command]
fn get_llm_profiles_state() -> Result<LlmProfilesState, String> {
    if let Some(value) = read_data_key(LLM_PROFILES_STATE_KEY)? {
        let state: LlmProfilesState = serde_json::from_value(value).unwrap_or_default();
        return Ok(state);
    }
    Ok(LlmProfilesState::default())
}

#[tauri::command]
fn save_llm_profiles_state(state: LlmProfilesState) -> Result<(), String> {
    let value: Value = serde_json::to_value(state).map_err(|e| e.to_string())?;
    write_data_key(LLM_PROFILES_STATE_KEY, value)
}
