use std::path::PathBuf;

/// Encode project path to project ID (inverse of decode_project_path).
/// Claude Code encodes: `/.` -> `--`, then `/` -> `-`
pub(crate) fn encode_project_path(path: &str) -> String {
    path.replace("/.", "--").replace("/", "-")
}

/// Decode project ID to actual filesystem path.
/// Claude Code encodes: `/` -> `-`, and `.` -> `-`
/// So `/.` becomes `--`, but `-` in directory names is NOT escaped
pub(crate) fn decode_project_path(id: &str) -> String {
    // First, handle `--` which means `/.` (hidden directories like .claude)
    // Replace `--` with a placeholder, then `-` with `/`, then restore `/.`
    let base = id
        .replace("--", "\x00")
        .replace("-", "/")
        .replace("\x00", "/.");

    // If the base path exists, we're done
    if PathBuf::from(&base).exists() {
        return base;
    }

    // Otherwise, the project name likely contains hyphens
    // Try progressively merging path segments after common base directories
    for base_dir in &["/projects/", "/repos/", "/Documents/", "/Desktop/"] {
        if let Some(idx) = base.find(base_dir) {
            let prefix = &base[..idx + base_dir.len()];
            let rest = &base[idx + base_dir.len()..];

            // Try merging segments: /a/b/c -> a-b-c, a-b/c, a/b-c, etc.
            if let Some(merged) = try_merge_segments(prefix, rest) {
                return merged;
            }
        }
    }

    // Fallback to base interpretation
    base
}

/// Try different combinations of merging path segments with hyphens
fn try_merge_segments(prefix: &str, rest: &str) -> Option<String> {
    let segments: Vec<&str> = rest.split('/').filter(|s| !s.is_empty()).collect();
    if segments.is_empty() {
        return None;
    }

    // Try merging all segments into one (most common: project-name-here)
    let all_merged = format!("{}{}", prefix, segments.join("-"));
    if PathBuf::from(&all_merged).exists() {
        return Some(all_merged);
    }

    // Try merging first N segments, leaving rest as subdirs
    for merge_count in (1..segments.len()).rev() {
        let merged_part = segments[..=merge_count].join("-");
        let rest_part = segments[merge_count + 1..].join("/");
        let candidate = if rest_part.is_empty() {
            format!("{}{}", prefix, merged_part)
        } else {
            format!("{}{}/{}", prefix, merged_part, rest_part)
        };
        if PathBuf::from(&candidate).exists() {
            return Some(candidate);
        }
    }

    None
}
