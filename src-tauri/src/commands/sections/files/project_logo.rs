// ============================================================================

/// Find project logo from common locations and return as base64 data URL
#[tauri::command]
fn get_project_logo(project_path: String) -> Option<String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let logo_paths = [
        "assets/logo.svg",
        "assets/logo.png",
        "assets/icon.svg",
        "assets/icon.png",
        "public/logo.svg",
        "public/logo.png",
        "logo.svg",
        "logo.png",
        "icon.svg",
        "icon.png",
    ];

    let project = PathBuf::from(&project_path);

    for rel_path in logo_paths {
        let full_path = project.join(rel_path);
        if full_path.exists() {
            if let Ok(data) = fs::read(&full_path) {
                let mime = if rel_path.ends_with(".svg") {
                    "image/svg+xml"
                } else if rel_path.ends_with(".png") {
                    "image/png"
                } else {
                    "application/octet-stream"
                };
                let b64 = STANDARD.encode(&data);
                return Some(format!("data:{};base64,{}", mime, b64));
            }
        }
    }

    None
}

/// List all logo versions in project assets directory
#[tauri::command]
fn list_project_logos(project_path: String) -> Vec<LogoVersion> {
    let project = PathBuf::from(&project_path);
    let assets_dir = project.join("assets");

    let mut versions = Vec::new();

    // Get current logo path for comparison
    let current_logo = get_current_logo_path(&project);

    // Scan assets directory for logo files
    if let Ok(entries) = fs::read_dir(&assets_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                // Match logo-*.png, logo.png, logo.svg patterns
                if (filename.starts_with("logo") || filename.starts_with("icon"))
                    && (filename.ends_with(".png")
                        || filename.ends_with(".svg")
                        || filename.ends_with(".jpg"))
                {
                    let created_at = entry
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    let path_str = path.to_string_lossy().to_string();
                    let is_current = current_logo
                        .as_ref()
                        .map(|c| c == &path_str)
                        .unwrap_or(false);

                    versions.push(LogoVersion {
                        path: path_str,
                        filename: filename.to_string(),
                        created_at,
                        is_current,
                    });
                }
            }
        }
    }

    // Sort by created_at descending (newest first)
    versions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    versions
}

#[derive(Debug, Clone, serde::Serialize)]
struct LogoVersion {
    path: String,
    filename: String,
    created_at: u64,
    is_current: bool,
}

/// Helper to get current logo path
fn get_current_logo_path(project: &PathBuf) -> Option<String> {
    let logo_paths = [
        "assets/logo.svg",
        "assets/logo.png",
        "assets/icon.svg",
        "assets/icon.png",
    ];

    for rel_path in logo_paths {
        let full_path = project.join(rel_path);
        if full_path.exists() {
            return Some(full_path.to_string_lossy().to_string());
        }
    }
    None
}

/// Save base64 logo data to project assets
#[tauri::command]
fn save_project_logo(
    project_path: String,
    base64_data: String,
    filename: String,
) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let project = PathBuf::from(&project_path);
    let assets_dir = project.join("assets");

    // Ensure assets directory exists
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;

    // Decode base64
    let data = STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    // Save versioned file
    let versioned_path = assets_dir.join(&filename);
    fs::write(&versioned_path, &data).map_err(|e| format!("Failed to write logo: {}", e))?;

    // Also save as logo.png (current)
    let ext = filename.rsplit('.').next().unwrap_or("png");
    let current_path = assets_dir.join(format!("logo.{}", ext));
    fs::write(&current_path, &data).map_err(|e| format!("Failed to write current logo: {}", e))?;

    Ok(versioned_path.to_string_lossy().to_string())
}

/// Copy external file to project assets as logo
#[tauri::command]
fn copy_file_to_project_assets(
    source_path: String,
    project_path: String,
    target_filename: String,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    let project = PathBuf::from(&project_path);
    let assets_dir = project.join("assets");

    // Ensure assets directory exists
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("Failed to create assets directory: {}", e))?;

    // Copy to target filename
    let target_path = assets_dir.join(&target_filename);
    fs::copy(&source, &target_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

/// Set a specific logo version as current
#[tauri::command]
fn set_current_project_logo(project_path: String, logo_path: String) -> Result<(), String> {
    let project = PathBuf::from(&project_path);
    let assets_dir = project.join("assets");
    let source = PathBuf::from(&logo_path);

    if !source.exists() {
        return Err("Logo file does not exist".to_string());
    }

    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");

    // Copy as current logo
    let current_path = assets_dir.join(format!("logo.{}", ext));
    fs::copy(&source, &current_path).map_err(|e| format!("Failed to set current logo: {}", e))?;

    Ok(())
}

/// Delete a logo version
#[tauri::command]
fn delete_project_logo(_project_path: String, logo_path: String) -> Result<(), String> {
    let path = PathBuf::from(&logo_path);

    if !path.exists() {
        return Ok(());
    }

    // Don't allow deleting the current logo (logo.png/logo.svg)
    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
        if filename == "logo.png" || filename == "logo.svg" {
            return Err(
                "Cannot delete current logo. Set another version as current first.".to_string(),
            );
        }
    }

    fs::remove_file(&path).map_err(|e| format!("Failed to delete logo: {}", e))?;

    Ok(())
}

/// Read file as base64
#[tauri::command]
fn read_file_base64(path: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let data = fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(STANDARD.encode(&data))
}

/// Run a shell command in specified directory using login shell (async, non-blocking)
#[tauri::command]
async fn exec_shell_command(command: String, cwd: String) -> Result<String, String> {
    crate::infra::exec_shell_command(command, cwd).await
}
