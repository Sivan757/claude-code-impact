use tokio::process::Command;
use tokio::time::timeout;

const PLUGIN_TRANSLATION_SCRIPT: &str = include_str!("plugin_translate.mjs");
const DEFAULT_TRANSLATION_MODEL: &str = "claude-3-5-haiku-latest";
const PLUGIN_TRANSLATION_PACKAGE_JSON: &str = r#"{
  "name": "claudecodeimpact-plugin-translator",
  "private": true,
  "type": "module",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0"
  }
}
"#;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginTranslationTextInput {
    key: String,
    text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PluginTranslationTextOutput {
    key: String,
    text: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PluginTranslationResponse {
    model: Option<String>,
    translations: Vec<PluginTranslationTextOutput>,
}

fn ensure_translation_runtime_script() -> Result<PathBuf, String> {
    let runtime_dir = crate::infra::get_claudecodeimpact_dir().join("runtime");
    fs::create_dir_all(&runtime_dir).map_err(|e| format!("Failed to create runtime dir: {}", e))?;

    let package_json_path = runtime_dir.join("package.json");
    let should_write_package = fs::read_to_string(&package_json_path)
        .map(|existing| existing != PLUGIN_TRANSLATION_PACKAGE_JSON)
        .unwrap_or(true);
    if should_write_package {
        fs::write(&package_json_path, PLUGIN_TRANSLATION_PACKAGE_JSON)
            .map_err(|e| format!("Failed to write translation runtime package.json: {}", e))?;
    }

    let script_path = runtime_dir.join("plugin-translate.mjs");
    let should_write = fs::read_to_string(&script_path)
        .map(|existing| existing != PLUGIN_TRANSLATION_SCRIPT)
        .unwrap_or(true);

    if should_write {
        fs::write(&script_path, PLUGIN_TRANSLATION_SCRIPT)
            .map_err(|e| format!("Failed to write translation script: {}", e))?;
    }

    Ok(script_path)
}

async fn ensure_translation_sdk_installed(runtime_dir: &Path) -> Result<(), String> {
    let sdk_dir = runtime_dir
        .join("node_modules")
        .join("@anthropic-ai")
        .join("sdk");
    if sdk_dir.exists() {
        return Ok(());
    }

    let output = timeout(
        Duration::from_secs(120),
        Command::new("bun")
            .arg("install")
            .arg("--no-progress")
            .current_dir(runtime_dir)
            .output(),
    )
    .await
    .map_err(|_| "Timed out while installing translation runtime dependencies".to_string())?
    .map_err(|e| format!("Failed to install translation runtime dependencies: {}", e))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !stderr.is_empty() {
        return Err(stderr);
    }
    if !stdout.is_empty() {
        return Err(stdout);
    }
    Err("Failed to install translation runtime dependencies".to_string())
}

async fn ensure_bun_available() -> Result<(), String> {
    let output = timeout(
        Duration::from_secs(5),
        Command::new("bun").arg("--version").output(),
    )
    .await
    .map_err(|_| "Timed out while checking Bun runtime".to_string())?
    .map_err(|e| format!("Failed to run Bun: {}", e))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stderr.is_empty() {
        Err("Bun is not available in PATH".to_string())
    } else {
        Err(format!("Bun check failed: {}", stderr))
    }
}

fn build_translation_payload(
    target_language: String,
    texts: Vec<PluginTranslationTextInput>,
) -> Result<Value, String> {
    let language = target_language.trim();
    if language.is_empty() {
        return Err("targetLanguage cannot be empty".to_string());
    }

    let mut deduped: HashMap<String, String> = HashMap::new();
    for item in texts {
        let key = item.key.trim();
        let text = item.text.trim();
        if key.is_empty() || text.is_empty() {
            continue;
        }
        deduped.insert(key.to_string(), text.to_string());
    }

    if deduped.is_empty() {
        return Err("No translatable content provided".to_string());
    }

    let total_chars: usize = deduped.values().map(|v| v.chars().count()).sum();
    if total_chars > 80_000 {
        return Err("Translation content too large; please translate a smaller selection".to_string());
    }

    let mut entries: Vec<Value> = deduped
        .into_iter()
        .map(|(key, text)| serde_json::json!({ "key": key, "text": text }))
        .collect();
    entries.sort_by(|a, b| {
        let a_key = a.get("key").and_then(|v| v.as_str()).unwrap_or("");
        let b_key = b.get("key").and_then(|v| v.as_str()).unwrap_or("");
        a_key.cmp(b_key)
    });

    Ok(serde_json::json!({
        "targetLanguage": language,
        "texts": entries,
    }))
}

fn build_runtime_payload_path() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    crate::infra::get_claudecodeimpact_dir()
        .join("runtime")
        .join(format!("plugin-translate-{}.json", nonce))
}

fn load_anthropic_env_from_settings() -> (Option<String>, Option<String>) {
    let settings_path = crate::infra::resolve_settings_path(None);
    let content = match fs::read_to_string(settings_path) {
        Ok(content) => content,
        Err(_) => return (None, None),
    };
    let value: Value = match serde_json::from_str(&content) {
        Ok(value) => value,
        Err(_) => return (None, None),
    };
    let Some(env) = value.get("env").and_then(|v| v.as_object()) else {
        return (None, None);
    };

    let token = env
        .get("ANTHROPIC_AUTH_TOKEN")
        .and_then(|v| v.as_str())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());
    let base_url = env
        .get("ANTHROPIC_BASE_URL")
        .and_then(|v| v.as_str())
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());

    (token, base_url)
}

#[tauri::command]
async fn translate_plugin_texts(
    target_language: String,
    texts: Vec<PluginTranslationTextInput>,
) -> Result<PluginTranslationResponse, String> {
    ensure_bun_available().await?;
    let script_path = ensure_translation_runtime_script()?;
    let runtime_dir = script_path
        .parent()
        .ok_or("Invalid translation runtime path")?;
    ensure_translation_sdk_installed(runtime_dir).await?;
    let payload = build_translation_payload(target_language, texts)?;

    let input_path = build_runtime_payload_path();
    if let Some(parent) = input_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create runtime payload dir: {}", e))?;
    }
    let payload_content = serde_json::to_vec(&payload)
        .map_err(|e| format!("Failed to serialize translation payload: {}", e))?;
    fs::write(&input_path, payload_content)
        .map_err(|e| format!("Failed to write translation payload: {}", e))?;

    let mut command = Command::new("bun");
    command.arg(&script_path).arg(&input_path);
    command.current_dir(runtime_dir);
    let (settings_token, settings_base_url) = load_anthropic_env_from_settings();
    let process_token = std::env::var("ANTHROPIC_API_KEY")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .or_else(|| {
            std::env::var("ANTHROPIC_AUTH_TOKEN")
                .ok()
                .filter(|v| !v.trim().is_empty())
        });
    let process_base_url = std::env::var("ANTHROPIC_BASE_URL")
        .ok()
        .filter(|v| !v.trim().is_empty());
    let effective_token = process_token.or(settings_token);
    let effective_base_url = process_base_url.or(settings_base_url);
    if effective_token.is_none() {
        let _ = fs::remove_file(&input_path);
        return Err("Missing ANTHROPIC_AUTH_TOKEN; configure provider token before using translation".to_string());
    }

    if std::env::var("CLAUDE_TRANSLATION_MODEL").is_err() {
        command.env("CLAUDE_TRANSLATION_MODEL", DEFAULT_TRANSLATION_MODEL);
    }
    if let Some(value) = effective_token {
        command.env("ANTHROPIC_API_KEY", &value);
        command.env("ANTHROPIC_AUTH_TOKEN", value);
    }
    if let Some(value) = effective_base_url {
        command.env("ANTHROPIC_BASE_URL", value);
    }

    let output = timeout(Duration::from_secs(60), command.output())
        .await
        .map_err(|_| "Translation timed out".to_string())?
        .map_err(|e| format!("Failed to execute Bun translator: {}", e));

    let _ = fs::remove_file(&input_path);
    let output = output?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !stderr.is_empty() {
            return Err(stderr);
        }
        if !stdout.is_empty() {
            return Err(stdout);
        }
        return Err("Translation failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        return Err("Translator returned empty output".to_string());
    }

    serde_json::from_str::<PluginTranslationResponse>(&stdout)
        .map_err(|e| format!("Failed to parse translator output: {}. Output: {}", e, stdout))
}
