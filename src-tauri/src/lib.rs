use serde_json::Value;
mod functions;
mod model_http;
mod model_stream;
mod workflow_ws;
use std::{collections::HashMap, fs, path::{Path, PathBuf}};

fn user_dir() -> Result<PathBuf, String> {
    let executable = std::env::current_exe().map_err(|e| e.to_string())?;
    let root = if cfg!(debug_assertions) { std::env::current_dir().map_err(|e| e.to_string())? } else { executable.parent().ok_or("Missing executable directory")?.to_path_buf() };
    Ok(root.join("user"))
}
fn safe_component(name: &str) -> Result<&str, String> {
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\', ':']) { Err("Invalid file name".into()) } else { Ok(name) }
}
fn reveal_target(root: &Path, components: &[String]) -> Result<PathBuf, String> {
    if components.is_empty() { return Err("Missing file location".into()); }
    let mut target=root.to_path_buf();
    for component in components { target.push(safe_component(component)?); }
    let base=root.canonicalize().map_err(|e|e.to_string())?;
    let resolved=target.canonicalize().map_err(|e|format!("File location is unavailable: {e}"))?;
    if !resolved.starts_with(&base) { return Err("File location is outside the user directory".into()); }
    Ok(resolved)
}
#[tauri::command]
fn save_workflow_image(filename:String,data:String)->Result<(),String>{save_workflow_image_at(&user_dir()?,filename,data)}
fn save_workflow_image_at(root:&Path,filename:String,data:String)->Result<(),String>{
    use base64::Engine;
    safe_component(&filename)?;
    if filename.chars().any(|c|c.is_control()||"<>\"|?*".contains(c)){return Err("Invalid image filename".into());}
    let (header,encoded)=data.split_once(',').ok_or("Invalid image data")?;
    if !header.starts_with("data:image/")||!header.ends_with(";base64"){return Err("Expected base64 image".into());}
    let bytes=base64::prelude::BASE64_STANDARD.decode(encoded).map_err(|e|e.to_string())?;
    fs::create_dir_all(root).map_err(|e|e.to_string())?;let base=root.canonicalize().map_err(|e|e.to_string())?;
    let dir=root.join("images");fs::create_dir_all(&dir).map_err(|e|e.to_string())?;let dir=dir.canonicalize().map_err(|e|e.to_string())?;if !dir.starts_with(base){return Err("Image directory outside user directory".into());}
    let target=dir.join(filename);if target.exists(){return Err("Image filename already exists".into());}
    use std::io::Write;let mut file=fs::OpenOptions::new().write(true).create_new(true).open(target).map_err(|e|e.to_string())?;file.write_all(&bytes).map_err(|e|e.to_string())
}
#[tauri::command]
fn reveal_file(components: Vec<String>) -> Result<(), String> {
    let target=reveal_target(&user_dir()?,&components)?;
    #[cfg(target_os="windows")]
    {
        // Explorer cannot select paths with the extended-length canonical prefix.
        let path=target.to_string_lossy();
        let normal=if let Some(unc)=path.strip_prefix(r"\\?\UNC\") {format!(r"\\{unc}")} else {path.strip_prefix(r"\\?\").unwrap_or(&path).to_string()};
        std::process::Command::new("explorer.exe").arg("/select,").arg(normal).spawn().map_err(|e|e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os="windows"))]
    { let _=target; Err("File selection is currently supported on Windows only".into()) }
}
fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let temp = path.with_extension("tmp"); fs::write(&temp, contents).map_err(|e| e.to_string())?;
    fs::rename(&temp, path).map_err(|e| e.to_string())
}
#[tauri::command]
async fn load_workspace() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move||load_workspace_text_at(&user_dir()?)).await.map_err(|e|e.to_string())?
}
fn load_workspace_text_at(root:&Path)->Result<String,String>{
    let file = root.join("workspace.json");
    if !file.exists() { return Ok(r#"{"worlds":[],"activeWorldId":null}"#.into()); }
    fs::read_to_string(file).map_err(|e| e.to_string())
}

#[tauri::command]
async fn checkpoint_workspace(text:String)->Result<(),String>{
    tauri::async_runtime::spawn_blocking(move||checkpoint_workspace_at(&user_dir()?,&text)).await.map_err(|e|e.to_string())?
}
fn checkpoint_workspace_at(root:&Path,text:&str)->Result<(),String>{
    let workspace:Value=serde_json::from_str(text).map_err(|e|e.to_string())?;
    if !workspace.get("worlds").is_some_and(Value::is_array){return Err("Invalid workspace archive".into());}
    fs::create_dir_all(root).map_err(|e|e.to_string())?;
    let target=root.join("workspace.json");let backup=root.join("workspace.before-json-primary.json");
    if target.exists()&&!backup.exists(){
        let previous=fs::read_to_string(&target).map_err(|e|e.to_string())?;
        let old:Value=serde_json::from_str(&previous).map_err(|e|e.to_string())?;
        if old.get("archiveVersion").and_then(Value::as_u64)!=Some(2){write_atomic(&backup,&previous)?;}
    }
    write_atomic(&target,text)
}
#[tauri::command]
async fn export_workspace(workspace:Value,files:HashMap<String,HashMap<String,String>>)->Result<(),String>{
    tauri::async_runtime::spawn_blocking(move||{
        let root=user_dir()?;
        // Reuse the export implementation in an isolated output function: the
        // authoritative workspace.json is never replaced by a scoped projection.
        export_workspace_at(&root,workspace,files)
    }).await.map_err(|e|e.to_string())?
}
type FileSnapshot = HashMap<String, HashMap<String, Option<String>>>;
#[tauri::command]
async fn read_document_files(requests: HashMap<String, Vec<String>>) -> Result<FileSnapshot, String> {
    tauri::async_runtime::spawn_blocking(move||read_document_files_at(&user_dir()?,requests)).await.map_err(|e|e.to_string())?
}
fn read_document_files_at(root:&Path,requests:HashMap<String,Vec<String>>)->Result<FileSnapshot,String>{
    let root=root.join("worlds");
    let mut result=HashMap::new();
    for (world_id, names) in requests {
        let directory=root.join(safe_component(&world_id)?);
        let mut entries=HashMap::new();
        for name in names {
            safe_component(&name)?;
            if !name.ends_with(".md") && !name.ends_with(".schema.json") && !name.ends_with(".view.json") { return Err("Unsupported document file".into()); }
            let path=directory.join(&name);
            let content=if path.exists() { Some(fs::read_to_string(path).map_err(|e| e.to_string())?) } else { None };
            entries.insert(name,content);
        }
        result.insert(world_id,entries);
    }
    Ok(result)
}
#[tauri::command]
async fn run_function(language:String,code:String,input:String,world:Option<Value>,api:Option<String>,context:Option<Value>,runtime_api:Option<String>,contract:Option<Value>,bridge:Option<bool>)->Result<String,String> {
    let root=user_dir()?;
    tauri::async_runtime::spawn_blocking(move||functions::execute_with_context_bridge(&root,&language,&code,&input,&world.unwrap_or(serde_json::json!({"classes":[]})),&api.unwrap_or_default(),&context.unwrap_or(Value::Null),&runtime_api.unwrap_or_default(),&contract.unwrap_or(Value::Null),bridge.unwrap_or(false))).await.map_err(|e|e.to_string())?
}
fn export_workspace_at(root: &Path, workspace: Value, files: HashMap<String, HashMap<String,String>>) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    for (world_id, entries) in files {
        let directory=root.join("worlds").join(safe_component(&world_id)?);
        fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        for (name, content) in entries {
            let path=directory.join(safe_component(&name)?);
            write_atomic(&path,&content)?;
        }
    }
    if let Some(scripts)=workspace.get("functions").and_then(Value::as_array) {
        let directory=root.join("functions");fs::create_dir_all(&directory).map_err(|e|e.to_string())?;
        let previous=fs::read_to_string(root.join("workspace.json")).ok().and_then(|text|serde_json::from_str::<Value>(&text).ok());
        for script in scripts {
            let id=script.get("id").and_then(Value::as_str).ok_or("Missing function id")?;
            let language=script.get("language").and_then(Value::as_str).ok_or("Missing function language")?;
            if !["js","py","flow"].contains(&language) {return Err("Invalid function language".into());}
            safe_component(id)?;
            let code=if language=="flow" {serde_json::to_string_pretty(script.get("flow").ok_or("Missing flow graph")?).map_err(|e|e.to_string())?}else {script.get("code").and_then(Value::as_str).ok_or("Missing function code")?.to_string()};
            let path=directory.join(format!("{}.{}",id,language));
            write_atomic(&path,&code)?;
        }
        if let Some(old)=previous.as_ref().and_then(|value|value.get("functions")).and_then(Value::as_array) {
            for script in old {
                if let (Some(id),Some(language))=(script.get("id").and_then(Value::as_str),script.get("language").and_then(Value::as_str)) {
                    if safe_component(id).is_ok() && ["js","py","flow"].contains(&language) && !scripts.iter().any(|item|item.get("id").and_then(Value::as_str)==Some(id)&&item.get("language").and_then(Value::as_str)==Some(language)) {
                        let path=directory.join(format!("{}.{}",id,language));
                        if path.exists() {fs::remove_file(path).map_err(|e|e.to_string())?;}
                    }
                }
            }
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn json_archive_is_authoritative_and_export_never_replaces_it(){
        let suffix=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let root=std::env::temp_dir().join(format!("myuniverse-json-{}-{suffix}",std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let old=r#"{"worlds":[],"activeWorldId":null}"#;
        fs::write(root.join("workspace.json"),old).unwrap();
        let next=r#"{"archiveVersion":2,"worlds":[],"functions":[],"activeWorldId":null}"#;
        checkpoint_workspace_at(&root,next).unwrap();
        assert_eq!(fs::read_to_string(root.join("workspace.before-json-primary.json")).unwrap(),old);
        let files=HashMap::from([("world".into(),HashMap::from([("人物.md".into(),"# 人物\n".into())]))]);
        export_workspace_at(&root,serde_json::json!({"worlds":[]}),files).unwrap();
        assert_eq!(fs::read_to_string(root.join("workspace.json")).unwrap(),next);
        assert!(checkpoint_workspace_at(&root,"broken").is_err());
        assert_eq!(fs::read_to_string(root.join("workspace.json")).unwrap(),next);
        checkpoint_workspace_at(&root,next).unwrap();
        assert_eq!(fs::read_to_string(root.join("workspace.before-json-primary.json")).unwrap(),old);
        fs::remove_dir_all(&root).unwrap();
    }
    #[test]
    fn startup_ignores_broken_markdown_and_external_function_exports(){
        let suffix=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let root=std::env::temp_dir().join(format!("myuniverse-json-load-{}-{suffix}",std::process::id()));
        fs::create_dir_all(root.join("functions")).unwrap();fs::create_dir_all(root.join("worlds/w")).unwrap();
        let value=serde_json::json!({"worlds":[{"id":"w","documents":[{"id":"a","fileName":"人物.md","entities":[{"id":"stable","name":"JSON 人物"}]}]}],"functions":[{"id":"fn","language":"js","code":"JSON code"}]});
        fs::write(root.join("workspace.json"),value.to_string()).unwrap();
        fs::write(root.join("worlds/w/人物.md"),[0xff,0xfe]).unwrap();fs::write(root.join("functions/fn.js"),"external code").unwrap();
        assert_eq!(serde_json::from_str::<Value>(&load_workspace_text_at(&root).unwrap()).unwrap(),value);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn reveal_location_requires_existing_scoped_path() {
        let suffix=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let root=std::env::temp_dir().join(format!("myuniverse-reveal-{}-{suffix}",std::process::id()));
        fs::create_dir(&root).unwrap();
        let name="人物 文件.md";fs::write(root.join(name),"# 人物").unwrap();
        assert_eq!(reveal_target(&root,&[name.into()]).unwrap(),root.join(name).canonicalize().unwrap());
        assert!(reveal_target(&root,&[]).is_err());
        assert!(reveal_target(&root,&["..".into(),name.into()]).is_err());
        assert!(reveal_target(&root,&["C:\\outside.md".into()]).is_err());
        assert!(reveal_target(&root,&["missing.md".into()]).is_err());
        fs::remove_file(root.join(name)).unwrap();fs::remove_dir(root).unwrap();
    }
    #[test]
    fn explicit_save_does_not_read_existing_markdown() {
        let suffix=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let root=std::env::temp_dir().join(format!("myuniverse-sync-{}-{}",std::process::id(),suffix));
        let directory=root.join("worlds").join("test-world");
        fs::create_dir_all(&directory).unwrap();
        let file=directory.join("人物列表.md");
        fs::write(&file,[0xff,0xfe,0x00]).unwrap();
        let files=HashMap::from([("test-world".into(),HashMap::from([("人物列表.md".into(),"# 人物\n\n## 界面编辑\n".into())]))]);
        export_workspace_at(&root,serde_json::json!({"worlds":[]}),files).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(),"# 人物\n\n## 界面编辑\n");
        fs::remove_file(file).unwrap();
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
        .invoke_handler(tauri::generate_handler![load_workspace, checkpoint_workspace, export_workspace, read_document_files, run_function, model_http::model_http,model_stream::model_stream,model_stream::cancel_model_stream, workflow_ws::watch_workflow_events, workflow_ws::stop_workflow_events, reveal_file, save_workflow_image])
        .run(tauri::generate_context!())
        .expect("error while running MyUniverse");
}

#[cfg(test)]
mod workflow_image_tests {
    use super::*;
    #[test]
    fn image_save_is_scoped_and_never_overwrites(){
        let root=std::env::temp_dir().join(format!("my-universe-image-test-{}",std::process::id()));
        fs::create_dir_all(&root).unwrap();let data="data:image/png;base64,aGVsbG8=".to_string();
        assert!(save_workflow_image_at(&root,"../outside.png".into(),data.clone()).is_err());
        assert!(save_workflow_image_at(&root,"a.png".into(),"data:text/plain;base64,aA==".into()).is_err());
        save_workflow_image_at(&root,"a.png".into(),data.clone()).unwrap();
        assert!(save_workflow_image_at(&root,"a.png".into(),data).is_err());
        assert_eq!(fs::read(root.join("images/a.png")).unwrap(),b"hello");
        fs::remove_dir_all(root).unwrap();
    }
}
