//! Minimal XMind (.xmind) read/write using the zip+JSON (XMind Zen) format.

use std::fs;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XmindTopic {
    pub id: String,
    pub title: String,
    pub children: Vec<XmindTopic>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XmindDoc {
    pub title: String,
    pub root: XmindTopic,
}

fn read_zip_entry(data: &[u8], name: &str) -> Result<Option<String>, String> {
    let cursor = Cursor::new(data.to_vec());
    let mut archive = ZipArchive::new(cursor).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry = file.name().replace('\\', "/");
        if entry == name || entry.ends_with(&format!("/{name}")) {
            let mut buf = String::new();
            file.read_to_string(&mut buf).map_err(|e| e.to_string())?;
            return Ok(Some(buf));
        }
    }
    Ok(None)
}

fn topic_from_json(value: &Value) -> XmindTopic {
    let id = value
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("topic")
        .to_string();
    let title = value
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("主题")
        .to_string();
    let mut children = Vec::new();
    if let Some(attached) = value
        .pointer("/children/attached")
        .and_then(|v| v.as_array())
    {
        for child in attached {
            children.push(topic_from_json(child));
        }
    }
    XmindTopic { id, title, children }
}

fn topic_to_json(topic: &XmindTopic) -> Value {
    let attached: Vec<Value> = topic.children.iter().map(topic_to_json).collect();
    json!({
        "id": topic.id,
        "class": "topic",
        "title": topic.title,
        "children": { "attached": attached }
    })
}

pub fn load_xmind(path: &Path) -> Result<XmindDoc, String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
    let content = read_zip_entry(&data, "content.json")?
        .ok_or_else(|| "无法解析该 XMind 文件（缺少 content.json）".to_string())?;
    let parsed: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let sheet = parsed
        .as_array()
        .and_then(|arr| arr.first())
        .cloned()
        .or_else(|| parsed.get("rootTopic").cloned().map(|root| json!({"rootTopic": root, "title": "画布 1"})))
        .ok_or_else(|| "XMind 内容为空".to_string())?;
    let title = sheet
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("思维导图")
        .to_string();
    let root = sheet
        .get("rootTopic")
        .ok_or_else(|| "缺少中心主题".to_string())?;
    Ok(XmindDoc {
        title,
        root: topic_from_json(root),
    })
}

fn write_xmind_bytes(doc: &XmindDoc) -> Result<Vec<u8>, String> {
    let content = json!([{
        "id": "sheet-1",
        "class": "sheet",
        "title": doc.title,
        "rootTopic": topic_to_json(&doc.root)
    }]);
    let content_str = serde_json::to_string_pretty(&content).map_err(|e| e.to_string())?;
    let manifest = r#"{"file-entries":{"content.json":{},"metadata.json":{},"manifest.json":{}}}"#;
    let metadata = r#"{"dataVersion":"2.0"}"#;

    let mut cursor = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut cursor);
        let options = FileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .unix_permissions(0o644);
        for (name, body) in [
            ("content.json", content_str.as_str()),
            ("manifest.json", manifest),
            ("metadata.json", metadata),
        ] {
            zip.start_file(name, options).map_err(|e| e.to_string())?;
            zip.write_all(body.as_bytes()).map_err(|e| e.to_string())?;
        }
        zip.finish().map_err(|e| e.to_string())?;
    }
    Ok(cursor.into_inner())
}

pub fn save_xmind(path: &Path, doc: &XmindDoc) -> Result<(), String> {
    let bytes = write_xmind_bytes(doc)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, bytes).map_err(|e| e.to_string())
}

pub fn create_xmind(path: &Path, title: &str) -> Result<PathBuf, String> {
    let dest = if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("xmind")).unwrap_or(false)
    {
        path.to_path_buf()
    } else {
        path.with_extension("xmind")
    };
    let doc = XmindDoc {
        title: title.to_string(),
        root: XmindTopic {
            id: "root".into(),
            title: title.to_string(),
            children: vec![],
        },
    };
    save_xmind(&dest, &doc)?;
    Ok(dest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn xmind_roundtrip() {
        let dir = std::env::temp_dir().join(format!("mdte-xmind-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let path = dir.join("demo.xmind");
        create_xmind(&path, "中心主题").expect("create");
        let loaded = load_xmind(&path).expect("load");
        assert_eq!(loaded.title, "中心主题");
        assert_eq!(loaded.root.title, "中心主题");
        let mut next = loaded.clone();
        next.root.children.push(XmindTopic {
            id: "child".into(),
            title: "子主题".into(),
            children: vec![],
        });
        save_xmind(&path, &next).expect("save");
        let reloaded = load_xmind(&path).expect("reload");
        assert_eq!(reloaded.root.children.len(), 1);
        assert_eq!(reloaded.root.children[0].title, "子主题");
        let _ = fs::remove_dir_all(&dir);
    }
}

