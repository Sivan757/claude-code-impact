const UI_PREF_PREFIX: &str = "ui.";

#[tauri::command]
fn get_ui_preference(key: String) -> Result<Option<Value>, String> {
    if !key.starts_with(UI_PREF_PREFIX) {
        return Err("Invalid UI preference key".to_string());
    }
    read_data_key(&key)
}

#[tauri::command]
fn get_ui_preferences(keys: Vec<String>) -> Result<HashMap<String, Value>, String> {
    let valid_keys: Vec<String> = keys
        .into_iter()
        .filter(|key| key.starts_with(UI_PREF_PREFIX))
        .collect();
    read_data_keys(&valid_keys)
}

#[tauri::command]
fn set_ui_preference(key: String, value: Value) -> Result<(), String> {
    if !key.starts_with(UI_PREF_PREFIX) {
        return Err("Invalid UI preference key".to_string());
    }
    write_data_key(&key, value)
}

#[tauri::command]
fn remove_ui_preference(key: String) -> Result<(), String> {
    if !key.starts_with(UI_PREF_PREFIX) {
        return Err("Invalid UI preference key".to_string());
    }
    remove_data_key(&key)
}
