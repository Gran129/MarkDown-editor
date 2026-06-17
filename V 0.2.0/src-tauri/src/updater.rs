use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex};

use semver::Version;
use serde::{Deserialize, Serialize};

const GITHUB_REPO: &str = "Gran129/MarkDown-editor";
const SETUP_ASSET_SUFFIX: &str = "_x64-setup.exe";
const PORTABLE_MARKER: &str = "MarkDown-editor.portable";

static DOWNLOAD_PROGRESS: AtomicU8 = AtomicU8::new(0);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AppEdition {
    Portable,
    Installed,
}

pub struct UpdateState {
    pub installer_path: Arc<Mutex<Option<PathBuf>>>,
    pub install_on_exit: Arc<Mutex<bool>>,
    pub latest_version: Arc<Mutex<Option<String>>>,
    pub download_url: Arc<Mutex<Option<String>>>,
}

impl UpdateState {
    pub fn new() -> Self {
        Self {
            installer_path: Arc::new(Mutex::new(None)),
            install_on_exit: Arc::new(Mutex::new(false)),
            latest_version: Arc::new(Mutex::new(None)),
            download_url: Arc::new(Mutex::new(None)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStatus {
    UpToDate,
    UpdateAvailable,
    SkippedPortable,
    SkippedOffline,
    CheckFailed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppEditionInfo {
    pub edition: AppEdition,
    pub update_enabled: bool,
    pub network_online: bool,
    pub current_version: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub status: UpdateStatus,
    pub edition: AppEdition,
    pub update_enabled: bool,
    pub network_online: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub percent: u8,
    pub ready: bool,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    body: Option<String>,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

fn current_version_string() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

fn current_version() -> Result<Version, String> {
    Version::parse(env!("CARGO_PKG_VERSION")).map_err(|e| e.to_string())
}

fn parse_release_version(tag: &str) -> Result<Version, String> {
    let trimmed = tag.trim_start_matches('v').trim_start_matches('V');
    Version::parse(trimmed).map_err(|e| format!("无法解析版本号 {tag}: {e}"))
}

pub fn detect_app_edition() -> AppEdition {
    #[cfg(debug_assertions)]
    {
        return AppEdition::Portable;
    }

    #[cfg(not(debug_assertions))]
    {
        let Ok(exe) = std::env::current_exe() else {
            return AppEdition::Portable;
        };

        if is_portable_executable(&exe) {
            return AppEdition::Portable;
        }

        if is_registered_installation(&exe) {
            return AppEdition::Installed;
        }

        AppEdition::Portable
    }
}

fn is_portable_executable(exe: &Path) -> bool {
    let file_name = exe
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    if file_name.contains("portable") {
        return true;
    }

    let marker = exe
        .parent()
        .map(|dir| dir.join(PORTABLE_MARKER))
        .unwrap_or_else(|| PathBuf::from(PORTABLE_MARKER));

    marker.exists()
}

#[cfg(target_os = "windows")]
fn is_registered_installation(exe: &Path) -> bool {
    use winreg::enums::*;
    use winreg::RegKey;

    let Ok(canonical_exe) = std::fs::canonicalize(exe) else {
        return false;
    };

    for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        let root = RegKey::predef(hive);
        let Ok(uninstall) =
            root.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Uninstall")
        else {
            continue;
        };

        for key_name in uninstall.enum_keys().flatten() {
            let Ok(app) = uninstall.open_subkey(&key_name) else {
                continue;
            };

            let display_name: String = app.get_value("DisplayName").unwrap_or_default();
            if !display_name.contains("MarkDown") && !key_name.contains("com.markdown-editor.app")
            {
                continue;
            }

            if let Ok(install_location) = app.get_value::<String, _>("InstallLocation") {
                let install_path = PathBuf::from(install_location);
                if canonical_exe.starts_with(&install_path) {
                    return true;
                }
            }

            if let Ok(uninstall_string) = app.get_value::<String, _>("UninstallString") {
                let uninstall_path = uninstall_string
                    .trim_matches('"')
                    .split_whitespace()
                    .next()
                    .map(PathBuf::from);
                if let Some(uninstall_path) = uninstall_path {
                    if let Ok(canonical_uninstall) = std::fs::canonicalize(uninstall_path) {
                        if let Some(install_dir) = canonical_uninstall.parent() {
                            if canonical_exe.starts_with(install_dir) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
    }

    false
}

#[cfg(not(target_os = "windows"))]
fn is_registered_installation(_exe: &Path) -> bool {
    false
}

pub fn is_network_online() -> bool {
    let client = match reqwest::blocking::Client::builder()
        .user_agent("MarkDown-editor-updater")
        .timeout(std::time::Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    client
        .get(format!("https://api.github.com/repos/{GITHUB_REPO}/releases/latest"))
        .header("Accept", "application/vnd.github+json")
        .send()
        .map(|r| r.status().is_success())
        .unwrap_or(false)
}

fn find_setup_asset_url(release: &GithubRelease) -> Option<String> {
    release
        .assets
        .iter()
        .find(|a| a.name.ends_with(SETUP_ASSET_SUFFIX))
        .map(|a| a.browser_download_url.clone())
}

fn fetch_latest_release() -> Result<GithubRelease, String> {
    let url = format!("https://api.github.com/repos/{GITHUB_REPO}/releases/latest");
    let client = reqwest::blocking::Client::builder()
        .user_agent("MarkDown-editor-updater")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .map_err(|e| format!("网络请求失败: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API 返回 {}", response.status()));
    }

    response
        .json::<GithubRelease>()
        .map_err(|e| format!("解析 Release 信息失败: {e}"))
}

fn base_result(
    status: UpdateStatus,
    edition: AppEdition,
    network_online: bool,
    error: Option<String>,
) -> UpdateCheckResult {
    UpdateCheckResult {
        status,
        edition,
        update_enabled: edition == AppEdition::Installed,
        network_online,
        current_version: current_version_string(),
        latest_version: None,
        release_notes: None,
        download_url: None,
        error,
    }
}

pub fn get_app_edition_info() -> AppEditionInfo {
    let edition = detect_app_edition();
    let network_online = is_network_online();
    AppEditionInfo {
        edition,
        update_enabled: edition == AppEdition::Installed,
        network_online,
        current_version: current_version_string(),
    }
}

pub fn perform_update_check(state: &UpdateState) -> UpdateCheckResult {
    let edition = detect_app_edition();
    let network_online = is_network_online();

    if edition == AppEdition::Portable {
        return base_result(UpdateStatus::SkippedPortable, edition, network_online, None);
    }

    if !network_online {
        return base_result(UpdateStatus::SkippedOffline, edition, network_online, None);
    }

    let current = match current_version() {
        Ok(v) => v,
        Err(e) => {
            return UpdateCheckResult {
                status: UpdateStatus::CheckFailed,
                edition,
                update_enabled: true,
                network_online,
                current_version: current_version_string(),
                latest_version: None,
                release_notes: None,
                download_url: None,
                error: Some(e),
            };
        }
    };

    let release = match fetch_latest_release() {
        Ok(r) => r,
        Err(e) => {
            return UpdateCheckResult {
                status: UpdateStatus::CheckFailed,
                edition,
                update_enabled: true,
                network_online,
                current_version: current.to_string(),
                latest_version: None,
                release_notes: None,
                download_url: None,
                error: Some(e),
            };
        }
    };

    let latest = match parse_release_version(&release.tag_name) {
        Ok(v) => v,
        Err(e) => {
            return UpdateCheckResult {
                status: UpdateStatus::CheckFailed,
                edition,
                update_enabled: true,
                network_online,
                current_version: current.to_string(),
                latest_version: None,
                release_notes: None,
                download_url: None,
                error: Some(e),
            };
        }
    };

    let download_url = find_setup_asset_url(&release);
    let latest_str = latest.to_string();

    if let Ok(mut stored) = state.latest_version.lock() {
        *stored = Some(latest_str.clone());
    }
    if let Ok(mut stored_url) = state.download_url.lock() {
        *stored_url = download_url.clone();
    }

    if current < latest {
        return UpdateCheckResult {
            status: UpdateStatus::UpdateAvailable,
            edition,
            update_enabled: true,
            network_online,
            current_version: current.to_string(),
            latest_version: Some(latest_str),
            release_notes: release.body,
            download_url,
            error: None,
        };
    }

    UpdateCheckResult {
        status: UpdateStatus::UpToDate,
        edition,
        update_enabled: true,
        network_online,
        current_version: current.to_string(),
        latest_version: Some(latest_str),
        release_notes: release.body,
        download_url: None,
        error: None,
    }
}

pub fn start_download(state: &UpdateState, url: Option<String>) -> Result<(), String> {
    if detect_app_edition() == AppEdition::Portable {
        return Err("便携版本地版不支持在线更新".to_string());
    }

    if !is_network_online() {
        return Err("当前处于离线状态，无法下载更新".to_string());
    }

    let download_url = url.or_else(|| {
        state
            .download_url
            .lock()
            .ok()
            .and_then(|g| g.clone())
    });

    let download_url = download_url.ok_or_else(|| "未找到安装包下载地址".to_string())?;

    if state
        .installer_path
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(false)
    {
        return Ok(());
    }

    DOWNLOAD_PROGRESS.store(0, Ordering::SeqCst);

    let installer_path = Arc::clone(&state.installer_path);
    std::thread::spawn(move || {
        if let Err(e) = download_installer(&download_url, &installer_path) {
            eprintln!("更新包下载失败: {e}");
            DOWNLOAD_PROGRESS.store(255, Ordering::SeqCst);
        }
    });

    Ok(())
}

fn download_installer(url: &str, installer_path: &Arc<Mutex<Option<PathBuf>>>) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .user_agent("MarkDown-editor-updater")
        .timeout(std::time::Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;

    let mut response = client
        .get(url)
        .send()
        .map_err(|e| format!("下载失败: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("下载 HTTP {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let temp_dir = std::env::temp_dir().join("markdown-editor-updates");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let file_name = url.rsplit('/').next().unwrap_or("update-setup.exe");
    let dest = temp_dir.join(file_name);

    let mut file = std::fs::File::create(&dest).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut buffer = [0u8; 8192];

    loop {
        let read = response
            .read(&mut buffer)
            .map_err(|e| format!("读取下载流失败: {e}"))?;
        if read == 0 {
            break;
        }
        use std::io::Write;
        file.write_all(&buffer[..read])
            .map_err(|e| e.to_string())?;
        downloaded += read as u64;
        if total > 0 {
            let pct = ((downloaded * 100) / total).min(100) as u8;
            DOWNLOAD_PROGRESS.store(pct, Ordering::SeqCst);
        }
    }

    DOWNLOAD_PROGRESS.store(100, Ordering::SeqCst);

    if let Ok(mut guard) = installer_path.lock() {
        *guard = Some(dest);
    }

    Ok(())
}

pub fn get_download_progress(state: &UpdateState) -> DownloadProgress {
    let pct = DOWNLOAD_PROGRESS.load(Ordering::SeqCst);
    if pct == 255 {
        return DownloadProgress {
            percent: 0,
            ready: false,
            error: Some("下载失败，请检查网络后重试".to_string()),
        };
    }

    let ready = state
        .installer_path
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(false);

    DownloadProgress {
        percent: if ready { 100 } else { pct },
        ready,
        error: None,
    }
}

pub fn confirm_install_on_exit(state: &UpdateState) -> Result<(), String> {
    if detect_app_edition() == AppEdition::Portable {
        return Err("便携版本地版不支持在线更新".to_string());
    }

    let ready = state
        .installer_path
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(false);

    if !ready {
        return Err("安装包尚未下载完成".to_string());
    }

    if let Ok(mut flag) = state.install_on_exit.lock() {
        *flag = true;
    }
    Ok(())
}

pub fn on_app_exit(state: &UpdateState) {
    if detect_app_edition() == AppEdition::Portable {
        return;
    }

    let should_install = state
        .install_on_exit
        .lock()
        .map(|g| *g)
        .unwrap_or(false);

    if !should_install {
        return;
    }

    let installer = state
        .installer_path
        .lock()
        .ok()
        .and_then(|g| g.clone());

    if let Some(path) = installer {
        #[cfg(target_os = "windows")]
        spawn_detached(&format!("\"{}\" /S", path.display()));
    }
}

fn spawn_detached(command: &str) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;

        let _ = std::process::Command::new("cmd")
            .args(["/C", command])
            .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS)
            .spawn();
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = command;
    }
}

#[tauri::command]
pub fn get_app_edition_info_cmd() -> AppEditionInfo {
    get_app_edition_info()
}

#[tauri::command]
pub fn check_for_updates(state: tauri::State<'_, UpdateState>) -> UpdateCheckResult {
    perform_update_check(&state)
}

#[tauri::command]
pub fn start_update_download(
    state: tauri::State<'_, UpdateState>,
    download_url: Option<String>,
) -> Result<(), String> {
    start_download(&state, download_url)
}

#[tauri::command]
pub fn get_update_download_progress(state: tauri::State<'_, UpdateState>) -> DownloadProgress {
    get_download_progress(&state)
}

#[tauri::command]
pub fn confirm_update_install(state: tauri::State<'_, UpdateState>) -> Result<(), String> {
    confirm_install_on_exit(&state)
}
