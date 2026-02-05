use crate::config::ConfigWatcher;
use std::sync::Mutex;

/// App state for config watcher
pub struct ConfigWatcherState {
    pub watcher: Mutex<Option<ConfigWatcher>>,
    pub project_path: Mutex<Option<String>>,
}

impl ConfigWatcherState {
    pub fn new() -> Self {
        Self {
            watcher: Mutex::new(None),
            project_path: Mutex::new(None),
        }
    }
}

impl Default for ConfigWatcherState {
    fn default() -> Self {
        Self::new()
    }
}
