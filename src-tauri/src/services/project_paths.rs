use std::path::{Component, Path, PathBuf, MAIN_SEPARATOR};

/// Encode project path to project ID (inverse of decode_project_path).
/// Claude Code encodes: `{sep}.` -> `--`, then `{sep}` -> `-`.
/// On Windows, the root separator after a drive prefix is also encoded:
/// `D:\project` -> `D:--project`.
pub(crate) fn encode_project_path(path: &str) -> String {
    let path = Path::new(path);
    let mut parts: Vec<String> = Vec::new();
    let mut has_prefix = false;
    let mut has_root = false;

    for component in path.components() {
        match component {
            Component::Prefix(prefix) => {
                has_prefix = true;
                parts.push(prefix.as_os_str().to_string_lossy().to_string());
            }
            Component::RootDir => {
                has_root = true;
                parts.push(String::new());
            }
            Component::CurDir => {}
            Component::ParentDir => parts.push("..".to_string()),
            Component::Normal(os_str) => {
                let segment = os_str.to_string_lossy();
                if segment.starts_with('.') && (has_root || has_prefix || !parts.is_empty()) {
                    let trimmed = segment.trim_start_matches('.');
                    if trimmed.is_empty() {
                        parts.push(String::new());
                    } else {
                        parts.push(String::new());
                        parts.push(trimmed.to_string());
                    }
                } else {
                    parts.push(segment.to_string());
                }
            }
        }
    }

    parts.join("-")
}

/// Decode project ID to actual filesystem path.
/// Claude Code encodes: `/` -> `-`, and `.` -> `-`
/// So `/.` becomes `--`, but `-` in directory names is NOT escaped
pub(crate) fn decode_project_path(id: &str) -> String {
    let (prefix, has_root, segments) = parse_encoded_segments(id);
    let base_path = build_path(prefix.as_deref(), has_root, &segments);

    if base_path.exists() {
        return base_path.to_string_lossy().to_string();
    }

    // Fallback for ambiguous IDs where hyphens inside directory names were
    // flattened into `-` together with path separators (e.g., apex-plugins).
    if let Some(resolved) = try_resolve_existing_path(prefix.as_deref(), has_root, &segments) {
        return resolved.to_string_lossy().to_string();
    }

    base_path.to_string_lossy().to_string()
}

fn parse_encoded_segments(id: &str) -> (Option<String>, bool, Vec<String>) {
    let parts: Vec<&str> = id.split('-').collect();
    if parts.is_empty() {
        return (None, false, vec![]);
    }

    let mut index = 0;
    let mut prefix: Option<String> = None;
    let mut has_root = false;

    if let Some(first) = parts.first() {
        if !first.is_empty() && first.contains(':') {
            prefix = Some((*first).to_string());
            index = 1;
        }
    }

    if index < parts.len() && parts[index].is_empty() {
        has_root = true;
        index += 1;
    }

    let mut segments = Vec::new();
    while index < parts.len() {
        let part = parts[index];
        if part.is_empty() {
            if index + 1 < parts.len() {
                segments.push(format!(".{}", parts[index + 1]));
                index += 2;
                continue;
            }
            break;
        }
        segments.push(part.to_string());
        index += 1;
    }

    (prefix, has_root, segments)
}

fn build_path(prefix: Option<&str>, has_root: bool, segments: &[String]) -> PathBuf {
    let mut path = PathBuf::new();

    if let Some(prefix_str) = prefix {
        #[cfg(windows)]
        {
            let mut root = String::from(prefix_str);
            root.push(MAIN_SEPARATOR);
            path.push(root);
        }
        #[cfg(not(windows))]
        {
            path.push(prefix_str);
            if has_root {
                path.push(MAIN_SEPARATOR.to_string());
            }
        }
    } else if has_root {
        path.push(MAIN_SEPARATOR.to_string());
    }

    for segment in segments {
        path.push(segment);
    }

    path
}

fn try_resolve_existing_path(
    prefix: Option<&str>,
    has_root: bool,
    segments: &[String],
) -> Option<PathBuf> {
    if segments.is_empty() {
        let candidate = build_path(prefix, has_root, &[]);
        return candidate.exists().then_some(candidate);
    }

    let mut finalized = Vec::new();
    resolve_path_by_backtracking(
        prefix,
        has_root,
        segments,
        1,
        &mut finalized,
        segments[0].clone(),
    )
}

fn resolve_path_by_backtracking(
    prefix: Option<&str>,
    has_root: bool,
    segments: &[String],
    index: usize,
    finalized: &mut Vec<String>,
    current: String,
) -> Option<PathBuf> {
    if index >= segments.len() {
        let mut all_segments = finalized.clone();
        all_segments.push(current);
        let candidate = build_path(prefix, has_root, &all_segments);
        return candidate.exists().then_some(candidate);
    }

    let token = &segments[index];

    // Option 1: `-` belongs to the same path segment.
    let merged_current = format!("{}-{}", current, token);
    if let Some(path) = resolve_path_by_backtracking(
        prefix,
        has_root,
        segments,
        index + 1,
        finalized,
        merged_current,
    ) {
        return Some(path);
    }

    // Option 2: `-` is a path separator; only continue if the prefix exists.
    finalized.push(current);
    let prefix_path = build_path(prefix, has_root, finalized);
    if prefix_path.exists() {
        if let Some(path) = resolve_path_by_backtracking(
            prefix,
            has_root,
            segments,
            index + 1,
            finalized,
            token.clone(),
        ) {
            finalized.pop();
            return Some(path);
        }
    }
    finalized.pop();

    None
}

#[cfg(test)]
mod tests {
    use super::{decode_project_path, encode_project_path, parse_encoded_segments};
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn decode_preserves_hyphenated_segment_when_path_exists() {
        let root = TempDir::new().expect("temp dir");
        let project_path = root.path().join("workspace").join("apex-plugins");
        fs::create_dir_all(&project_path).expect("create project path");

        let encoded = encode_project_path(project_path.to_string_lossy().as_ref());
        let decoded = decode_project_path(&encoded);

        assert_eq!(decoded, project_path.to_string_lossy());
    }

    #[test]
    fn parse_prefixed_ids_preserve_drive_root_marker() {
        let (prefix, has_root, segments) = parse_encoded_segments("D:--project-eda-design-data");

        assert_eq!(prefix.as_deref(), Some("D:"));
        assert!(has_root);
        assert_eq!(segments, vec!["project", "eda", "design", "data"]);
    }

    #[test]
    fn parse_prefixed_ids_keep_hidden_segments_after_drive_root() {
        let (prefix, has_root, segments) = parse_encoded_segments("D:---claude-projects");

        assert_eq!(prefix.as_deref(), Some("D:"));
        assert!(has_root);
        assert_eq!(segments, vec![".claude", "projects"]);
    }
}
