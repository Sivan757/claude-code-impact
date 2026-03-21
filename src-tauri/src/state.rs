use std::sync::atomic::AtomicU32;

// Claude Code install process PID (for cancellation)
pub static CC_INSTALL_PID: AtomicU32 = AtomicU32::new(0);
