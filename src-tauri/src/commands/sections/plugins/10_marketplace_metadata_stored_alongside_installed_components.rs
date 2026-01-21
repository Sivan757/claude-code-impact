// ============================================================================

/// Marketplace metadata stored alongside installed components
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct MarketplaceMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloads: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub template_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalSkill {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub content: String,
    // Marketplace metadata (if installed from marketplace)
    #[serde(flatten)]
    pub marketplace: Option<MarketplaceMeta>,
}

#[tauri::command]
fn list_local_skills() -> Result<Vec<LocalSkill>, String> {
    let skills_dir = get_claude_dir().join("skills");

    if !skills_dir.exists() {
        return Ok(vec![]);
    }

    let mut skills = Vec::new();

    for entry in fs::read_dir(&skills_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            let skill_name = path.file_name().unwrap().to_string_lossy().to_string();
            let skill_md = path.join("SKILL.md");

            if skill_md.exists() {
                let content = fs::read_to_string(&skill_md).unwrap_or_default();
                let (frontmatter, _, _) = parse_frontmatter(&content);

                // Load marketplace metadata if exists
                let meta_path = path.join(".meta.json");
                let marketplace = if meta_path.exists() {
                    fs::read_to_string(&meta_path)
                        .ok()
                        .and_then(|s| serde_json::from_str::<MarketplaceMeta>(&s).ok())
                } else {
                    None
                };

                skills.push(LocalSkill {
                    name: skill_name,
                    path: skill_md.to_string_lossy().to_string(),
                    description: frontmatter.get("description").cloned(),
                    content, // Return raw content with frontmatter for frontend display
                    marketplace,
                });
            }
        }
    }

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

