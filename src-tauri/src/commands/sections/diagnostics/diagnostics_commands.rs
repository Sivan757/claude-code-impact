// ============================================================================

#[tauri::command]
async fn diagnostics_detect_stack(
    project_path: String,
) -> Result<crate::diagnostics::TechStack, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::diagnostics::detect_tech_stack(&project_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn diagnostics_check_env(
    project_path: String,
) -> Result<crate::diagnostics::EnvCheckResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::diagnostics::check_env_vars(&project_path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn diagnostics_add_missing_keys(project_path: String, keys: Vec<String>) -> Result<usize, String> {
    crate::diagnostics::add_missing_keys_to_env(&project_path, keys)
}

#[tauri::command]
async fn diagnostics_scan_file_lines(
    project_path: String,
    limit: usize,
    ignored_paths: Vec<String>,
) -> Result<Vec<crate::diagnostics::FileLineCount>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::diagnostics::scan_file_lines(&project_path, limit, &ignored_paths)
    })
    .await
    .map_err(|e| e.to_string())?
}
