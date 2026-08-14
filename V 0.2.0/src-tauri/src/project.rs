//! Per-project plaintext working folders next to the running app (portable /
//! install directory), falling back to the OS app-data directory when that
//! location is not writable.
//!
//! Daily save writes Markdown here. Encryption happens only when exporting.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::mde;
use crate::vault;

const PROJECTS_DIR: &str = "projects";
const INDEX_FILE: &str = "index.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ProjectEntry {
    source_path: String,
    work_path: String,
    name: String,
}

pub fn projects_root(app: &AppHandle) -> PathBuf {
    if let Some(dir) = install_dir() {
        let candidate = dir.join(PROJECTS_DIR);
        if dir_is_writable(&candidate) {
            return candidate;
        }
    }
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("markdown-editor"))
        .join(PROJECTS_DIR)
}

fn install_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
}

fn dir_is_writable(dir: &Path) -> bool {
    if fs::create_dir_all(dir).is_err() {
        return false;
    }
    let probe = dir.join(".write-test");
    let ok = fs::write(&probe, b"ok").is_ok();
    let _ = fs::remove_file(&probe);
    ok
}

/// Open (or create) the plaintext working folder for a user-chosen vault/project.
/// Existing encrypted notes are decrypted into the working folder once; later
/// opens skip files that are already present so local edits are kept.
pub fn open_project(app: &AppHandle, source_path: &Path) -> Result<PathBuf, String> {
    if !source_path.exists() {
        return Err("项目路径不存在".to_string());
    }
    let root = projects_root(app);
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    if is_under(&root, source_path) {
        hydrate_project(source_path, source_path)?;
        return Ok(source_path.to_path_buf());
    }

    let mut index = load_index(&root);
    if let Some(existing) = find_entry(&index, source_path) {
        let work = PathBuf::from(&existing.work_path);
        fs::create_dir_all(&work).map_err(|e| e.to_string())?;
        hydrate_project(source_path, &work)?;
        return Ok(work);
    }

    let work = unique_work_dir(&root, source_path, &index);
    fs::create_dir_all(&work).map_err(|e| e.to_string())?;
    hydrate_project(source_path, &work)?;

    index.retain(|entry| !same_source(&entry.source_path, source_path));
    index.push(ProjectEntry {
        source_path: source_path.to_string_lossy().into_owned(),
        work_path: work.to_string_lossy().into_owned(),
        name: project_display_name(source_path),
    });
    save_index(&root, &index)?;
    Ok(work)
}

pub fn hydrate_project(source_vault: &Path, work_root: &Path) -> Result<(), String> {
    fs::create_dir_all(work_root).map_err(|e| e.to_string())?;
    if same_path(source_vault, work_root) {
        return Ok(());
    }

    let mut files = vault::collect_md_files(&source_vault.to_string_lossy());
    files.sort_by_key(|path| mde::note_rank(path));

    for path in files {
        if is_under(work_root, &path) {
            continue;
        }
        let Ok(rel) = path.strip_prefix(source_vault) else {
            continue;
        };
        let stem = path
            .file_stem()
            .map(|s| s.to_string_lossy().into_owned())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "note".to_string());
        let dest_md = match rel.parent() {
            Some(parent) if !parent.as_os_str().is_empty() => {
                work_root.join(parent).join(format!("{stem}.md"))
            }
            _ => work_root.join(format!("{stem}.md")),
        };
        if dest_md.exists() {
            continue;
        }
        if let Some(parent) = dest_md.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        if mde::is_encrypted_note(&path) {
            let data = fs::read(&path).map_err(|e| e.to_string())?;
            let package = mde::decode_mde(&data)?;
            fs::write(&dest_md, &package.markdown).map_err(|e| e.to_string())?;
            let _ = mde::extract_package(&package, &mde::work_dir(&dest_md));
        } else {
            let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            fs::write(&dest_md, text).map_err(|e| e.to_string())?;
            copy_sidecar_resources(&path, &dest_md);
        }
    }
    Ok(())
}

fn copy_sidecar_resources(source_note: &Path, dest_note: &Path) {
    let dest_res = mde::work_dir(dest_note).join(".resources");
    let mut candidates = Vec::new();
    candidates.push(mde::work_dir(source_note).join(".resources"));
    if let Some(parent) = source_note.parent() {
        candidates.push(parent.join(".resources"));
    }
    for dir in candidates {
        if !dir.is_dir() {
            continue;
        }
        let _ = copy_dir_contents(&dir, &dest_res);
    }
}

fn copy_dir_contents(src: &Path, dest: &Path) -> Result<(), String> {
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    for entry in walkdir::WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let Ok(rel) = entry.path().strip_prefix(src) else {
            continue;
        };
        if rel.as_os_str().is_empty() {
            continue;
        }
        let out = dest.join(rel);
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        if !out.exists() {
            let _ = fs::copy(entry.path(), &out);
        }
    }
    Ok(())
}

fn load_index(root: &Path) -> Vec<ProjectEntry> {
    let path = root.join(INDEX_FILE);
    let Ok(text) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

fn save_index(root: &Path, index: &[ProjectEntry]) -> Result<(), String> {
    let path = root.join(INDEX_FILE);
    let json = serde_json::to_string_pretty(index).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

fn find_entry<'a>(index: &'a [ProjectEntry], source_path: &Path) -> Option<&'a ProjectEntry> {
    index.iter().find(|entry| {
        same_source(&entry.source_path, source_path) && Path::new(&entry.work_path).is_dir()
    })
}

fn unique_work_dir(root: &Path, source_path: &Path, index: &[ProjectEntry]) -> PathBuf {
    let base = format!(
        "{}--{:08x}",
        sanitize_name(&project_display_name(source_path)),
        path_hash(source_path)
    );
    let candidate = root.join(&base);
    if !candidate.exists()
        && !index
            .iter()
            .any(|entry| Path::new(&entry.work_path) == candidate)
    {
        return candidate;
    }
    for i in 2..1000 {
        let alt = root.join(format!("{base}-{i}"));
        if !alt.exists() {
            return alt;
        }
    }
    root.join(format!(
        "{base}-{}",
        chrono::Utc::now().timestamp_millis()
    ))
}

fn project_display_name(source_path: &Path) -> String {
    source_path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "project".to_string())
}

fn sanitize_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|ch| {
            if ch.is_alphanumeric() || ch == '-' || ch == '_' || ch == ' ' {
                ch
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches(['-', ' ', '.']).replace(' ', "-");
    let sliced: String = trimmed.chars().take(40).collect();
    if sliced.is_empty() {
        "project".to_string()
    } else {
        sliced
    }
}

fn path_hash(path: &Path) -> u32 {
    let mut hasher = DefaultHasher::new();
    source_key(path).hash(&mut hasher);
    hasher.finish() as u32
}

fn source_key(path: &Path) -> String {
    path.canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .replace('\\', "/")
        .to_lowercase()
}

fn same_source(stored: &str, path: &Path) -> bool {
    source_key(Path::new(stored)) == source_key(path)
}

fn same_path(a: &Path, b: &Path) -> bool {
    source_key(a) == source_key(b)
}

fn is_under(root: &Path, path: &Path) -> bool {
    let root_key = source_key(root);
    let path_key = source_key(path);
    path_key == root_key || path_key.starts_with(&(root_key.clone() + "/"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hydrate_decrypts_once_and_keeps_working_edits() {
        let dir = std::env::temp_dir().join(format!(
            "md-project-hydrate-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let source = dir.join("vault");
        let work = dir.join("projects").join("vault--test");
        fs::create_dir_all(&source).expect("source");

        let encoded = mde::encode_mde(
            "hello.md",
            "# Secret\n\nfrom package\n",
            &[(".resources/pic.png".to_string(), b"png-bytes".to_vec())],
        )
        .expect("encode");
        fs::write(source.join("hello.mdte"), encoded).expect("write mdte");
        fs::write(source.join("plain.md"), "# Plain\n").expect("write md");

        hydrate_project(&source, &work).expect("hydrate");
        let hello = fs::read_to_string(work.join("hello.md")).expect("hello");
        assert!(hello.contains("from package"));
        let pic = mde::work_dir(&work.join("hello.md"))
            .join(".resources")
            .join("pic.png");
        assert_eq!(fs::read(&pic).expect("pic"), b"png-bytes");
        assert!(work.join("plain.md").exists());

        fs::write(work.join("hello.md"), "# Edited locally\n").expect("edit");
        hydrate_project(&source, &work).expect("second hydrate");
        let hello_after = fs::read_to_string(work.join("hello.md")).expect("hello after");
        assert!(hello_after.contains("Edited locally"));
        assert!(!hello_after.contains("from package"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn sanitize_strips_path_noise() {
        assert_eq!(sanitize_name("My Notes"), "My-Notes");
        assert_eq!(sanitize_name("??"), "project");
    }
}
