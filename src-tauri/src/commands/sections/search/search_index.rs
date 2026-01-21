// ============================================================================

use crate::services::search_index as search_index_service;

type SearchResult = search_index_service::SearchResult;

#[tauri::command]
async fn build_search_index() -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(search_index_service::build_search_index)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn search_chats(
    query: String,
    limit: Option<usize>,
    project_id: Option<String>,
) -> Result<Vec<SearchResult>, String> {
    search_index_service::search_chats(query, limit, project_id)
}
