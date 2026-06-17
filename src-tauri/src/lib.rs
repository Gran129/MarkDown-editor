mod commands;
mod search;
mod vault;
mod watcher;

use std::sync::Mutex;

pub struct AppState {
    pub vault_path: Mutex<Option<String>>,
    pub search: Mutex<search::SearchIndex>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            vault_path: Mutex::new(None),
            search: Mutex::new(search::SearchIndex::new()),
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_vault_dialog,
            commands::list_recent_vaults,
            commands::add_recent_vault,
            commands::list_files,
            commands::read_file,
            commands::write_file,
            commands::create_file,
            commands::create_folder,
            commands::rename_path,
            commands::delete_path,
            commands::move_path,
            commands::reveal_in_explorer,
            commands::start_vault_watcher,
            commands::index_vault,
            commands::search_notes,
            commands::get_backlinks,
            commands::get_graph_data,
            commands::resolve_note_path,
            commands::update_wiki_links_on_rename,
            commands::load_settings,
            commands::save_settings,
            commands::save_draft,
            commands::load_draft,
            commands::clear_draft,
            commands::list_plugins,
            commands::enable_plugin,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
