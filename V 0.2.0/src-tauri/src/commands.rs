use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::vault::{self, FileNode, VaultInfo};
use crate::watcher;
use crate::AppState;

fn default_line_height() -> f64 {
    1.75
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub theme: String,
    pub auto_save_ms: u64,
    pub daily_notes_folder: String,
    pub daily_notes_template: String,
    pub font_size: u32,
    #[serde(default = "default_line_height")]
    pub line_height: f64,
    pub default_vault: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            auto_save_ms: 2000,
            daily_notes_folder: "Daily".to_string(),
            daily_notes_template: String::new(),
            font_size: 16,
            line_height: default_line_height(),
            default_vault: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub path: String,
    pub title: String,
    pub snippet: String,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BacklinkResult {
    pub source_path: String,
    pub source_title: String,
    pub context: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub enabled: bool,
}

fn app_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("failed to get app data dir")
}

fn settings_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join("settings.json")
}

fn vaults_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join("vaults.json")
}

fn drafts_dir(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join("drafts")
}

fn draft_path(app: &AppHandle, file_path: &str) -> PathBuf {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    file_path.hash(&mut hasher);
    drafts_dir(app).join(format!("{:x}.draft", hasher.finish()))
}

fn plugins_path(app: &AppHandle) -> PathBuf {
    app_data_dir(app).join("plugins.json")
}

fn ensure_app_dirs(app: &AppHandle) {
    let dir = app_data_dir(app);
    let _ = fs::create_dir_all(&dir);
    let _ = fs::create_dir_all(drafts_dir(app));
}

#[tauri::command]
pub async fn open_vault_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let path = app
        .dialog()
        .file()
        .set_title("选择 Vault 文件夹")
        .blocking_pick_folder();

    Ok(path.map(|p| p.to_string()))
}

#[tauri::command]
pub fn list_recent_vaults(app: AppHandle) -> Result<Vec<VaultInfo>, String> {
    ensure_app_dirs(&app);
    let path = vaults_path(&app);
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_recent_vault(app: AppHandle, path: String) -> Result<(), String> {
    ensure_app_dirs(&app);
    let mut vaults = list_recent_vaults(app.clone())?;
    vaults.retain(|v| v.path != path);
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    vaults.insert(
        0,
        VaultInfo {
            path: path.clone(),
            name,
            last_opened: chrono::Utc::now().timestamp_millis() as u64,
        },
    );
    vaults.truncate(10);
    let json = serde_json::to_string_pretty(&vaults).map_err(|e| e.to_string())?;
    fs::write(vaults_path(&app), json).map_err(|e| e.to_string())?;

    if let Ok(mut vp) = app.state::<AppState>().vault_path.lock() {
        *vp = Some(path);
    }
    Ok(())
}

#[tauri::command]
pub fn list_files(vault_path: String) -> Result<Vec<FileNode>, String> {
    vault::scan_vault(&vault_path)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_file(path: String, content: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err("文件已存在".to_string());
    }
    write_file(path, content)
}

#[tauri::command]
pub fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn move_path(source: String, destination: String) -> Result<(), String> {
    fs::rename(&source, &destination).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = Path::new(&path).parent() {
            Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn start_vault_watcher(app: AppHandle, vault_path: String) -> Result<(), String> {
    watcher::start_watching(app, vault_path)
}

#[tauri::command]
pub fn index_vault(state: State<AppState>, app: AppHandle, vault_path: String) -> Result<(), String> {
    let db_path = app_data_dir(&app).join("search.db");
    ensure_app_dirs(&app);
    let mut search = state.search.lock().map_err(|e| e.to_string())?;
    search.open(&db_path)?;
    search.index_vault(&vault_path)
}

#[tauri::command]
pub fn search_notes(
    state: State<AppState>,
    vault_path: String,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let search = state.search.lock().map_err(|e| e.to_string())?;
    search.search(&vault_path, &query)
}

#[tauri::command]
pub fn get_backlinks(
    state: State<AppState>,
    vault_path: String,
    note_name: String,
) -> Result<Vec<BacklinkResult>, String> {
    let search = state.search.lock().map_err(|e| e.to_string())?;
    search.get_backlinks(&vault_path, &note_name)
}

#[tauri::command]
pub fn resolve_note_path(vault_path: String, note_name: String) -> Result<Option<String>, String> {
    Ok(vault::resolve_note(&vault_path, &note_name))
}

#[tauri::command]
pub fn update_wiki_links_on_rename(
    vault_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    vault::update_wiki_links(&vault_path, &old_name, &new_name)
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    ensure_app_dirs(&app);
    let path = settings_path(&app);
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    ensure_app_dirs(&app);
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(settings_path(&app), json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_draft(app: AppHandle, path: String, content: String) -> Result<(), String> {
    ensure_app_dirs(&app);
    fs::write(draft_path(&app, &path), content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_draft(app: AppHandle, path: String) -> Result<Option<String>, String> {
    let dp = draft_path(&app, &path);
    if dp.exists() {
        Ok(Some(fs::read_to_string(&dp).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn clear_draft(app: AppHandle, path: String) -> Result<(), String> {
    let dp = draft_path(&app, &path);
    if dp.exists() {
        fs::remove_file(&dp).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_plugins(app: AppHandle) -> Result<Vec<PluginManifest>, String> {
    ensure_app_dirs(&app);
    let path = plugins_path(&app);
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn enable_plugin(app: AppHandle, id: String, enabled: bool) -> Result<(), String> {
    let mut plugins = list_plugins(app.clone())?;
    if let Some(p) = plugins.iter_mut().find(|p| p.id == id) {
        p.enabled = enabled;
    }
    let json = serde_json::to_string_pretty(&plugins).map_err(|e| e.to_string())?;
    fs::write(plugins_path(&app), json).map_err(|e| e.to_string())
}
