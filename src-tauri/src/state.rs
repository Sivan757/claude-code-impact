use std::sync::atomic::{AtomicBool, AtomicU32};

// Distill watch state
pub static DISTILL_WATCH_ENABLED: AtomicBool = AtomicBool::new(true);

// Claude Code install process PID (for cancellation)
pub static CC_INSTALL_PID: AtomicU32 = AtomicU32::new(0);
