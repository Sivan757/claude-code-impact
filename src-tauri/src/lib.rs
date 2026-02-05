mod diagnostics;
mod hook_watcher;
mod pty_manager;

pub mod app;
pub mod config;
pub mod domain;
pub mod state;

pub mod commands;
pub mod infra;
pub mod services;

pub use app::run;
pub use commands::*;
pub use config::*;
