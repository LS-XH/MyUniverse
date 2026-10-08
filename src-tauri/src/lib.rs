use serde_json::Value;
use std::{collections::HashMap, fs, path::{Path, PathBuf}};

fn user_dir() -> Result<PathBuf, String> {
    let executable = std::env::current_exe().map_err(|e| e.to_string())?;
    let root = if cfg!(debug_assertions) { std::env::current_dir().map_err(|e| e.to_string())? } else { executable.parent().ok_or("Missing executable directory")?.to_path_buf() };
    Ok(root.join("user"))
}
fn safe_component(name: &str) -> Result<&str, String> {
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\', ':']) { Err("Invalid file name".into()) } else { Ok(name) }
}
fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let temp = path.with_extension("tmp"); fs::write(&temp, contents).map_err(|e| e.to_string())?;
    fs::rename(&temp, path).map_err(|e| e.to_string())
}
#[tauri::command]
fn load_workspace() -> Result<Value, String> {
    let file = user_dir()?.join("workspace.json");
    if !file.exists() { return Ok(serde_json::json!({"worlds":[],"activeWorldId":null})); }
    let data=fs::read_to_string(file).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}
type FileSnapshot = HashMap<String, HashMap<String, Option<String>>>;
#[tauri::command]
fn read_document_files(requests: HashMap<String, Vec<String>>) -> Result<FileSnapshot, String> {
    let root=user_dir()?.join("worlds");
    let mut result=HashMap::new();
    for (world_id, names) in requests {
        let directory=root.join(safe_component(&world_id)?);
        let mut entries=HashMap::new();
        for name in names {
            safe_component(&name)?;
            if !name.ends_with(".md") && !name.ends_with(".schema.json") { return Err("Unsupported document file".into()); }
            let path=directory.join(&name);
            let content=if path.exists() { Some(fs::read_to_string(path).map_err(|e| e.to_string())?) } else { None };
            entries.insert(name,content);
        }
        result.insert(world_id,entries);
    }
    Ok(result)
}
fn verify_expected(directory: &Path, name: &str, expected: &Option<String>) -> Result<(), String> {
    let path=directory.join(safe_component(name)?);
    let actual=if path.exists() { Some(fs::read_to_string(path).map_err(|e| e.to_string())?) } else { None };
    if &actual != expected { return Err("MARKDOWN_CHANGED".into()); }
    Ok(())
}
#[tauri::command]
fn save_workspace(workspace: Value, files: HashMap<String, HashMap<String,String>>, expected: FileSnapshot) -> Result<(), String> {
    save_workspace_at(&user_dir()?, workspace, files, expected)
}
fn save_workspace_at(root: &Path, workspace: Value, files: HashMap<String, HashMap<String,String>>, expected: FileSnapshot) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    // Compare the contents read by the UI before writing anything. An external
    // editor can change a file after the read; the caller then reloads and retries.
    for (world_id, entries) in &files {
        let directory=root.join("worlds").join(safe_component(world_id)?);
        for name in entries.keys().filter(|name| name.ends_with(".md")) {
            let original=expected.get(world_id).and_then(|entries| entries.get(name)).ok_or("Missing Markdown baseline")?;
            verify_expected(&directory,name,original)?;
        }
    }
    for (world_id, entries) in files {
        let directory=root.join("worlds").join(safe_component(&world_id)?);
        fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        for (name, content) in entries {
            let path=directory.join(safe_component(&name)?);
            if name.ends_with(".md") {
                let original=expected.get(&world_id).and_then(|entries| entries.get(&name)).ok_or("Missing Markdown baseline")?;
                verify_expected(&directory,&name,original)?;
            }
            if fs::read_to_string(&path).ok().as_deref()!=Some(content.as_str()) { write_atomic(&path,&content)?; }
        }
    }
    write_atomic(&root.join("workspace.json"),&serde_json::to_string_pretty(&workspace).map_err(|e| e.to_string())?)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn external_file_changes_prevent_all_writes() {
        let suffix=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let root=std::env::temp_dir().join(format!("myuniverse-sync-{}-{}",std::process::id(),suffix));
        let directory=root.join("worlds").join("test-world");
        fs::create_dir_all(&directory).unwrap();
        let file=directory.join("人物列表.md");
        fs::write(&file,"# 人物\n\n## 外部编辑\n").unwrap();
        let files=HashMap::from([("test-world".into(),HashMap::from([("人物列表.md".into(),"# 人物\n\n## 界面编辑\n".into())]))]);
        let stale=HashMap::from([("test-world".into(),HashMap::from([("人物列表.md".into(),Some("# 人物\n".into()))]))]);
        assert_eq!(save_workspace_at(&root,serde_json::json!({}),files.clone(),stale).unwrap_err(),"MARKDOWN_CHANGED");
        assert_eq!(fs::read_to_string(&file).unwrap(),"# 人物\n\n## 外部编辑\n");
        assert!(!root.join("workspace.json").exists());
        let expected=HashMap::from([("test-world".into(),HashMap::from([("人物列表.md".into(),Some(fs::read_to_string(&file).unwrap()))]))]);
        save_workspace_at(&root,serde_json::json!({"worlds":[]}),files,expected).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(),"# 人物\n\n## 界面编辑\n");
        fs::remove_file(file).unwrap();
        fs::remove_file(root.join("workspace.json")).unwrap();
        fs::remove_dir(directory).unwrap();fs::remove_dir(root.join("worlds")).unwrap();fs::remove_dir(root).unwrap();
    }
    #[test]
    fn document_paths_cannot_escape_the_world() {
        for path in ["../secret.md","a/b.md","a\\b.md","C:secret.md","..",""] { assert!(safe_component(path).is_err()); }
        assert!(safe_component("人物列表.md").is_ok());
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_workspace, read_document_files, save_workspace])
        .run(tauri::generate_context!())
        .expect("error while running MyUniverse");
}
