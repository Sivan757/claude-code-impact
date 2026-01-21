// ============================================================================

#[derive(Debug, Clone, serde::Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

/// Get file metadata (size, modified time)
#[tauri::command]
fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let metadata =
        fs::metadata(&file_path).map_err(|e| format!("Failed to get metadata: {}", e))?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());

    Ok(FileMetadata {
        size: metadata.len(),
        modified,
    })
}

#[derive(serde::Serialize)]
struct FileMetadata {
    size: u64,
    modified: Option<u64>,
}

/// Read file contents
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    if !file_path.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    fs::read_to_string(&file_path).map_err(|e| format!("Failed to read file: {}", e))
}

/// List directory contents (non-recursive, respects .gitignore patterns)
#[tauri::command]
fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let dir_path = PathBuf::from(&path);

    if !dir_path.exists() {
        return Err(format!("Directory does not exist: {}", path));
    }

    if !dir_path.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    // Common patterns to ignore
    let ignore_patterns = [
        ".git",
        "node_modules",
        ".DS_Store",
        "target",
        "dist",
        "build",
        ".next",
        ".nuxt",
        ".output",
        "__pycache__",
        ".pytest_cache",
        ".venv",
        "venv",
        ".idea",
        ".vscode",
        "*.pyc",
        ".turbo",
    ];

    let mut entries: Vec<DirEntry> = Vec::new();

    let read_dir =
        fs::read_dir(&dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip ignored patterns
        if ignore_patterns.iter().any(|p| {
            if p.starts_with("*.") {
                name.ends_with(&p[1..])
            } else {
                name == *p
            }
        }) {
            continue;
        }

        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

        entries.push(DirEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir,
        });
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

