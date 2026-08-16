//! Encrypted native note package (`.mdte`): a zip of the markdown note plus a
//! hidden `.resources` folder, wrapped in AES-256-GCM. The on-disk header still
//! uses magic `MDE1`, so leftover `.mde` exports decrypt with the same codec.
//! The key is derived with Argon2id from the application-wide passphrase.

use std::collections::HashSet;
use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use regex::Regex;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

pub const NATIVE_EXT: &str = "mdte";
pub const LEGACY_EXPORT_EXT: &str = "mde";
pub const WORKING_EXT: &str = "md";

const MAGIC: &[u8; 4] = b"MDE1";
const VERSION: u8 = 1;
const MDE_PASSPHRASE: &[u8] = b"Tardis";
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const HEADER_LEN: usize = 4 + 1 + SALT_LEN + NONCE_LEN;
const ARGON2_M_KIB: u32 = 19_456;
const ARGON2_T: u32 = 2;
const ARGON2_P: u32 = 1;

const ATTACHMENT_EXTS: &[&str] = &[
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tif",
    ".tiff", ".avif", ".heic", ".pdf", ".mp4", ".webm", ".mov", ".avi", ".mkv",
    ".mp3", ".wav", ".ogg", ".flac", ".csv", ".zip", ".doc", ".docx", ".xls",
    ".xlsx", ".ppt", ".pptx",
];

#[derive(Debug)]
pub struct MdePackage {
    pub markdown_name: String,
    pub markdown: String,
    pub resources: Vec<(String, Vec<u8>)>,
}

pub fn export_package_bytes(
    markdown_name: &str,
    markdown: &str,
    source_path: Option<&Path>,
    vault_path: Option<&Path>,
) -> Result<Vec<u8>, String> {
    let (rewritten, resources) = gather_resources(markdown, source_path, vault_path)?;
    encode_mde(markdown_name, &rewritten, &resources)
}

pub fn write_mde_file(dest: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(dest, bytes).map_err(|e| e.to_string())
}

pub fn extract_package(package: &MdePackage, dest_dir: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    let md_name = Path::new(&package.markdown_name)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .filter(|n| n.to_lowercase().ends_with(".md"))
        .unwrap_or_else(|| "note.md".to_string());
    let md_path = dest_dir.join(&md_name);
    fs::write(&md_path, &package.markdown).map_err(|e| e.to_string())?;

    let resources_dir = dest_dir.join(".resources");
    fs::create_dir_all(&resources_dir).map_err(|e| e.to_string())?;
    for (name, bytes) in &package.resources {
        let relative = sanitize_entry_name(name)?;
        let stripped = strip_resources_prefix(&relative);
        let out = resources_dir.join(stripped);
        if !out.starts_with(&resources_dir) {
            return Err("压缩包内含非法路径".to_string());
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&out, bytes).map_err(|e| e.to_string())?;
    }
    hide_dot_resources(&resources_dir);
    Ok(md_path)
}

/// Import an encrypted `.mdte` / `.mde` package into a vault folder as a working `.md` note.
pub fn import_encrypted_to_dir(source: &Path, dest_dir: &Path) -> Result<PathBuf, String> {
    let data = fs::read(source).map_err(|e| e.to_string())?;
    let package = decode_mde(&data)?;
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;

    let stem = Path::new(&package.markdown_name)
        .file_stem()
        .map(|n| n.to_string_lossy().into_owned())
        .filter(|n| !n.is_empty())
        .or_else(|| {
            source
                .file_stem()
                .map(|n| n.to_string_lossy().into_owned())
                .filter(|n| !n.is_empty())
        })
        .unwrap_or_else(|| "note".to_string());

    let mut md_path = dest_dir.join(format!("{stem}.{WORKING_EXT}"));
    let mut index = 2;
    while md_path.exists() {
        md_path = dest_dir.join(format!("{stem}-{index}.{WORKING_EXT}"));
        index += 1;
    }

    fs::write(&md_path, &package.markdown).map_err(|e| e.to_string())?;

    let resources = resources_dir(&md_path);
    fs::create_dir_all(&resources).map_err(|e| e.to_string())?;
    for (name, bytes) in &package.resources {
        let relative = sanitize_entry_name(name)?;
        let stripped = strip_resources_prefix(&relative);
        let out = resources.join(stripped);
        if !out.starts_with(&resources) {
            return Err("压缩包内含非法路径".to_string());
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&out, bytes).map_err(|e| e.to_string())?;
    }
    hide_dot_resources(&resources);
    Ok(md_path)
}

pub fn encode_mde(
    markdown_name: &str,
    markdown: &str,
    resources: &[(String, Vec<u8>)],
) -> Result<Vec<u8>, String> {
    let zip_bytes = write_zip(markdown_name, markdown, resources)?;
    encrypt_zip(&zip_bytes)
}

pub fn decode_mde(data: &[u8]) -> Result<MdePackage, String> {
    let zip_bytes = decrypt_zip(data)?;
    read_zip(&zip_bytes)
}

fn derive_key(salt: &[u8]) -> Result<[u8; 32], String> {
    let params = Params::new(ARGON2_M_KIB, ARGON2_T, ARGON2_P, Some(32)).map_err(|e| e.to_string())?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon
        .hash_password_into(MDE_PASSPHRASE, salt, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(key)
}

fn random_bytes(len: usize) -> Result<Vec<u8>, String> {
    let mut buf = vec![0u8; len];
    getrandom::getrandom(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

fn encrypt_zip(zip_bytes: &[u8]) -> Result<Vec<u8>, String> {
    let salt = random_bytes(SALT_LEN)?;
    let nonce_bytes = random_bytes(NONCE_LEN)?;

    let key = derive_key(&salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, zip_bytes)
        .map_err(|e| format!("加密失败: {e}"))?;

    let mut out = Vec::with_capacity(HEADER_LEN + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.push(VERSION);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

fn decrypt_zip(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < HEADER_LEN + 16 {
        return Err("不是有效的加密笔记文件".to_string());
    }
    if &data[0..4] != MAGIC {
        return Err("不是有效的加密笔记文件".to_string());
    }
    if data[4] != VERSION {
        return Err("不支持的加密笔记版本".to_string());
    }
    let salt = &data[5..5 + SALT_LEN];
    let nonce_bytes = &data[5 + SALT_LEN..HEADER_LEN];
    let ciphertext = &data[HEADER_LEN..];

    let key = derive_key(salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "无法解密该笔记".to_string())
}

fn write_zip(
    markdown_name: &str,
    markdown: &str,
    resources: &[(String, Vec<u8>)],
) -> Result<Vec<u8>, String> {
    let safe_md_name = Path::new(markdown_name)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "note.md".to_string());

    let mut cursor = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut cursor);
        let file_options = FileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o644);
        let dir_options = FileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o755);

        zip.start_file(&safe_md_name, file_options)
            .map_err(|e| e.to_string())?;
        zip.write_all(markdown.as_bytes())
            .map_err(|e| e.to_string())?;

        zip.add_directory(".resources/", dir_options)
            .map_err(|e| e.to_string())?;

        let mut used_names = HashSet::new();
        used_names.insert(safe_md_name);
        for (name, bytes) in resources {
            let archive_name = normalize_resource_name(name);
            if !used_names.insert(archive_name.clone()) {
                continue;
            }
            zip.start_file(&archive_name, file_options)
                .map_err(|e| e.to_string())?;
            zip.write_all(bytes).map_err(|e| e.to_string())?;
        }
        zip.finish().map_err(|e| e.to_string())?;
    }
    Ok(cursor.into_inner())
}

fn read_zip(zip_bytes: &[u8]) -> Result<MdePackage, String> {
    let cursor = Cursor::new(zip_bytes.to_vec());
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;
    let mut markdown_name = String::new();
    let mut markdown = String::new();
    let mut resources = Vec::new();
    let mut root_markdowns: Vec<(String, String)> = Vec::new();

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = file.name().replace('\\', "/");
        if file.is_dir() || name.ends_with('/') {
            continue;
        }
        sanitize_entry_name(&name)?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf).map_err(|e| e.to_string())?;

        let is_root_md = name.to_lowercase().ends_with(".md") && !name.contains('/');
        let is_nested_md = name.to_lowercase().ends_with(".md") && !name.starts_with(".resources/");
        if is_root_md || (markdown.is_empty() && is_nested_md) {
            let text = String::from_utf8(buf).map_err(|_| "Markdown 不是有效的 UTF-8".to_string())?;
            root_markdowns.push((name, text));
        } else {
            resources.push((name, buf));
        }
    }

    root_markdowns.sort_by(|a, b| a.0.cmp(&b.0));
    if let Some((name, text)) = root_markdowns.into_iter().next() {
        markdown_name = name;
        markdown = text;
    }
    if markdown_name.is_empty() {
        return Err("压缩包中没有 Markdown 文件".to_string());
    }

    Ok(MdePackage {
        markdown_name,
        markdown,
        resources,
    })
}

fn gather_resources(
    markdown: &str,
    source_path: Option<&Path>,
    vault_path: Option<&Path>,
) -> Result<(String, Vec<(String, Vec<u8>)>), String> {
    let source_dir = source_path.and_then(|p| p.parent()).map(Path::to_path_buf);
    let work = source_path.map(work_dir);
    let mut lookup_dirs: Vec<PathBuf> = Vec::new();
    if let Some(dir) = &source_dir {
        lookup_dirs.push(dir.clone());
    }
    if let Some(dir) = &work {
        if !lookup_dirs.iter().any(|existing| existing == dir) {
            lookup_dirs.push(dir.clone());
        }
    }

    let mut used_names: HashSet<String> = HashSet::new();
    let mut resources: Vec<(String, Vec<u8>)> = Vec::new();
    let mut replacements: Vec<(String, String)> = Vec::new();
    let mut copied: HashSet<PathBuf> = HashSet::new();

    for dir in &lookup_dirs {
        let existing = dir.join(".resources");
        if existing.is_dir() {
            for (rel, path) in collect_dir_files(&existing, ".resources") {
                if let Ok(bytes) = fs::read(&path) {
                    copied.insert(canonicalize_or_clone(&path));
                    used_names.insert(
                        Path::new(&rel)
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| rel.clone()),
                    );
                    resources.push((rel, bytes));
                }
            }
        }
    }

    let refs = collect_local_refs(markdown);
    for raw in refs {
        if is_remote_or_anchor(&raw) {
            continue;
        }
        let decoded = decode_ref(&raw);
        if decoded.replace('\\', "/").starts_with(".resources/") {
            continue;
        }
        let Some(resolved) = resolve_ref(
            &lookup_dirs,
            vault_path,
            &decoded,
        ) else {
            continue;
        };
        let canon = canonicalize_or_clone(&resolved);
        if copied.contains(&canon) {
            if let Some(name) = resolved.file_name() {
                let dest = format!(".resources/{}", name.to_string_lossy());
                replacements.push((raw, dest));
            }
            continue;
        }
        let file_name = unique_file_name(&mut used_names, &resolved);
        let dest = format!(".resources/{file_name}");
        match fs::read(&resolved) {
            Ok(bytes) => {
                copied.insert(canon);
                resources.push((dest.clone(), bytes));
                replacements.push((raw, dest));
            }
            Err(_) => continue,
        }
    }

    Ok((rewrite_markdown(markdown, &replacements), resources))
}

fn collect_local_refs(markdown: &str) -> Vec<String> {
    let mut refs = Vec::new();
    let md_url = Regex::new(r"\]\(\s*<?([^>\s)]+)>?").expect("markdown url regex");
    let html_url = Regex::new(r#"(?i)(?:src|href)\s*=\s*["']([^"']+)["']"#).expect("html url regex");
    let wiki_embed = Regex::new(r"!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]").expect("wiki embed regex");
    let wiki_link = Regex::new(r"(?:^|[^!])\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]").expect("wiki link regex");

    for caps in md_url.captures_iter(markdown) {
        if let Some(url) = caps.get(1) {
            refs.push(url.as_str().to_string());
        }
    }
    for caps in html_url.captures_iter(markdown) {
        if let Some(url) = caps.get(1) {
            refs.push(url.as_str().to_string());
        }
    }
    for caps in wiki_embed.captures_iter(markdown) {
        if let Some(target) = caps.get(1) {
            refs.push(target.as_str().trim().to_string());
        }
    }
    for caps in wiki_link.captures_iter(markdown) {
        if let Some(target) = caps.get(1) {
            let value = target.as_str().trim().to_string();
            if looks_like_attachment(&value) {
                refs.push(value);
            }
        }
    }

    let mut seen = HashSet::new();
    refs.retain(|item| {
        !is_remote_or_anchor(item) && seen.insert(item.clone())
    });
    refs
}

fn rewrite_markdown(markdown: &str, replacements: &[(String, String)]) -> String {
    let mut pairs: Vec<(String, String)> = replacements
        .iter()
        .filter(|(from, to)| from != to)
        .cloned()
        .collect();
    pairs.sort_by(|a, b| b.0.len().cmp(&a.0.len()));

    let mut out = markdown.to_string();
    for (from, to) in pairs {
        out = out.replace(&from, &to);
    }
    out
}

fn resolve_ref(source_dirs: &[PathBuf], vault_path: Option<&Path>, raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let candidate = PathBuf::from(trimmed);
    if candidate.is_absolute() && candidate.is_file() {
        return Some(candidate);
    }
    for dir in source_dirs {
        let rel = dir.join(&candidate);
        if rel.is_file() {
            return Some(rel);
        }
    }
    if let Some(vault) = vault_path {
        let rel = vault.join(&candidate);
        if rel.is_file() {
            return Some(rel);
        }
        let name = candidate
            .file_name()
            .map(|n| n.to_string_lossy().to_lowercase())?;
        for entry in WalkDir::new(vault).into_iter().filter_map(|e| e.ok()) {
            if !entry.file_type().is_file() {
                continue;
            }
            if entry
                .file_name()
                .to_string_lossy()
                .to_lowercase()
                == name
            {
                return Some(entry.path().to_path_buf());
            }
        }
    }
    None
}

fn collect_dir_files(dir: &Path, prefix: &str) -> Vec<(String, PathBuf)> {
    let mut files = Vec::new();
    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(dir)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        if rel.is_empty() || rel.contains("..") {
            continue;
        }
        files.push((format!("{prefix}/{rel}"), entry.path().to_path_buf()));
    }
    files
}

fn unique_file_name(used: &mut HashSet<String>, path: &Path) -> String {
    let original = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "file.bin".to_string());
    if used.insert(original.clone()) {
        return original;
    }
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    for i in 2..10_000 {
        let candidate = format!("{stem}-{i}{ext}");
        if used.insert(candidate.clone()) {
            return candidate;
        }
    }
    format!("{stem}-{}.bin", chrono::Utc::now().timestamp_millis())
}

fn sanitize_entry_name(name: &str) -> Result<PathBuf, String> {
    let normalized = name.replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized.starts_with("../")
        || normalized.contains("/../")
        || normalized.contains("..")
        || Path::new(&normalized).is_absolute()
    {
        return Err("压缩包内含非法路径".to_string());
    }
    Ok(PathBuf::from(normalized))
}

fn strip_resources_prefix(path: &Path) -> PathBuf {
    let text = path.to_string_lossy().replace('\\', "/");
    if let Some(rest) = text.strip_prefix(".resources/") {
        PathBuf::from(rest)
    } else {
        path.file_name()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("file.bin"))
    }
}

fn normalize_resource_name(name: &str) -> String {
    let normalized = name.replace('\\', "/");
    if normalized.starts_with(".resources/") {
        normalized
    } else {
        format!(
            ".resources/{}",
            Path::new(&normalized)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| normalized)
        )
    }
}

fn is_remote_or_anchor(value: &str) -> bool {
    let lower = value.trim().to_ascii_lowercase();
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("mailto:")
        || lower.starts_with("data:")
        || lower.starts_with("obsidian://")
        || lower.starts_with('#')
}

fn decode_ref(raw: &str) -> String {
    raw.trim().replace("%20", " ")
}

fn looks_like_attachment(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    ATTACHMENT_EXTS.iter().any(|ext| lower.ends_with(ext))
}

fn canonicalize_or_clone(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn hide_dot_resources(path: &Path) {
    #[cfg(windows)]
    {
        if let Some(p) = path.to_str() {
            let _ = std::process::Command::new("attrib").args(["+H", p]).status();
        }
    }
    #[cfg(not(windows))]
    {
        let _ = path;
    }
}

pub fn ext_lower(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default()
}

pub fn is_encrypted_note(path: &Path) -> bool {
    let ext = ext_lower(path);
    ext == NATIVE_EXT || ext == LEGACY_EXPORT_EXT
}

pub fn is_note_file(path: &Path) -> bool {
    matches!(ext_lower(path).as_str(), "mdte" | "mde" | "md")
}

pub fn note_rank(path: &Path) -> u8 {
    match ext_lower(path).as_str() {
        "mdte" => 0,
        "mde" => 1,
        "md" => 2,
        _ => 9,
    }
}

pub fn with_native_ext(path: &Path) -> PathBuf {
    if ext_lower(path) == NATIVE_EXT {
        path.to_path_buf()
    } else {
        path.with_extension(NATIVE_EXT)
    }
}

pub fn with_working_ext(path: &Path) -> PathBuf {
    if ext_lower(path) == WORKING_EXT {
        path.to_path_buf()
    } else {
        path.with_extension(WORKING_EXT)
    }
}

/// Write the plaintext working copy. Does not encrypt.
pub fn save_working_note(path: &Path, markdown: &str) -> Result<PathBuf, String> {
    let dest = with_working_ext(path);
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&dest, markdown).map_err(|e| e.to_string())?;
    Ok(dest)
}

pub fn work_dir(note_path: &Path) -> PathBuf {
    let stem = note_path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "note".to_string());
    note_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!(".{stem}"))
}

fn resources_dir(note_path: &Path) -> PathBuf {
    work_dir(note_path).join(".resources")
}

/// Copy a local Office (or other) file into the note's `.resources` folder.
/// Returns the markdown-relative path, e.g. `.resources/slides.pptx`.
pub fn copy_into_note_resources(note_path: &Path, source_path: &Path) -> Result<String, String> {
    if !source_path.is_file() {
        return Err("源文件不存在".to_string());
    }
    let resources = resources_dir(note_path);
    fs::create_dir_all(&resources).map_err(|e| e.to_string())?;

    let mut used: HashSet<String> = HashSet::new();
    if let Ok(entries) = fs::read_dir(&resources) {
        for entry in entries.flatten() {
            used.insert(entry.file_name().to_string_lossy().into_owned());
        }
    }
    let file_name = unique_file_name(&mut used, source_path);
    let dest = resources.join(&file_name);
    fs::copy(source_path, &dest).map_err(|e| e.to_string())?;
    Ok(format!(".resources/{file_name}"))
}

pub fn read_note_markdown(path: &Path) -> Result<String, String> {
    if is_encrypted_note(path) {
        let data = fs::read(path).map_err(|e| e.to_string())?;
        Ok(decode_mde(&data)?.markdown)
    } else {
        fs::read_to_string(path).map_err(|e| e.to_string())
    }
}

pub fn open_note(path: &Path) -> Result<String, String> {
    if is_encrypted_note(path) {
        let data = fs::read(path).map_err(|e| e.to_string())?;
        let package = decode_mde(&data)?;
        extract_package(&package, &work_dir(path))?;
        Ok(package.markdown)
    } else {
        fs::read_to_string(path).map_err(|e| e.to_string())
    }
}

pub fn save_native_note(
    path: &Path,
    markdown: &str,
    vault_root: Option<&Path>,
) -> Result<PathBuf, String> {
    let dest = with_native_ext(path);
    let md_name = suggested_markdown_name(Some(&dest), "note");
    let source = if path.exists() { path } else { dest.as_path() };
    let bytes = export_package_bytes(&md_name, markdown, Some(source), vault_root)?;
    write_mde_file(&dest, &bytes)?;
    if let Ok(package) = decode_mde(&bytes) {
        let _ = extract_package(&package, &work_dir(&dest));
    }
    Ok(dest)
}

/// Copy a note to a user-chosen path without changing the vault original.
/// `format` is `"markdown"` (plaintext `.md`) or `"encrypted"` (`.mdte` package).
pub fn export_note_to(
    source_path: Option<&Path>,
    dest: &Path,
    markdown: &str,
    format: &str,
    vault_root: Option<&Path>,
) -> Result<PathBuf, String> {
    match format {
        "markdown" => {
            let dest = dest.with_extension("md");
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(&dest, markdown).map_err(|e| e.to_string())?;
            Ok(dest)
        }
        "encrypted" => {
            let dest = dest.with_extension(NATIVE_EXT);
            let md_name = suggested_markdown_name(Some(&dest), "note");
            let bytes = export_package_bytes(&md_name, markdown, source_path, vault_root)?;
            write_mde_file(&dest, &bytes)?;
            Ok(dest)
        }
        _ => Err("未知导出格式，请选择 Markdown 或加密格式".to_string()),
    }
}

pub fn suggested_markdown_name(source_path: Option<&Path>, fallback: &str) -> String {
    source_path
        .and_then(|p| p.file_stem())
        .map(|s| format!("{}.md", s.to_string_lossy()))
        .filter(|s| s != ".md")
        .unwrap_or_else(|| {
            let stem = fallback.trim();
            if stem.is_empty() {
                "note.md".to_string()
            } else {
                format!("{stem}.md")
            }
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_encrypts_markdown_and_resources() {
        let resources = vec![(".resources/pic.png".to_string(), b"fake-png".to_vec())];
        let encoded = encode_mde("hello.md", "# Hi\n\n![](.resources/pic.png)\n", &resources)
            .expect("encode");
        assert_eq!(&encoded[0..4], b"MDE1");
        assert_ne!(&encoded[0..2], b"PK");

        let decoded = decode_mde(&encoded).expect("decode");
        assert_eq!(decoded.markdown_name, "hello.md");
        assert!(decoded.markdown.contains("# Hi"));
        assert_eq!(decoded.resources.len(), 1);
        assert_eq!(decoded.resources[0].0.replace('\\', "/"), ".resources/pic.png");
        assert_eq!(decoded.resources[0].1, b"fake-png");
    }

    #[test]
    fn decode_rejects_garbage() {
        let err = decode_mde(b"not-an-mde-file").unwrap_err();
        assert!(err.contains("加密笔记"));
    }

    #[test]
    fn save_and_open_native_note_roundtrip() {
        let dir = std::env::temp_dir().join(format!("mdte-roundtrip-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let source = dir.join("demo.md");
        let dest = save_native_note(&source, "# Hello\n\nsecret body\n", None).expect("save");
        assert_eq!(dest.extension().and_then(|e| e.to_str()), Some("mdte"));
        let raw = fs::read(&dest).expect("read bytes");
        assert_eq!(&raw[0..4], b"MDE1");
        assert_ne!(&raw[0..2], b"PK");
        let opened = open_note(&dest).expect("open");
        assert!(opened.contains("# Hello"));
        assert!(opened.contains("secret body"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn native_extension_rewrites_legacy_suffixes() {
        assert_eq!(
            with_native_ext(Path::new("/vault/hello.md")),
            PathBuf::from("/vault/hello.mdte")
        );
        assert_eq!(
            with_native_ext(Path::new("/vault/hello.mde")),
            PathBuf::from("/vault/hello.mdte")
        );
        assert_eq!(
            with_native_ext(Path::new("/vault/hello.mdte")),
            PathBuf::from("/vault/hello.mdte")
        );
        assert!(is_note_file(Path::new("a.mdte")));
        assert!(is_encrypted_note(Path::new("a.mde")));
        assert!(!is_encrypted_note(Path::new("a.md")));
    }

    #[test]
    fn collect_refs_finds_images_and_skips_urls() {
        let md = "![a](./img.png) ![b](https://example.com/x.png) ![[photo.jpg]] [[Note]]";
        let refs = collect_local_refs(md);
        assert!(refs.iter().any(|r| r.contains("img.png")));
        assert!(refs.iter().any(|r| r.contains("photo.jpg")));
        assert!(refs.iter().all(|r| !r.starts_with("http")));
        assert!(refs.iter().all(|r| r != "Note"));
    }

    #[test]
    fn sanitize_rejects_zip_slip() {
        assert!(sanitize_entry_name("../secret").is_err());
        assert!(sanitize_entry_name(".resources/ok.png").is_ok());
    }

    #[test]
    fn copy_office_into_encrypted_note_resources() {
        let dir = std::env::temp_dir().join(format!("mdte-office-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let note = dir.join("demo.mdte");
        fs::write(&note, b"placeholder").expect("note");
        let src = dir.join("slides.pptx");
        fs::write(&src, b"pk").expect("office file");

        let rel = copy_into_note_resources(&note, &src).expect("copy");
        assert_eq!(rel, ".resources/slides.pptx");
        let dest = work_dir(&note).join(".resources").join("slides.pptx");
        assert_eq!(fs::read(&dest).expect("read dest"), b"pk");

        let rel2 = copy_into_note_resources(&note, &src).expect("copy duplicate");
        assert_eq!(rel2, ".resources/slides-2.pptx");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn export_markdown_is_plaintext_encrypted_is_mde1() {
        let dir = std::env::temp_dir().join(format!("mdte-export-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let markdown = "# Hello\n\nexported body\n";

        let md_dest = export_note_to(None, &dir.join("note.mdte"), markdown, "markdown", None)
            .expect("markdown export");
        assert_eq!(md_dest.extension().and_then(|e| e.to_str()), Some("md"));
        assert_eq!(fs::read_to_string(&md_dest).expect("read md"), markdown);
        let md_bytes = fs::read(&md_dest).expect("md bytes");
        assert_ne!(&md_bytes[0..4], b"MDE1");

        let enc_dest = export_note_to(None, &dir.join("note.md"), markdown, "encrypted", None)
            .expect("encrypted export");
        assert_eq!(enc_dest.extension().and_then(|e| e.to_str()), Some("mdte"));
        let enc_bytes = fs::read(&enc_dest).expect("enc bytes");
        assert_eq!(&enc_bytes[0..4], b"MDE1");
        assert_ne!(&enc_bytes[0..2], b"PK");
        let decoded = decode_mde(&enc_bytes).expect("decode export");
        assert!(decoded.markdown.contains("exported body"));

        let err = export_note_to(None, &dir.join("bad"), markdown, "pdf", None).unwrap_err();
        assert!(err.contains("未知导出格式"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn save_working_note_writes_plaintext_markdown() {
        let dir = std::env::temp_dir().join(format!("md-working-save-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let dest = save_working_note(&dir.join("demo.mdte"), "# Hello\n").expect("save");
        assert_eq!(dest.extension().and_then(|e| e.to_str()), Some("md"));
        let bytes = fs::read(&dest).expect("read");
        assert_eq!(fs::read_to_string(&dest).expect("text"), "# Hello\n");
        assert_ne!(&bytes[0..4], b"MDE1");
        let _ = fs::remove_dir_all(&dir);
    }
}
