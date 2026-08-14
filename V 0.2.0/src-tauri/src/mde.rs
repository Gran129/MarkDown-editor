//! Encrypted `.mde` package: a zip of the markdown note plus a hidden `.resources`
//! folder, wrapped in AES-256-GCM. The key is derived with Argon2id from the
//! application-wide passphrase.

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

pub fn import_mde_file(mde_path: &Path, dest_parent: &Path) -> Result<PathBuf, String> {
    let stem = mde_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "note".to_string());

    let dest_dir = unique_or_existing_dir(dest_parent, &stem);
    if dest_dir.is_dir() {
        if let Some(existing) = find_root_markdown(&dest_dir) {
            return Ok(existing);
        }
    }

    let data = fs::read(mde_path).map_err(|e| e.to_string())?;
    let package = decode_mde(&data)?;
    extract_package(&package, &dest_dir)
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
        return Err("不是有效的 .mde 文件".to_string());
    }
    if &data[0..4] != MAGIC {
        return Err("不是有效的 .mde 文件".to_string());
    }
    if data[4] != VERSION {
        return Err("不支持的 .mde 版本".to_string());
    }
    let salt = &data[5..5 + SALT_LEN];
    let nonce_bytes = &data[5 + SALT_LEN..HEADER_LEN];
    let ciphertext = &data[HEADER_LEN..];

    let key = derive_key(salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "无法解密 .mde 文件".to_string())
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
    let mut used_names: HashSet<String> = HashSet::new();
    let mut resources: Vec<(String, Vec<u8>)> = Vec::new();
    let mut replacements: Vec<(String, String)> = Vec::new();
    let mut copied: HashSet<PathBuf> = HashSet::new();

    if let Some(dir) = &source_dir {
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
            source_dir.as_deref(),
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

fn resolve_ref(source_dir: Option<&Path>, vault_path: Option<&Path>, raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let candidate = PathBuf::from(trimmed);
    if candidate.is_absolute() && candidate.is_file() {
        return Some(candidate);
    }
    if let Some(dir) = source_dir {
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

fn unique_or_existing_dir(parent: &Path, stem: &str) -> PathBuf {
    let primary = parent.join(stem);
    if primary.is_dir() {
        if find_root_markdown(&primary).is_some() {
            return primary;
        }
    } else if !primary.exists() {
        return primary;
    }
    for i in 2..10_000 {
        let candidate = parent.join(format!("{stem}-{i}"));
        if !candidate.exists() {
            return candidate;
        }
        if candidate.is_dir() && find_root_markdown(&candidate).is_some() {
            return candidate;
        }
    }
    parent.join(format!("{stem}-{}", chrono::Utc::now().timestamp_millis()))
}

fn find_root_markdown(dir: &Path) -> Option<PathBuf> {
    let mut matches: Vec<PathBuf> = fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("md"))
                .unwrap_or(false)
        })
        .collect();
    matches.sort();
    matches.into_iter().next()
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

pub fn ensure_mde_extension(path: PathBuf) -> PathBuf {
    match path.extension().and_then(|e| e.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("mde") => path,
        _ => path.with_extension("mde"),
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
        assert!(err.contains(".mde"));
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
}
