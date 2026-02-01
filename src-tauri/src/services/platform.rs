use std::path::{Path, PathBuf, MAIN_SEPARATOR};

pub(crate) fn platform_kind() -> &'static str {
    std::env::consts::OS
}

pub(crate) fn path_separator() -> char {
    MAIN_SEPARATOR
}

pub(crate) fn reveal_label() -> &'static str {
    match platform_kind() {
        "windows" => "Show in File Explorer",
        "linux" => "Show in File Manager",
        _ => "Reveal in Finder",
    }
}

pub(crate) fn resolve_user_path(path: &str) -> PathBuf {
    let trimmed = path.trim();
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

    if trimmed == "~" {
        return home;
    }

    if let Some(suffix) = trimmed.strip_prefix("~/").or_else(|| trimmed.strip_prefix("~\\")) {
        return home.join(suffix);
    }

    PathBuf::from(trimmed)
}

pub(crate) fn get_default_unix_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        let trimmed = shell.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    let candidates = ["/bin/zsh", "/bin/bash", "/bin/sh"];
    for candidate in candidates {
        if Path::new(candidate).exists() {
            return candidate.to_string();
        }
    }

    "/bin/sh".to_string()
}

