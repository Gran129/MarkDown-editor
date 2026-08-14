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
pub struct TagInfo {
    pub tag: String,
    pub paths: Vec<String>,
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
pub fn add_recent_vault(app: AppHandle, path: String) -> Result<String, String> {
    ensure_app_dirs(&app);
    let source = PathBuf::from(&path);
    let work = crate::project::open_project(&app, &source)?;
    let work_str = work.to_string_lossy().into_owned();

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
        *vp = Some(work_str.clone());
    }
    if let Ok(mut sp) = app.state::<AppState>().source_vault_path.lock() {
        *sp = Some(path);
    }
    Ok(work_str)
}

#[tauri::command]
pub fn list_files(vault_path: String) -> Result<Vec<FileNode>, String> {
    vault::scan_vault(&vault_path)
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    crate::mde::open_note(Path::new(&path))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<String, String> {
    let source = PathBuf::from(&path);
    let dest = crate::mde::save_working_note(&source, &content)?;
    if dest != source && source.is_file() {
        let _ = fs::remove_file(&source);
    }
    Ok(dest.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn create_file(path: String, content: String) -> Result<String, String> {
    let dest = crate::mde::with_working_ext(Path::new(&path));
    if dest.exists() {
        return Err("文件已存在".to_string());
    }
    write_file(dest.to_string_lossy().into_owned(), content)
}

#[tauri::command]
pub fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    let old = PathBuf::from(&old_path);
    let new = PathBuf::from(&new_path);
    fs::rename(&old, &new).map_err(|e| e.to_string())?;
    rename_companion_work_dir(&old, &new);
    Ok(())
}

#[tauri::command]
pub fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_file() {
        let work = crate::mde::work_dir(p);
        if work.exists() {
            let _ = fs::remove_dir_all(&work);
        }
    }
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn move_path(source: String, destination: String) -> Result<(), String> {
    let old = PathBuf::from(&source);
    let new = PathBuf::from(&destination);
    fs::rename(&old, &new).map_err(|e| e.to_string())?;
    rename_companion_work_dir(&old, &new);
    Ok(())
}

fn rename_companion_work_dir(old: &Path, new: &Path) {
    if !crate::mde::is_note_file(old) {
        return;
    }
    let old_work = crate::mde::work_dir(old);
    let new_work = crate::mde::work_dir(new);
    if old_work.exists() && old_work != new_work {
        let _ = fs::rename(old_work, new_work);
    }
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
pub fn list_vault_tags(
    state: State<AppState>,
    vault_path: String,
) -> Result<Vec<TagInfo>, String> {
    let search = state.search.lock().map_err(|e| e.to_string())?;
    search.list_tags(&vault_path)
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

#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    let file = PathBuf::from(&path);
    if !file.is_file() {
        return Err("文件不存在".to_string());
    }
    fs::read(&file).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_file(source: String, destination: String) -> Result<(), String> {
    let dest = PathBuf::from(&destination);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(&source, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn copy_into_note_resources(note_path: String, source_path: String) -> Result<String, String> {
    crate::mde::copy_into_note_resources(Path::new(&note_path), Path::new(&source_path))
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    let file = PathBuf::from(&path);
    if !file.exists() {
        return Err("文件不存在".to_string());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn export_note(
    state: State<AppState>,
    source_path: String,
    dest_path: String,
    content: String,
    format: String,
) -> Result<String, String> {
    let vault = state
        .vault_path
        .lock()
        .ok()
        .and_then(|guard| guard.clone());
    let source = PathBuf::from(&source_path);
    let source_ref = if source_path.trim().is_empty() || !source.exists() {
        None
    } else {
        Some(source.as_path())
    };
    let dest = crate::mde::export_note_to(
        source_ref,
        Path::new(&dest_path),
        &content,
        &format,
        vault.as_deref().map(Path::new),
    )?;
    Ok(dest.to_string_lossy().into_owned())
}
