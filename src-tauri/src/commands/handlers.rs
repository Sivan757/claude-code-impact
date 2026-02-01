use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::{Emitter, Manager};

use crate::infra::{
    ensure_parent_dir, get_claude_dir, get_claude_json_path,
    get_docs_distill_dir, get_docs_reference_dir, get_statusbar_dir, get_statusline_dir,
    load_custom_keys, load_disabled_env, load_disabled_hooks, read_data_key, remove_data_key,
    resolve_settings_path, save_custom_keys, save_disabled_env, save_disabled_hooks, write_data_key,
};
use crate::services::claude_format::{HistoryEntry, RawLine};
use crate::services::message_content::extract_content_with_meta;
use crate::services::project_paths::{decode_project_path, encode_project_path};
use crate::{hook_watcher, pty_manager};

include!("sections/settings/projects_sessions.rs");
include!("sections/search/search_index.rs");
include!("sections/commands/local_commands.rs");
include!("sections/agents/local_agents.rs");
include!("sections/plugins/marketplace/metadata.rs");
include!("sections/distill/distill.rs");
include!("sections/plugins/marketplace/catalog.rs");
include!("sections/plugins/marketplace/install.rs");
include!("sections/plugins/marketplace/statusline.rs");
include!("sections/context/context_files.rs");
include!("sections/activity/activity_stats.rs");
include!("sections/activity/annual_report.rs");
include!("sections/commands/command_stats.rs");
include!("sections/settings/settings_access.rs");
include!("sections/settings/settings_update.rs");
include!("sections/settings/llm_profiles.rs");
include!("sections/settings/ui_preferences.rs");
include!("sections/plugins/repository_scan.rs");
include!("sections/versions/claude_code_versions.rs");
include!("sections/pty/pty_commands.rs");

include!("sections/hooks/hook_commands.rs");
include!("sections/files/project_logo.rs");
include!("sections/files/filesystem.rs");
include!("sections/git/git_commands.rs");
include!("sections/diagnostics/diagnostics_commands.rs");
include!("sections/lsp/lsp_commands.rs");

pub fn build_invoke_handler(
) -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        list_projects,
        list_sessions,
        get_sessions_usage,
        list_all_sessions,
        list_all_chats,
        get_session_messages,
        build_search_index,
        search_chats,
        list_local_commands,
        list_local_agents,
        uninstall_agent,
        list_local_skills,
        install_skill_template,
        uninstall_skill,
        check_skill_installed,
        get_context_files,
        get_project_context,
        get_settings,
        create_launch_settings,
        get_command_stats,
        get_command_weekly_stats,
        get_activity_stats,
        get_annual_report_2025,
        get_templates_catalog,
        install_command_template,
        rename_command,
        deprecate_command,
        archive_command,
        restore_command,
        update_command_aliases,
        install_mcp_template,
        uninstall_mcp_template,
        check_mcp_installed,
        install_hook_template,
        install_setting_template,
        update_settings_statusline,
        remove_settings_statusline,
        write_statusline_script,
        install_statusline_template,
        apply_statusline,
        restore_previous_statusline,
        has_previous_statusline,
        execute_statusbar_script,
        get_statusbar_settings,
        save_statusbar_settings,
        write_claudecodeimpact_statusbar_script,
        remove_statusline_template,
        open_in_editor,
        open_file_at_line,
        open_session_in_editor,
        reveal_session_file,
        reveal_path,
        open_path,
        get_session_file_path,
        get_session_summary,
        resolve_user_path,
        get_platform_kind,
        get_reveal_label,
        get_path_separator,
        get_distill_command_path,
        get_docs_distill_dir_path,
        get_docs_reference_dir_path,
        get_docs_distill_file_path,
        copy_to_clipboard,
        get_settings_path,
        get_mcp_config_path,
        get_home_dir,
        get_env_var,
        get_today_coding_stats,
        write_file,
        write_binary_file,
        update_mcp_env,
        update_settings_env,
        delete_settings_env,
        disable_settings_env,
        enable_settings_env,
        update_disabled_settings_env,
        update_settings_field,
        update_settings_permission_field,
        add_permission_directory,
        remove_permission_directory,
        get_llm_profiles_state,
        save_llm_profiles_state,
        get_ui_preference,
        get_ui_preferences,
        set_ui_preference,
        remove_ui_preference,
        toggle_plugin,
        // Extensions management
        scan_plugins,
        list_installed_plugins,
        list_extension_marketplaces,
        fetch_marketplace_plugins,
        install_extension,
        uninstall_extension,
        install_plugin,
        uninstall_plugin,
        enable_plugin,
        disable_plugin,
        update_plugin,
        add_extension_marketplace,
        remove_extension_marketplace,
        update_extension_marketplace,
        remove_extension_marketplace_safe,
        toggle_hook_item,
        get_disabled_hooks,
        delete_hook_item,
        delete_disabled_hook,
        test_anthropic_connection,
        test_openai_connection,
        test_claude_cli,
        list_distill_documents,
        find_session_project,
        get_distill_watch_enabled,
        set_distill_watch_enabled,
        list_reference_sources,
        list_reference_docs,
        get_claude_code_version_info,
        get_claude_code_available_versions,
        install_claude_code_version,
        cancel_claude_code_install,
        // PTY commands
        pty_create,
        pty_write,
        pty_read,
        pty_resize,
        pty_kill,
        pty_list,
        pty_exists,
        pty_scrollback,
        pty_purge_scrollback,
        pty_flush_scrollback,
        // Hook watcher commands
        hook_start_monitoring,
        hook_stop_monitoring,
        hook_is_monitoring,
        // Project logo
        get_project_logo,
        list_project_logos,
        save_project_logo,
        copy_file_to_project_assets,
        set_current_project_logo,
        delete_project_logo,
        read_file_base64,
        exec_shell_command,
        hook_get_monitored,
        hook_notify_complete,
        // File system
        get_file_metadata,
        read_file,
        list_directory,
        // Git commands
        git_log,
        git_get_note,
        git_set_note,
        git_revert,
        git_has_changes,
        git_auto_commit,
        git_generate_changelog,
        // Diagnostics commands
        diagnostics_detect_stack,
        diagnostics_check_env,
        diagnostics_add_missing_keys,
        diagnostics_scan_file_lines,
        // LSP commands
        list_lsp_servers,
        get_lsp_config_path_cmd,
        add_lsp_server,
        remove_lsp_server,
        update_lsp_server_env
    ]
}
