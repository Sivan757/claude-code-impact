// ============================================================================

#[cfg(target_os = "macos")]
use objc::runtime::YES;

/// 激活应用并聚焦指定窗口 (macOS)
/// 使用 dispatch_after 确保在 window.show() 异步操作完成后再激活
#[cfg(target_os = "macos")]
fn activate_and_focus_window(window: &tauri::WebviewWindow) {
    use cocoa::appkit::NSApplicationActivationPolicy;
    use cocoa::base::id;
    use objc::*;

    // 获取 NSWindow 句柄
    let ns_window = match window.ns_window() {
        Ok(w) => w as usize, // 转为 usize 以便跨闭包传递
        Err(_) => return,
    };

    unsafe {
        let app = cocoa::appkit::NSApp();

        // 1. 确保应用是 Regular 类型（可以接收焦点）
        let _: () = msg_send![app, setActivationPolicy: NSApplicationActivationPolicy::NSApplicationActivationPolicyRegular];

        // 2. 激活应用（立即执行）
        let _: () = msg_send![app, activateIgnoringOtherApps: YES];

        // 3. 延迟执行窗口聚焦，等待 window.show() 完成
        // 使用 performSelector:withObject:afterDelay: 在主线程的 run loop 中延迟执行
        // 50ms 足够让 macOS 完成窗口显示动画
        let ns_win: id = ns_window as id;
        let nil_ptr: id = std::ptr::null_mut();

        let sel_make_key = sel!(makeKeyAndOrderFront:);
        let sel_order_front = sel!(orderFrontRegardless);
        let sel_make_main = sel!(makeMainWindow);

        // 延迟 50ms 后执行
        let delay: f64 = 0.05;
        let _: () =
            msg_send![ns_win, performSelector:sel_make_key withObject:nil_ptr afterDelay:delay];
        let _: () =
            msg_send![ns_win, performSelector:sel_order_front withObject:nil_ptr afterDelay:delay];
        let _: () =
            msg_send![ns_win, performSelector:sel_make_main withObject:nil_ptr afterDelay:delay];

        println!("[Claude Code Impact] Window activation scheduled (50ms delay)");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

            // Initialize PTY manager with app handle for event emission
            pty_manager::init(app.handle().clone());

            // Start watching distill directory for changes
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let distill_dir = get_distill_dir();
                if !distill_dir.exists() {
                    // Create directory if it doesn't exist so we can watch it
                    let _ = fs::create_dir_all(&distill_dir);
                }

                let (tx, rx) = channel();
                let mut watcher: RecommendedWatcher =
                    match notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
                        if let Ok(event) = res {
                            // Only trigger on create/modify/remove events
                            if event.kind.is_create()
                                || event.kind.is_modify()
                                || event.kind.is_remove()
                            {
                                let _ = tx.send(());
                            }
                        }
                    }) {
                        Ok(w) => w,
                        Err(_) => return,
                    };

                if watcher
                    .watch(&distill_dir, RecursiveMode::NonRecursive)
                    .is_err()
                {
                    return;
                }

                // Debounce: wait for events to settle before emitting
                loop {
                    if rx.recv().is_ok() {
                        // Drain any additional events that came in quickly
                        while rx.recv_timeout(Duration::from_millis(200)).is_ok() {}
                        // Only emit if watch is enabled
                        if DISTILL_WATCH_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
                            let _ = app_handle.emit("distill-changed", ());
                        }
                    }
                }
            });

            let settings = MenuItemBuilder::with_id("settings", "Settings...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?;

            let app_menu = SubmenuBuilder::new(app, "Claude Code Impact")
                .item(&PredefinedMenuItem::about(
                    app,
                    Some("About Claude Code Impact"),
                    None,
                )?)
                .separator()
                .item(&settings)
                .separator()
                .item(&PredefinedMenuItem::hide(
                    app,
                    Some("Hide Claude Code Impact"),
                )?)
                .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"))?)
                .item(&PredefinedMenuItem::show_all(app, Some("Show All"))?)
                .separator()
                .item(&PredefinedMenuItem::quit(
                    app,
                    Some("Quit Claude Code Impact"),
                )?)
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let toggle_main = MenuItemBuilder::with_id("toggle_main", "Toggle Main Window")
                .accelerator("CmdOrCtrl+1")
                .build(app)?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&toggle_main)
                .separator()
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            use tauri::WebviewUrl;
            use tauri::WebviewWindowBuilder;

            match event.id().as_ref() {
                "settings" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("menu-settings", ());
                    }
                }
                "toggle_main" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let visible = window.is_visible().unwrap_or(false);
                        let focused = window.is_focused().unwrap_or(false);
                        if visible && focused {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            #[cfg(target_os = "macos")]
                            activate_and_focus_window(&window);
                            #[cfg(not(target_os = "macos"))]
                            let _ = window.set_focus();
                        }
                    } else {
                        // Recreate main window
                        #[cfg(target_os = "macos")]
                        {
                            if let Ok(window) =
                                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                                    .title("Claude Code Impact")
                                    .inner_size(800.0, 600.0)
                                    .title_bar_style(tauri::TitleBarStyle::Overlay)
                                    .hidden_title(true)
                                    .traffic_light_position(tauri::Position::Logical(
                                        tauri::LogicalPosition::new(16.0, 28.0),
                                    ))
                                    .build()
                            {
                                let _ = window.show();
                                activate_and_focus_window(&window);
                            }
                        }
                        #[cfg(not(target_os = "macos"))]
                        if let Ok(window) =
                            WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                                .title("Claude Code Impact")
                                .inner_size(800.0, 600.0)
                                .build()
                        {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
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
            list_codex_commands,
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
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            {
                use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

                if let RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } = _event
                {
                    println!(
                        "[Claude Code Impact] Dock clicked! has_visible_windows: {}",
                        has_visible_windows
                    );

                    // 无论是否有"可见窗口"，都尝试打开主窗口
                    // 因为 float 窗口可能被计入 has_visible_windows
                    if let Some(window) = _app.get_webview_window("main") {
                        println!("[Claude Code Impact] Main window exists, showing...");
                        let _ = window.show();
                        activate_and_focus_window(&window);
                    } else {
                        println!("[Claude Code Impact] Main window gone, recreating...");
                        match WebviewWindowBuilder::new(_app, "main", WebviewUrl::default())
                            .title("Claude Code Impact")
                            .inner_size(800.0, 600.0)
                            .title_bar_style(tauri::TitleBarStyle::Overlay)
                            .hidden_title(true)
                            .traffic_light_position(tauri::Position::Logical(
                                tauri::LogicalPosition::new(16.0, 28.0),
                            ))
                            .build()
                        {
                            Ok(window) => {
                                println!("[Claude Code Impact] Window created successfully");
                                let _ = window.show();
                                activate_and_focus_window(&window);
                            }
                            Err(e) => {
                                println!("[Claude Code Impact] Failed to create window: {:?}", e);
                            }
                        }
                    }
                }
            }
        });
}
