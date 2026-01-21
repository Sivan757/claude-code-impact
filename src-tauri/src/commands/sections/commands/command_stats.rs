// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandStats {
    pub name: String,
    pub count: usize,
}

#[tauri::command]
async fn get_command_stats() -> Result<HashMap<String, usize>, String> {
    tauri::async_runtime::spawn_blocking(crate::services::command_stats::get_command_stats)
        .await
        .map_err(|e| e.to_string())?
}

/// Returns command usage counts grouped by week (from pre-built index)
/// Format: { "command_name": { "2024-W01": count, "2024-W02": count, ... } }
#[tauri::command]
fn get_command_weekly_stats(
    _weeks: Option<usize>,
) -> Result<HashMap<String, HashMap<String, usize>>, String> {
    crate::services::command_stats::get_command_weekly_stats(_weeks)
}
