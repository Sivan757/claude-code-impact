// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ReferenceSource {
    pub name: String,
    pub path: String,
    pub doc_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReferenceDoc {
    pub name: String,
    pub path: String,
    pub group: Option<String>,
}

fn scan_reference_dir(dir: &Path) -> Vec<ReferenceSource> {
    if !dir.exists() {
        return vec![];
    }

    let mut sources = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Ok(metadata) = fs::metadata(&path) {
                if metadata.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let doc_count = fs::read_dir(&path)
                        .map(|entries| {
                            entries
                                .filter(|e| {
                                    e.as_ref()
                                        .ok()
                                        .map(|e| {
                                            e.path()
                                                .extension()
                                                .map(|ext| ext == "md")
                                                .unwrap_or(false)
                                        })
                                        .unwrap_or(false)
                                })
                                .count()
                        })
                        .unwrap_or(0);

                    sources.push(ReferenceSource {
                        name,
                        path: path.to_string_lossy().to_string(),
                        doc_count,
                    });
                }
            }
        }
    }

    sources
}

fn get_bundled_reference_dirs(app_handle: &tauri::AppHandle) -> Vec<(String, PathBuf)> {
    let bundled_docs = [
        ("claude-code", "third-parties/claude-code-docs/docs"),
        ("codex", "third-parties/codex/docs"),
    ];

    let mut result = Vec::new();

    if let Ok(resource_path) = app_handle.path().resource_dir() {
        for (name, rel_path) in &bundled_docs {
            let path = resource_path.join(rel_path);
            if path.exists() {
                result.push((name.to_string(), path));
            }
        }
    }

    if result.is_empty() {
        let candidates = [
            std::env::current_dir().ok(),
            std::env::current_dir()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf())),
        ];

        for candidate in candidates.into_iter().flatten() {
            for (name, rel_path) in &bundled_docs {
                let path = candidate.join(rel_path);
                if path.exists() && !result.iter().any(|(n, _)| n == *name) {
                    result.push((name.to_string(), path));
                }
            }
        }
    }

    result
}

#[tauri::command]
fn list_reference_sources(app_handle: tauri::AppHandle) -> Result<Vec<ReferenceSource>, String> {
    let mut sources = Vec::new();
    let mut seen_names = std::collections::HashSet::new();

    let ref_dir = get_docs_reference_dir();
    for source in scan_reference_dir(&ref_dir) {
        seen_names.insert(source.name.clone());
        sources.push(source);
    }

    for (name, path) in get_bundled_reference_dirs(&app_handle) {
        if !seen_names.contains(&name) {
            let doc_count = fs::read_dir(&path)
                .map(|entries| {
                    entries
                        .filter(|e| {
                            e.as_ref()
                                .ok()
                                .map(|e| {
                                    e.path().extension().map(|ext| ext == "md").unwrap_or(false)
                                })
                                .unwrap_or(false)
                        })
                        .count()
                })
                .unwrap_or(0);

            sources.push(ReferenceSource {
                name,
                path: path.to_string_lossy().to_string(),
                doc_count,
            });
        }
    }

    sources.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(sources)
}

fn find_reference_source_dir(app_handle: &tauri::AppHandle, source: &str) -> Option<PathBuf> {
    let user_dir = get_docs_reference_dir().join(source);
    if user_dir.exists() {
        return Some(user_dir);
    }

    for (name, path) in get_bundled_reference_dirs(app_handle) {
        if name == source {
            return Some(path);
        }
    }

    None
}

#[tauri::command]
fn list_reference_docs(
    app_handle: tauri::AppHandle,
    source: String,
) -> Result<Vec<ReferenceDoc>, String> {
    let source_dir = match find_reference_source_dir(&app_handle, &source) {
        Some(dir) => dir,
        None => return Ok(vec![]),
    };

    let order_file = source_dir.join("_order.txt");
    let mut order_map: HashMap<String, (usize, Option<String>)> = HashMap::new();

    if order_file.exists() {
        if let Ok(content) = fs::read_to_string(&order_file) {
            let mut current_group: Option<String> = None;
            let mut order_idx = 0;

            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if trimmed.starts_with('#') {
                    let group_name = trimmed.trim_start_matches('#').trim();
                    if !group_name.is_empty() {
                        current_group = Some(group_name.to_string());
                    }
                } else {
                    order_map.insert(trimmed.to_string(), (order_idx, current_group.clone()));
                    order_idx += 1;
                }
            }
        }
    }

    let mut docs = Vec::new();
    for entry in fs::read_dir(&source_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().map(|e| e == "md").unwrap_or(false) {
            let name = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            let group = order_map.get(&name).and_then(|(_, g)| g.clone());

            docs.push(ReferenceDoc {
                name,
                path: path.to_string_lossy().to_string(),
                group,
            });
        }
    }

    if !order_map.is_empty() {
        docs.sort_by(|a, b| {
            let a_idx = order_map
                .get(&a.name)
                .map(|(i, _)| *i)
                .unwrap_or(usize::MAX);
            let b_idx = order_map
                .get(&b.name)
                .map(|(i, _)| *i)
                .unwrap_or(usize::MAX);
            a_idx.cmp(&b_idx)
        });
    } else {
        docs.sort_by(|a, b| a.name.cmp(&b.name));
    }

    Ok(docs)
}
