use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub(crate) struct RawLine {
    #[serde(rename = "type")]
    pub(crate) line_type: Option<String>,
    pub(crate) summary: Option<String>,
    pub(crate) uuid: Option<String>,
    pub(crate) message: Option<RawMessage>,
    pub(crate) timestamp: Option<String>,
    #[serde(rename = "isMeta")]
    pub(crate) is_meta: Option<bool>,
}

#[derive(Debug, Deserialize, Default)]
pub(crate) struct RawUsage {
    pub(crate) input_tokens: Option<u64>,
    pub(crate) output_tokens: Option<u64>,
    pub(crate) cache_creation_input_tokens: Option<u64>,
    pub(crate) cache_read_input_tokens: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct RawMessage {
    pub(crate) role: Option<String>,
    pub(crate) content: Option<serde_json::Value>,
    pub(crate) usage: Option<RawUsage>,
}

/// Entry from history.jsonl - used as fast session index.
#[derive(Debug, Deserialize)]
pub(crate) struct HistoryEntry {
    pub(crate) display: Option<String>,
    pub(crate) timestamp: Option<u64>,
    pub(crate) project: Option<String>,
    #[serde(rename = "sessionId")]
    pub(crate) session_id: Option<String>,
}
