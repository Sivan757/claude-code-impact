use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{Emitter, Manager};

use crate::infra::{
    get_claude_dir, get_claude_json_path, get_claudecodeimpact_dir, load_custom_keys,
    load_disabled_env, save_custom_keys, save_disabled_env,
};
use crate::services::claude_format::{HistoryEntry, RawLine};
use crate::services::message_content::extract_content_with_meta;
use crate::services::project_paths::{decode_project_path, encode_project_path};
use crate::{hook_watcher, pty_manager, workspace_store};

include!("sections/core/00_prelude.rs");
include!("sections/settings/projects_sessions.rs");
include!("sections/search/search_index.rs");
include!("sections/commands/local_commands.rs");
include!("sections/agents/local_agents.rs");
include!("sections/plugins/10_marketplace_metadata_stored_alongside_installed_components.rs");
include!("sections/codex/codex_commands.rs");
include!("sections/distill/distill.rs");
include!("sections/plugins/16_plugin_source_configuration.rs");
include!("sections/context/context_files.rs");
include!("sections/activity/activity_stats.rs");
include!("sections/activity/annual_report.rs");
include!("sections/commands/command_stats.rs");
include!("sections/settings/settings_access.rs");
include!("sections/settings/settings_update.rs");
include!("sections/plugins/30_plugin_repository_scan_models.rs");
include!("sections/versions/claude_code_versions.rs");
include!("sections/pty/pty_commands.rs");
include!("sections/workspace/workspace_commands.rs");
include!("sections/hooks/hook_commands.rs");
include!("sections/files/project_logo.rs");
include!("sections/files/filesystem.rs");
include!("sections/git/git_commands.rs");
include!("sections/diagnostics/diagnostics_commands.rs");
include!("sections/lsp/lsp_commands.rs");
include!("sections/macos/48_macos.rs");
