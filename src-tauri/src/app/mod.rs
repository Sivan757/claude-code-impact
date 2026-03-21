// ============================================================================

use tauri::{Emitter, Manager};

use crate::commands;
use crate::pty_manager;

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
        .manage(crate::config::ConfigWatcherState::new())
        .setup(|app| {
            use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

            // Initialize PTY manager with app handle for event emission
            pty_manager::init(app.handle().clone());

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
        .invoke_handler(commands::build_invoke_handler())
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
