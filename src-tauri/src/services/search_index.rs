use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};

use jieba_rs::Jieba;
use serde::{Deserialize, Serialize};
use tantivy::collector::TopDocs;
use tantivy::query::QueryParser;
use tantivy::schema::{self, Value as TantivyValue, *};
use tantivy::tokenizer::{LowerCaser, TextAnalyzer, Token, TokenStream, Tokenizer};
use tantivy::{doc, Index, IndexWriter, ReloadPolicy};

use crate::infra::{get_claude_dir, get_command_stats_path};
use crate::services::claude_format::RawLine;
use crate::services::message_content::extract_content_with_meta;
use crate::services::project_paths::decode_project_path;

// Global jieba instance for Chinese tokenization
static JIEBA: LazyLock<Jieba> = LazyLock::new(|| Jieba::new());

// Custom tokenizer for Chinese + English mixed content
#[derive(Clone)]
struct JiebaTokenizer;

impl Tokenizer for JiebaTokenizer {
    type TokenStream<'a> = JiebaTokenStream;

    fn token_stream<'a>(&'a mut self, text: &'a str) -> Self::TokenStream<'a> {
        let words = JIEBA.cut(text, true);
        let mut tokens = Vec::new();
        let mut offset = 0;

        for word in words {
            let word_str = word.trim();
            if !word_str.is_empty() {
                let start = text[offset..]
                    .find(word)
                    .map(|i| offset + i)
                    .unwrap_or(offset);
                let end = start + word.len();
                tokens.push(Token {
                    offset_from: start,
                    offset_to: end,
                    position: tokens.len(),
                    text: word_str.to_string(),
                    position_length: 1,
                });
                offset = end;
            }
        }

        JiebaTokenStream { tokens, index: 0 }
    }
}

struct JiebaTokenStream {
    tokens: Vec<Token>,
    index: usize,
}

impl TokenStream for JiebaTokenStream {
    fn advance(&mut self) -> bool {
        if self.index < self.tokens.len() {
            self.index += 1;
            true
        } else {
            false
        }
    }

    fn token(&self) -> &Token {
        &self.tokens[self.index - 1]
    }

    fn token_mut(&mut self) -> &mut Token {
        &mut self.tokens[self.index - 1]
    }
}

// Global search index state
static SEARCH_INDEX: Mutex<Option<SearchIndex>> = Mutex::new(None);

struct SearchIndex {
    index: Index,
    schema: Schema,
}

fn get_index_dir() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("claudecodeimpact")
        .join("search-index")
}

const JIEBA_TOKENIZER_NAME: &str = "jieba";

fn create_schema() -> Schema {
    let mut schema_builder = Schema::builder();

    // Use custom jieba tokenizer for content fields to support Chinese
    let text_options = TextOptions::default()
        .set_indexing_options(
            TextFieldIndexing::default()
                .set_tokenizer(JIEBA_TOKENIZER_NAME)
                .set_index_option(schema::IndexRecordOption::WithFreqsAndPositions),
        )
        .set_stored();

    schema_builder.add_text_field("uuid", STRING | STORED);
    schema_builder.add_text_field("content", text_options.clone());
    schema_builder.add_text_field("role", STRING | STORED);
    schema_builder.add_text_field("project_id", STRING | STORED);
    schema_builder.add_text_field("project_path", STRING | STORED);
    schema_builder.add_text_field("session_id", STRING | STORED);
    schema_builder.add_text_field("session_summary", text_options);
    schema_builder.add_text_field("timestamp", STRING | STORED);
    schema_builder.build()
}

fn register_jieba_tokenizer(index: &Index) {
    let tokenizer = TextAnalyzer::builder(JiebaTokenizer)
        .filter(LowerCaser)
        .build();
    index.tokenizers().register(JIEBA_TOKENIZER_NAME, tokenizer);
}

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct SearchResult {
    pub uuid: String,
    pub content: String,
    pub role: String,
    pub project_id: String,
    pub project_path: String,
    pub session_id: String,
    pub session_summary: Option<String>,
    pub timestamp: String,
    pub score: f32,
}

pub(crate) fn build_search_index() -> Result<usize, String> {
    let index_dir = get_index_dir();

    // Remove old index if exists
    if index_dir.exists() {
        fs::remove_dir_all(&index_dir).map_err(|e| e.to_string())?;
    }
    fs::create_dir_all(&index_dir).map_err(|e| e.to_string())?;

    let schema = create_schema();
    let index = Index::create_in_dir(&index_dir, schema.clone()).map_err(|e| e.to_string())?;

    // Register jieba tokenizer for Chinese support
    register_jieba_tokenizer(&index);

    let mut index_writer: IndexWriter = index
        .writer(50_000_000) // 50MB heap
        .map_err(|e| e.to_string())?;

    let uuid_field = schema.get_field("uuid").unwrap();
    let content_field = schema.get_field("content").unwrap();
    let role_field = schema.get_field("role").unwrap();
    let project_id_field = schema.get_field("project_id").unwrap();
    let project_path_field = schema.get_field("project_path").unwrap();
    let session_id_field = schema.get_field("session_id").unwrap();
    let session_summary_field = schema.get_field("session_summary").unwrap();
    let timestamp_field = schema.get_field("timestamp").unwrap();

    let projects_dir = get_claude_dir().join("projects");
    let mut indexed_count = 0;

    // === Command stats collection ===
    let mut command_stats: HashMap<String, HashMap<String, usize>> = HashMap::new();
    let command_pattern = regex::Regex::new(r"<command-name>(/[^<]+)</command-name>")
        .map_err(|e| e.to_string())?;

    // Build alias -> canonical name mapping
    let mut alias_map: HashMap<String, String> = HashMap::new();
    let commands_dir = get_claude_dir().join("commands");

    fn scan_commands_for_aliases(
        dir: &std::path::Path,
        alias_map: &mut HashMap<String, String>,
        base_dir: &std::path::Path,
    ) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    scan_commands_for_aliases(&path, alias_map, base_dir);
                } else if path.extension().map_or(false, |e| e == "md") {
                    let rel_path = path.strip_prefix(base_dir).unwrap_or(&path);
                    let canonical = rel_path
                        .with_extension("")
                        .to_string_lossy()
                        .replace('/', ":")
                        .replace('\\', ":");

                    if let Ok(content) = fs::read_to_string(&path) {
                        if content.starts_with("---") {
                            if let Some(end) = content[3..].find("---") {
                                let fm = &content[3..3 + end];
                                for line in fm.lines() {
                                    if line.starts_with("aliases:") {
                                        let aliases_str =
                                            line.trim_start_matches("aliases:").trim();
                                        for alias in aliases_str.split(',') {
                                            let alias = alias
                                                .trim()
                                                .trim_matches('"')
                                                .trim_matches('\'')
                                                .trim_start_matches('/')
                                                .to_string();
                                            if !alias.is_empty() {
                                                alias_map.insert(alias, canonical.clone());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if commands_dir.exists() {
        scan_commands_for_aliases(&commands_dir, &mut alias_map, &commands_dir);
    }
    // === End command stats setup ===

    if !projects_dir.exists() {
        return Ok(0);
    }

    for project_entry in fs::read_dir(&projects_dir).map_err(|e| e.to_string())? {
        let project_entry = project_entry.map_err(|e| e.to_string())?;
        let project_path_buf = project_entry.path();

        if !project_path_buf.is_dir() {
            continue;
        }

        let project_id = project_path_buf.file_name().unwrap().to_string_lossy().to_string();
        let display_path = decode_project_path(&project_id);

        for entry in fs::read_dir(&project_path_buf).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = path.file_name().unwrap().to_string_lossy().to_string();

            if name.ends_with(".jsonl") && !name.starts_with("agent-") {
                let session_id = name.trim_end_matches(".jsonl").to_string();
                let file_content = fs::read_to_string(&path).unwrap_or_default();

                let mut session_summary: Option<String> = None;

                // First pass: get summary
                for line in file_content.lines() {
                    if let Ok(parsed) = serde_json::from_str::<RawLine>(line) {
                        if parsed.line_type.as_deref() == Some("summary") {
                            session_summary = parsed.summary;
                            break;
                        }
                    }
                }

                // Second pass: index messages + collect command stats
                for line in file_content.lines() {
                    if let Ok(parsed) = serde_json::from_str::<RawLine>(line) {
                        let line_type = parsed.line_type.as_deref();

                        if line_type == Some("user") || line_type == Some("assistant") {
                            if let Some(msg) = &parsed.message {
                                let role = msg.role.clone().unwrap_or_default();
                                let (text_content, _) = extract_content_with_meta(&msg.content);
                                let is_meta = parsed.is_meta.unwrap_or(false);

                                if !is_meta && !text_content.is_empty() {
                                    index_writer
                                        .add_document(doc!(
                                            uuid_field => parsed.uuid.clone().unwrap_or_default(),
                                            content_field => text_content,
                                            role_field => role,
                                            project_id_field => project_id.clone(),
                                            project_path_field => display_path.clone(),
                                            session_id_field => session_id.clone(),
                                            session_summary_field => session_summary.clone().unwrap_or_default(),
                                            timestamp_field => parsed.timestamp.clone().unwrap_or_default(),
                                        ))
                                        .map_err(|e| e.to_string())?;

                                    indexed_count += 1;
                                }
                            }
                        }

                        // Collect command stats from any line containing <command-name>
                        // Skip queue-operation entries (internal logs, not actual command invocations)
                        if line.contains("<command-name>")
                            && !line.contains("\"type\":\"queue-operation\"")
                        {
                            if let Some(ts_str) = &parsed.timestamp {
                                if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(ts_str) {
                                    let week_key = ts.format("%Y-W%V").to_string();
                                    for cap in command_pattern.captures_iter(line) {
                                        if let Some(cmd_match) = cap.get(1) {
                                            let raw_name =
                                                cmd_match.as_str().trim_start_matches('/').to_string();
                                            let name =
                                                alias_map.get(&raw_name).cloned().unwrap_or(raw_name);
                                            command_stats
                                                .entry(name)
                                                .or_default()
                                                .entry(week_key.clone())
                                                .and_modify(|c| *c += 1)
                                                .or_insert(1);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    index_writer.commit().map_err(|e| e.to_string())?;

    // Store search index in global state
    let mut guard = SEARCH_INDEX.lock().map_err(|e| e.to_string())?;
    *guard = Some(SearchIndex { index, schema });

    // Write command stats to file
    let stats_path = get_command_stats_path();
    if let Some(parent) = stats_path.parent() {
        fs::create_dir_all(parent).ok();
    }
    let stats_json = serde_json::json!({
        "updated_at": chrono::Utc::now().timestamp(),
        "commands": command_stats,
    });
    fs::write(
        &stats_path,
        serde_json::to_string_pretty(&stats_json).unwrap_or_default(),
    )
    .ok();

    Ok(indexed_count)
}

pub(crate) fn search_chats(
    query: String,
    limit: Option<usize>,
    project_id: Option<String>,
) -> Result<Vec<SearchResult>, String> {
    let max_results = limit.unwrap_or(50);

    // Try to get index from global state or load from disk
    let mut guard = SEARCH_INDEX.lock().map_err(|e| e.to_string())?;

    if guard.is_none() {
        let index_dir = get_index_dir();
        if !index_dir.exists() {
            return Err("Search index not built. Please build index first.".to_string());
        }

        let schema = create_schema();
        let index = Index::open_in_dir(&index_dir).map_err(|e| e.to_string())?;
        // Register jieba tokenizer for Chinese support
        register_jieba_tokenizer(&index);
        *guard = Some(SearchIndex { index, schema });
    }

    let search_index = guard.as_ref().unwrap();
    let reader = search_index
        .index
        .reader_builder()
        .reload_policy(ReloadPolicy::OnCommitWithDelay)
        .try_into()
        .map_err(|e: tantivy::TantivyError| e.to_string())?;

    let searcher = reader.searcher();

    let content_field = search_index.schema.get_field("content").unwrap();
    let session_summary_field = search_index.schema.get_field("session_summary").unwrap();

    let query_parser = QueryParser::for_index(
        &search_index.index,
        vec![content_field, session_summary_field],
    );
    let parsed_query = query_parser
        .parse_query(&query)
        .map_err(|e| e.to_string())?;

    let top_docs = searcher
        .search(&parsed_query, &TopDocs::with_limit(max_results))
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for (score, doc_address) in top_docs {
        let retrieved_doc: tantivy::TantivyDocument =
            searcher.doc(doc_address).map_err(|e| e.to_string())?;

        let get_text = |field_name: &str| -> String {
            let field = search_index.schema.get_field(field_name).unwrap();
            retrieved_doc
                .get_first(field)
                .and_then(|v| TantivyValue::as_str(&v))
                .unwrap_or("")
                .to_string()
        };

        let doc_project_id = get_text("project_id");

        // Filter by project_id if specified
        if let Some(ref filter_id) = project_id {
            if &doc_project_id != filter_id {
                continue;
            }
        }

        let summary = get_text("session_summary");

        results.push(SearchResult {
            uuid: get_text("uuid"),
            content: get_text("content"),
            role: get_text("role"),
            project_id: doc_project_id,
            project_path: get_text("project_path"),
            session_id: get_text("session_id"),
            session_summary: if summary.is_empty() { None } else { Some(summary) },
            timestamp: get_text("timestamp"),
            score,
        });
    }

    Ok(results)
}
