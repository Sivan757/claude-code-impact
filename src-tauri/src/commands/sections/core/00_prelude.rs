// Distill watch state
pub(super) static DISTILL_WATCH_ENABLED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(true);

// Claude Code install process PID (for cancellation)
pub(super) static CC_INSTALL_PID: std::sync::atomic::AtomicU32 =
    std::sync::atomic::AtomicU32::new(0);

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub path: String,
    pub session_count: usize,
    pub last_active: u64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct SessionUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_read_tokens: u64,
    pub cost_usd: f64, // estimated cost in USD
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub project_id: String,
    pub project_path: Option<String>,
    pub summary: Option<String>,
    pub message_count: usize,
    pub last_modified: u64,
    pub usage: Option<SessionUsage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Message {
    pub uuid: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub is_meta: bool, // slash command 展开的内容
    pub is_tool: bool, // tool_use 或 tool_result
    pub line_number: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub uuid: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
    pub project_id: String,
    pub project_path: String,
    pub session_id: String,
    pub session_summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatsResponse {
    pub items: Vec<ChatMessage>,
    pub total: usize,
}
