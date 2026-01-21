// ============================================================================

#[tauri::command]
fn workspace_load() -> Result<workspace_store::WorkspaceData, String> {
    workspace_store::load_workspace()
}

#[tauri::command]
fn workspace_save(data: workspace_store::WorkspaceData) -> Result<(), String> {
    workspace_store::save_workspace(&data)
}

#[tauri::command]
fn workspace_add_project(path: String) -> Result<workspace_store::WorkspaceProject, String> {
    workspace_store::add_project(path)
}

#[tauri::command]
fn workspace_list_projects() -> Result<Vec<workspace_store::WorkspaceProject>, String> {
    workspace_store::load_workspace().map(|d| d.projects)
}

#[tauri::command]
fn workspace_remove_project(id: String) -> Result<(), String> {
    workspace_store::remove_project(&id)
}

#[tauri::command]
fn workspace_set_active_project(id: String) -> Result<(), String> {
    workspace_store::set_active_project(&id)
}

#[tauri::command]
fn workspace_create_feature(
    project_id: String,
    name: String,
    description: Option<String>,
) -> Result<workspace_store::Feature, String> {
    workspace_store::create_feature(&project_id, name, description)
}

#[tauri::command]
fn workspace_rename_feature(feature_id: String, name: String) -> Result<(), String> {
    workspace_store::rename_feature(&feature_id, name)
}

#[tauri::command]
fn workspace_update_feature_status(
    project_id: String,
    feature_id: String,
    status: workspace_store::FeatureStatus,
) -> Result<(), String> {
    workspace_store::update_feature_status(&project_id, &feature_id, status)
}

#[tauri::command]
fn workspace_delete_feature(project_id: String, feature_id: String) -> Result<(), String> {
    workspace_store::delete_feature(&project_id, &feature_id)
}

#[tauri::command]
fn workspace_set_active_feature(project_id: String, feature_id: String) -> Result<(), String> {
    workspace_store::set_active_feature(&project_id, &feature_id)
}

#[tauri::command]
fn workspace_add_panel(
    project_id: String,
    feature_id: String,
    panel: workspace_store::PanelState,
) -> Result<(), String> {
    workspace_store::add_panel_to_feature(&project_id, &feature_id, panel)
}

#[tauri::command]
fn workspace_remove_panel(
    project_id: String,
    feature_id: String,
    panel_id: String,
) -> Result<(), String> {
    workspace_store::remove_panel_from_feature(&project_id, &feature_id, &panel_id)
}

#[tauri::command]
fn workspace_toggle_panel_shared(project_id: String, panel_id: String) -> Result<bool, String> {
    workspace_store::toggle_panel_shared(&project_id, &panel_id)
}

#[tauri::command]
fn workspace_get_pending_reviews() -> Result<Vec<(String, String, String)>, String> {
    workspace_store::get_pending_reviews()
}

