use std::path::{Component, Path, PathBuf, MAIN_SEPARATOR};

/// Encode project path to project ID (inverse of decode_project_path).
/// Claude Code encodes: `{sep}.` -> `--`, then `{sep}` -> `-`
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
                if !has_prefix {
                    parts.push(String::new());
                }
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

    // Otherwise, the project name likely contains hyphens
    // Try progressively merging path segments after common base directories
    let base_dirs = ["projects", "repos", "Documents", "Desktop"];
    if let Some(idx) = segments
        .iter()
        .position(|segment| base_dirs.contains(&segment.as_str()))
    {
        let prefix_segments = &segments[..=idx];
        let rest_segments = &segments[idx + 1..];
        if let Some(merged) =
            try_merge_segments(prefix.as_deref(), has_root, prefix_segments, rest_segments)
        {
            return merged;
        }
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

    if prefix.is_none() && index < parts.len() && parts[index].is_empty() {
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

/// Try different combinations of merging path segments with hyphens
fn try_merge_segments(
    prefix: Option<&str>,
    has_root: bool,
    prefix_segments: &[String],
    rest_segments: &[String],
) -> Option<String> {
    if rest_segments.is_empty() {
        return None;
    }

    // Try merging all segments into one (most common: project-name-here)
    let mut merged_segments = prefix_segments.to_vec();
    merged_segments.push(rest_segments.join("-"));
    let all_merged = build_path(prefix, has_root, &merged_segments);
    if all_merged.exists() {
        return Some(all_merged.to_string_lossy().to_string());
    }

    // Try merging first N segments, leaving rest as subdirs
    for merge_count in (1..rest_segments.len()).rev() {
        let merged_part = rest_segments[..=merge_count].join("-");
        let mut candidate_segments = prefix_segments.to_vec();
        candidate_segments.push(merged_part);
        candidate_segments.extend(rest_segments[merge_count + 1..].iter().cloned());
        let candidate = build_path(prefix, has_root, &candidate_segments);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }

    None
}
