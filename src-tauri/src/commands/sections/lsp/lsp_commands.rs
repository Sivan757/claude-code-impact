#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LspServer {
    pub name: String,
    pub description: Option<String>,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub languages: Vec<String>,
}

#[tauri::command]
fn list_lsp_servers() -> Result<Vec<LspServer>, String> {
    let json_path = get_claude_json_path();
    let mut servers = Vec::new();

    if json_path.exists() {
        let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
        let json: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

        if let Some(lsp_map) = json.get("lspServers").and_then(|v| v.as_object()) {
            for (name, config) in lsp_map {
                let description = config
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let command = config
                    .get("command")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let args = config
                    .get("args")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();
                let env = config
                    .get("env")
                    .and_then(|v| v.as_object())
                    .map(|m| {
                        m.iter()
                            .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                            .collect()
                    })
                    .unwrap_or_default();
                let languages = config
                    .get("languages")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .unwrap_or_default();

                servers.push(LspServer {
                    name: name.clone(),
                    description,
                    command,
                    args,
                    env,
                    languages,
                });
            }
        }
    }

    Ok(servers)
}

#[tauri::command]
fn get_lsp_config_path_cmd() -> String {
    get_claude_json_path().to_string_lossy().to_string()
}

#[tauri::command]
fn add_lsp_server(server: LspServer) -> Result<(), String> {
    let json_path = get_claude_json_path();
    let mut json: Value = if json_path.exists() {
        let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    if !json.get("lspServers").and_then(|v| v.as_object()).is_some() {
        json["lspServers"] = serde_json::json!({});
    }

    let mut config = serde_json::Map::new();
    config.insert("command".to_string(), Value::String(server.command));
    config.insert(
        "args".to_string(),
        Value::Array(server.args.into_iter().map(Value::String).collect()),
    );

    let mut env_map = serde_json::Map::new();
    for (k, v) in server.env {
        env_map.insert(k, Value::String(v));
    }
    config.insert("env".to_string(), Value::Object(env_map));

    if let Some(desc) = server.description {
        config.insert("description".to_string(), Value::String(desc));
    }
    config.insert(
        "languages".to_string(),
        Value::Array(server.languages.into_iter().map(Value::String).collect()),
    );

    json["lspServers"][&server.name] = Value::Object(config);

    let output = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
    fs::write(&json_path, output).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn remove_lsp_server(name: String) -> Result<(), String> {
    let json_path = get_claude_json_path();
    if !json_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let mut json: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(servers) = json.get_mut("lspServers").and_then(|v| v.as_object_mut()) {
        servers.remove(&name);
    }

    let output = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
    fs::write(&json_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_lsp_server_env(
    server_name: String,
    env_key: String,
    env_value: String,
) -> Result<(), String> {
    let json_path = get_claude_json_path();
    let mut json: Value = if json_path.exists() {
        let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        return Err("Config file not found".to_string());
    };

    let server = json
        .get_mut("lspServers")
        .and_then(|s| s.get_mut(&server_name))
        .ok_or_else(|| format!("LSP server '{}' not found", server_name))?;

    if !server.get("env").is_some() {
        server["env"] = serde_json::json!({});
    }
    server["env"][&env_key] = serde_json::Value::String(env_value);

    let output = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
    fs::write(&json_path, output).map_err(|e| e.to_string())?;

    Ok(())
}
