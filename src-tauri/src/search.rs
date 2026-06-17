use std::path::Path;
use rusqlite::{params, Connection};

use crate::commands::SearchResult;
use crate::vault::{collect_md_files, extract_tags, extract_title, strip_frontmatter};

pub struct SearchIndex {
    conn: Option<Connection>,
}

impl SearchIndex {
    pub fn new() -> Self {
        Self { conn: None }
    }

    pub fn open(&mut self, db_path: &Path) -> Result<(), String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS documents (
                path TEXT PRIMARY KEY,
                vault_path TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL,
                tags TEXT NOT NULL
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
                path,
                vault_path,
                title,
                body,
                tags,
                content='documents',
                content_rowid='rowid'
            );
            CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
                INSERT INTO documents_fts(rowid, path, vault_path, title, body, tags)
                VALUES (new.rowid, new.path, new.vault_path, new.title, new.body, new.tags);
            END;
            CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
                INSERT INTO documents_fts(documents_fts, rowid, path, vault_path, title, body, tags)
                VALUES('delete', old.rowid, old.path, old.vault_path, old.title, old.body, old.tags);
            END;
            CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
                INSERT INTO documents_fts(documents_fts, rowid, path, vault_path, title, body, tags)
                VALUES('delete', old.rowid, old.path, old.vault_path, old.title, old.body, old.tags);
                INSERT INTO documents_fts(rowid, path, vault_path, title, body, tags)
                VALUES (new.rowid, new.path, new.vault_path, new.title, new.body, new.tags);
            END;
            ",
        )
        .map_err(|e| e.to_string())?;
        self.conn = Some(conn);
        Ok(())
    }

    pub fn index_vault(&self, vault_path: &str) -> Result<(), String> {
        let conn = self.conn.as_ref().ok_or("搜索索引未初始化")?;
        conn.execute(
            "DELETE FROM documents WHERE vault_path = ?1",
            params![vault_path],
        )
        .map_err(|e| e.to_string())?;

        for path in collect_md_files(vault_path) {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            let title = extract_title(&content, &path);
            let body = strip_frontmatter(&content);
            let tags = extract_tags(&content).join(" ");
            conn.execute(
                "INSERT INTO documents (path, vault_path, title, body, tags) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    path.to_string_lossy().to_string(),
                    vault_path,
                    title,
                    body,
                    tags
                ],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn search(&self, vault_path: &str, query: &str) -> Result<Vec<SearchResult>, String> {
        let conn = self.conn.as_ref().ok_or("搜索索引未初始化")?;
        let q = query.trim();
        if q.is_empty() {
            return Ok(vec![]);
        }

        let (sql, param) = if let Some(tag) = q.strip_prefix("tag:") {
            (
                "SELECT path, title, body FROM documents WHERE vault_path = ?1 AND tags LIKE ?2 LIMIT 50",
                format!("%{}%", tag.trim()),
            )
        } else if let Some(path_filter) = q.strip_prefix("path:") {
            (
                "SELECT path, title, body FROM documents WHERE vault_path = ?1 AND path LIKE ?2 LIMIT 50",
                format!("%{}%", path_filter.trim()),
            )
        } else {
            (
                "SELECT d.path, d.title, d.body FROM documents_fts fts
                 JOIN documents d ON d.path = fts.path
                 WHERE documents_fts MATCH ?2 AND d.vault_path = ?1
                 LIMIT 50",
                q.to_string(),
            )
        };

        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![vault_path, param], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut results = Vec::new();
        for row in rows.flatten() {
            let (path, title, body) = row;
            let snippet = body.chars().take(120).collect::<String>();
            results.push(SearchResult {
                path,
                title,
                snippet,
                score: 1.0,
            });
        }
        Ok(results)
    }

    pub fn get_backlinks(
        &self,
        vault_path: &str,
        note_name: &str,
    ) -> Result<Vec<crate::commands::BacklinkResult>, String> {
        Ok(crate::vault::get_backlinks_from_vault(vault_path, note_name))
    }
}
