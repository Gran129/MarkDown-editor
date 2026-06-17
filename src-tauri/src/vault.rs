use std::fs;
use std::path::{Path, PathBuf};

use regex::Regex;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::commands::{BacklinkResult, GraphData, GraphEdge, GraphNode};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VaultInfo {
    pub path: String,
    pub name: String,
    pub last_opened: u64,
}

pub fn scan_vault(vault_path: &str) -> Result<Vec<FileNode>, String> {
    let root = Path::new(vault_path);
    if !root.exists() {
        return Err("Vault 路径不存在".to_string());
    }
    Ok(scan_dir(root))
}

fn scan_dir(dir: &Path) -> Vec<FileNode> {
    let mut nodes = Vec::new();
    let mut entries: Vec<_> = fs::read_dir(dir)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .filter(|e| {
                    let name = e.file_name().to_string_lossy().to_string();
                    !name.starts_with('.')
                })
                .collect()
        })
        .unwrap_or_default();

    entries.sort_by_key(|e| {
        let is_dir = e.path().is_dir();
        let name = e.file_name().to_string_lossy().to_lowercase();
        (!is_dir, name)
    });

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = path.is_dir();

        if is_dir {
            let children = scan_dir(&path);
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                children: Some(children),
            });
        } else if name.ends_with(".md") {
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }
    nodes
}

pub fn resolve_note(vault_path: &str, note_name: &str) -> Option<String> {
    let target = note_name.to_lowercase();
    for entry in WalkDir::new(vault_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            let path = entry.path();
            if let Some(stem) = path.file_stem() {
                if stem.to_string_lossy().to_lowercase() == target {
                    return Some(path.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

pub fn extract_wiki_links(content: &str) -> Vec<String> {
    let re = Regex::new(r"\[\[([^\]|]+)").unwrap();
    re.captures_iter(content)
        .filter_map(|c| c.get(1).map(|m| m.as_str().trim().to_string()))
        .collect()
}

pub fn build_graph(vault_path: &str) -> Result<GraphData, String> {
    let mut nodes_map: std::collections::HashMap<String, GraphNode> =
        std::collections::HashMap::new();
    let mut edges: Vec<GraphEdge> = Vec::new();

    for entry in WalkDir::new(vault_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if !path.extension().map(|e| e == "md").unwrap_or(false) {
            continue;
        }

        let id = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let content = fs::read_to_string(path).unwrap_or_default();
        let links = extract_wiki_links(&content);

        nodes_map.entry(id.clone()).or_insert(GraphNode {
            id: id.clone(),
            label: id.clone(),
            link_count: 0,
        });

        for link in links {
            edges.push(GraphEdge {
                source: id.clone(),
                target: link.clone(),
            });
            nodes_map.entry(link.clone()).or_insert(GraphNode {
                id: link.clone(),
                label: link.clone(),
                link_count: 0,
            });
            if let Some(node) = nodes_map.get_mut(&id) {
                node.link_count += 1;
            }
        }
    }

    Ok(GraphData {
        nodes: nodes_map.into_values().collect(),
        edges,
    })
}

pub fn update_wiki_links(vault_path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    let re = Regex::new(&format!(
        r"\[\[({})(\|[^\]]+)?\]\]",
        regex::escape(old_name)
    ))
    .map_err(|e| e.to_string())?;

    for entry in WalkDir::new(vault_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if !path.extension().map(|e| e == "md").unwrap_or(false) {
            continue;
        }
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let new_content = re.replace_all(&content, |caps: &regex::Captures| {
            let alias = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            format!("[[{}{}]]", new_name, alias)
        });
        if new_content != content {
            fs::write(path, new_content.as_ref()).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

pub fn collect_md_files(vault_path: &str) -> Vec<PathBuf> {
    WalkDir::new(vault_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file()
                && e.path().extension().map(|ext| ext == "md").unwrap_or(false)
        })
        .map(|e| e.path().to_path_buf())
        .collect()
}

pub fn extract_title(content: &str, path: &Path) -> String {
    if content.starts_with("---") {
        if let Some(end) = content[3..].find("\n---") {
            let fm = &content[3..3 + end];
            for line in fm.lines() {
                if line.starts_with("title:") {
                    return line[6..].trim().trim_matches('"').to_string();
                }
            }
        }
    }
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default()
}

pub fn strip_frontmatter(content: &str) -> String {
    if content.starts_with("---") {
        if let Some(end) = content[3..].find("\n---") {
            return content[3 + end + 4..].trim_start().to_string();
        }
    }
    content.to_string()
}

pub fn extract_tags(content: &str) -> Vec<String> {
    let re = Regex::new(r"(?:^|\s)#([\w\u4e00-\u9fff-]+)").unwrap();
    re.captures_iter(content)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
        .collect()
}

pub fn get_backlinks_from_vault(vault_path: &str, note_name: &str) -> Vec<BacklinkResult> {
    let target = note_name.to_lowercase();
    let link_re = Regex::new(r"\[\[([^\]|]+)").unwrap();
    let mut results = Vec::new();

    for path in collect_md_files(vault_path) {
        let content = fs::read_to_string(&path).unwrap_or_default();
        let body = strip_frontmatter(&content);
        for (line_num, line) in body.lines().enumerate() {
            for cap in link_re.captures_iter(line) {
                if let Some(m) = cap.get(1) {
                    if m.as_str().trim().to_lowercase() == target {
                        results.push(BacklinkResult {
                            source_path: path.to_string_lossy().to_string(),
                            source_title: extract_title(&content, &path),
                            context: format!("L{}: {}", line_num + 1, line.trim()),
                        });
                    }
                }
            }
        }
    }
    results
}
