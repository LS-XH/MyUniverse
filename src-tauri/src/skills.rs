//! Skill packages are independent files; workspace JSON only stores Agent references.
use std::{collections::BTreeMap,fs,path::{Path,PathBuf},hash::{Hash,Hasher},time::{SystemTime,UNIX_EPOCH}};
use serde::{Serialize,Deserialize};
#[derive(Clone,Serialize,Deserialize,Debug)]
pub struct SkillDisk {pub directory:String,pub files:BTreeMap<String,String>,pub revision:String,pub assets:Vec<String>}
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct SkillChange {pub previous_directory:Option<String>,pub expected_revision:Option<String>,pub directory:Option<String>,pub files:BTreeMap<String,String>}
fn component(name:&str)->Result<(),String>{
 if name.is_empty()||name=="."||name==".."||name.ends_with(['.',' '])||name.chars().any(|c|c.is_control()||"/\\:<>\"|?*".contains(c)){return Err("Invalid skill path component".into())}Ok(())
}
fn inside(root:&Path,path:&Path)->Result<(),String>{if path.canonicalize().map_err(|e|e.to_string())?.starts_with(root.canonicalize().map_err(|e|e.to_string())?){Ok(())}else{Err("Skill path is outside its directory".into())}}
fn create_inside(base:&Path,path:&Path)->Result<(),String>{let relative=path.strip_prefix(base).map_err(|e|e.to_string())?;let mut current=base.to_path_buf();inside(base,&current)?;for part in relative.components(){current.push(part);if current.exists(){inside(base,&current)?}else{fs::create_dir(&current).map_err(|e|e.to_string())?;inside(base,&current)?}}Ok(())}
fn skills_root(root:&Path)->Result<PathBuf,String>{fs::create_dir_all(root).map_err(|e|e.to_string())?;let dir=root.join("skills");fs::create_dir_all(&dir).map_err(|e|e.to_string())?;inside(root,&dir)?;Ok(dir)}
fn revision(files:&BTreeMap<String,String>)->String{let mut hash=std::collections::hash_map::DefaultHasher::new();files.hash(&mut hash);format!("{:x}",hash.finish())}
fn read_tree(base:&Path,dir:&Path,files:&mut BTreeMap<String,String>,assets:&mut Vec<String>,depth:usize)->Result<(),String>{
 if depth>8{return Err("Skill resource nesting exceeds 8 levels".into())}
 inside(base,dir)?;
 for entry in fs::read_dir(dir).map_err(|e|e.to_string())?{let entry=entry.map_err(|e|e.to_string())?;let path=entry.path();let label=entry.file_name().to_string_lossy().to_string();if label.starts_with('.')&&label!=".myuniverse.json"{continue}inside(base,&path)?;
  let relative=path.strip_prefix(base).map_err(|e|e.to_string())?.to_string_lossy().replace('\\',"/");let kind=entry.file_type().map_err(|e|e.to_string())?;
  if kind.is_symlink(){return Err("Skill resources cannot be symbolic links".into())}
  if kind.is_dir(){read_tree(base,&path,files,assets,depth+1)?}else if kind.is_file(){
   if relative.starts_with("assets/"){assets.push(relative);continue}
   let managed=relative=="SKILL.md"||relative==".myuniverse.json"||relative=="scripts/tools.json"||relative.starts_with("scripts/")&&relative.ends_with(".js")||relative.starts_with("references/")&&relative.ends_with(".md");
   if managed{if fs::metadata(&path).map_err(|e|e.to_string())?.len()>2*1024*1024{return Err("Skill text file exceeds 2 MB".into())}files.insert(relative,fs::read_to_string(path).map_err(|e|e.to_string())?);}
  }
  if files.len()+assets.len()>1024{return Err("Skill contains too many resources".into())}
 }Ok(())
}
fn read_one(root:&Path,name:&str)->Result<SkillDisk,String>{component(name)?;let base=root.join(name);inside(root,&base)?;let mut files=BTreeMap::new();let mut assets=vec![];read_tree(&base,&base,&mut files,&mut assets,0)?;let revision=revision(&files);assets.sort();Ok(SkillDisk{directory:name.into(),files,revision,assets})}
pub fn list_at(root:&Path)->Result<Vec<SkillDisk>,String>{let dir=skills_root(root)?;let mut names=vec![];for entry in fs::read_dir(&dir).map_err(|e|e.to_string())?{let entry=entry.map_err(|e|e.to_string())?;let name=entry.file_name().to_string_lossy().to_string();if !name.starts_with('.')&&entry.file_type().map_err(|e|e.to_string())?.is_dir(){names.push(name)}}if names.len()>256{return Err("Too many skills".into())}names.sort();names.into_iter().map(|name|read_one(&dir,&name)).collect()}
fn stamp()->String{format!("{}",SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos())}
fn safe_relative(value:&str)->Result<(),String>{if value.contains('\\')||value.starts_with('/') {return Err("Invalid skill resource path".into())}for p in value.split('/'){component(p)?}if value=="SKILL.md"||value==".myuniverse.json"||value=="scripts/tools.json"||value.starts_with("scripts/")&&value.ends_with(".js")||value.starts_with("references/")&&value.ends_with(".md"){Ok(())}else{Err("Only Skill instructions, Tool files and Markdown references can be edited".into())}}
pub fn change_at(root:&Path,change:SkillChange)->Result<Option<SkillDisk>,String>{
 let dir=skills_root(root)?;let previous=if let Some(name)=&change.previous_directory{let found=read_one(&dir,name)?;if Some(&found.revision)!=change.expected_revision.as_ref(){return Err("技能文件已在外部变化，请先重新读取；未覆盖磁盘内容".into())}Some(found)}else{None};
 for (path,text) in &change.files{safe_relative(path)?;if text.len()>2*1024*1024{return Err("Skill text file exceeds 2 MB".into())}}
 let Some(name)=&change.directory else{if let Some(old)=previous{let trash=dir.join(".trash");create_inside(&dir,&trash)?;fs::rename(dir.join(&old.directory),trash.join(format!("{}-{}",old.directory,stamp()))).map_err(|e|e.to_string())?;}return Ok(None)};
 component(name)?;if name.starts_with('.')||!change.files.contains_key("SKILL.md"){return Err("Invalid skill package".into())}
 let target=dir.join(name);let old_name=previous.as_ref().map(|p|p.directory.as_str());if old_name!=Some(name)&&target.exists(){return Err("技能目录已存在，请使用不同名称".into())}
 if let Some(old)=old_name{if old!=name{fs::rename(dir.join(old),&target).map_err(|e|e.to_string())?}}
 fs::create_dir_all(&target).map_err(|e|e.to_string())?;inside(&dir,&target)?;
 for child in ["scripts","references","assets"]{create_inside(&target,&target.join(child))?}
 // Validate every existing path before writing any file; assets are never modified here.
 for path in change.files.keys(){let dest=target.join(path);let mut parent=dest.parent().unwrap();while !parent.exists(){parent=parent.parent().ok_or("Invalid resource parent")?}inside(&target,parent)?;if dest.exists(){inside(&target,&dest)?}}
 for (path,text) in &change.files{let dest=target.join(path);if previous.as_ref().and_then(|p|p.files.get(path))==Some(text){continue}create_inside(&target,dest.parent().unwrap())?;let temp=dest.with_extension("tmp");if temp.exists(){inside(&target,&temp)?;}crate::write_atomic(&dest,text)?;}
 if let Some(old)=&previous{let history=target.join(".history").join(stamp());for path in old.files.keys().filter(|p|!change.files.contains_key(*p)){safe_relative(path)?;let src=target.join(path);if src.exists(){inside(&target,&src)?;let dest=history.join(path);create_inside(&target,dest.parent().unwrap())?;fs::rename(src,dest).map_err(|e|e.to_string())?}}}
 read_one(&dir,name).map(Some)
}
#[tauri::command]
pub async fn skill_packages()->Result<Vec<SkillDisk>,String>{tauri::async_runtime::spawn_blocking(||list_at(&crate::user_dir()?)).await.map_err(|e|e.to_string())?}
#[tauri::command]
pub async fn change_skill_package(change:SkillChange)->Result<Option<SkillDisk>,String>{tauri::async_runtime::spawn_blocking(move||change_at(&crate::user_dir()?,change)).await.map_err(|e|e.to_string())?}

#[cfg(test)]
mod tests{
 use super::*;
 fn root()->PathBuf{let p=std::env::temp_dir().join(format!("universe-skills-{}",stamp()));fs::create_dir_all(&p).unwrap();p}
 fn create(name:&str)->SkillChange{SkillChange{previous_directory:None,expected_revision:None,directory:Some(name.into()),files:BTreeMap::from([("SKILL.md".into(),"---\nname: test\ndescription: example\n---\n# test".into())])}}
 #[test]fn packages_are_independent_and_conflicts_do_not_overwrite(){let root=root();let disk=change_at(&root,create("test")).unwrap().unwrap();assert!(root.join("skills/test/assets").is_dir());assert!(!root.join("workspace.json").exists());fs::write(root.join("skills/test/SKILL.md"),"external").unwrap();let mut change=create("test");change.previous_directory=Some("test".into());change.expected_revision=Some(disk.revision);assert!(change_at(&root,change).is_err());assert_eq!(fs::read_to_string(root.join("skills/test/SKILL.md")).unwrap(),"external");fs::remove_dir_all(root).unwrap();}
 #[test]fn paths_assets_and_delete_are_scoped(){let root=root();let mut invalid=create("../escape");assert!(change_at(&root,invalid).is_err());invalid=create("test");invalid.files.insert("assets/overwrite.md".into(),"bad".into());assert!(change_at(&root,invalid).is_err());let disk=change_at(&root,create("test")).unwrap().unwrap();let change=SkillChange{previous_directory:Some("test".into()),expected_revision:Some(disk.revision),directory:None,files:BTreeMap::new()};change_at(&root,change).unwrap();assert!(!root.join("skills/test").exists());assert_eq!(fs::read_dir(root.join("skills/.trash")).unwrap().count(),1);fs::remove_dir_all(root).unwrap();}
 #[test]fn rename_and_reference_removal_preserve_assets(){let root=root();let mut change=create("test");change.files.insert("references/guide.md".into(),"guide".into());let disk=change_at(&root,change).unwrap().unwrap();fs::write(root.join("skills/test/assets/user.txt"),"asset").unwrap();let mut files=disk.files;files.remove("references/guide.md");let change=SkillChange{previous_directory:Some("test".into()),expected_revision:Some(disk.revision),directory:Some("renamed".into()),files};let renamed=change_at(&root,change).unwrap().unwrap();assert_eq!(renamed.assets,vec!["assets/user.txt"]);assert_eq!(fs::read_to_string(root.join("skills/renamed/assets/user.txt")).unwrap(),"asset");assert!(!root.join("skills/renamed/references/guide.md").exists());assert!(root.join("skills/renamed/.history").is_dir());fs::remove_dir_all(root).unwrap();}
}
