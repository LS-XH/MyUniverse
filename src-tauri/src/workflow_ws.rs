use std::{collections::HashMap,sync::{Arc,Mutex,OnceLock,atomic::{AtomicBool,Ordering}},time::Duration};
use serde_json::{Value,json};
use tauri::Emitter;
use tungstenite::{client::IntoClientRequest,Message,stream::MaybeTlsStream};
static WATCHERS:OnceLock<Mutex<HashMap<String,Arc<AtomicBool>>>>=OnceLock::new();
fn watchers()->&'static Mutex<HashMap<String,Arc<AtomicBool>>>{WATCHERS.get_or_init(||Mutex::new(HashMap::new()))}
#[tauri::command]
pub fn watch_workflow_events(app:tauri::AppHandle,url:String,client_id:String,api_key:String)->Result<(),String>{
 if client_id.is_empty()||client_id.len()>80||!client_id.chars().all(|c|c.is_ascii_alphanumeric()||c=='-'){return Err("Invalid workflow client ID".into())}
 let parsed=reqwest::Url::parse(&url).map_err(|e|e.to_string())?;if !["ws","wss"].contains(&parsed.scheme())||!parsed.username().is_empty()||parsed.password().is_some(){return Err("Invalid workflow event URL".into())}
 let mut request=url.into_client_request().map_err(|e|e.to_string())?;
 if !api_key.is_empty(){request.headers_mut().insert("Authorization",format!("Bearer {api_key}").parse().map_err(|_|"Invalid API key header")?);}
 let stop=Arc::new(AtomicBool::new(false));if let Some(old)=watchers().lock().map_err(|_|"Watcher unavailable")?.insert(client_id.clone(),stop.clone()){old.store(true,Ordering::Relaxed)}
 std::thread::spawn(move||{
  let channel=format!("workflow_events_{client_id}");let send=|value:Value|{let _=app.emit(&channel,value);};
  let result=(||->Result<(),String>{
   let mut config=tungstenite::protocol::WebSocketConfig::default();config.max_message_size=Some(4*1024*1024);config.max_frame_size=Some(4*1024*1024);
   let (mut socket,_)=tungstenite::client::connect_with_config(request,Some(config),0).map_err(|_|"Workflow event connection failed")?;
   match socket.get_mut(){MaybeTlsStream::Plain(stream)=>stream.set_read_timeout(Some(Duration::from_millis(500))).map_err(|e|e.to_string())?,MaybeTlsStream::NativeTls(stream)=>stream.get_mut().set_read_timeout(Some(Duration::from_millis(500))).map_err(|e|e.to_string())?,_=>{}}
   send(json!({"kind":"ready"}));
   while !stop.load(Ordering::Relaxed){match socket.read(){Ok(Message::Text(text))=>{if let Ok(data)=serde_json::from_str::<Value>(&text){send(json!({"kind":"message","data":data}))}},Ok(Message::Close(_))=>break,Ok(_)=>{},Err(tungstenite::Error::Io(e)) if matches!(e.kind(),std::io::ErrorKind::WouldBlock|std::io::ErrorKind::TimedOut)=>{},Err(_)=>return Err("Workflow event connection closed".into())}}
   let _=socket.close(None);Ok(())
  })();if !stop.load(Ordering::Relaxed){if let Err(error)=result{send(json!({"kind":"unavailable","message":error}))}}
  if let Ok(mut map)=watchers().lock(){if map.get(&client_id).is_some_and(|current|Arc::ptr_eq(current,&stop)){map.remove(&client_id);}}
 });Ok(())
}
#[tauri::command]
pub fn stop_workflow_events(client_id:String)->Result<(),String>{if let Some(stop)=watchers().lock().map_err(|_|"Watcher unavailable")?.remove(&client_id){stop.store(true,Ordering::Relaxed)}Ok(())}

#[cfg(test)]
mod tests {
 use super::*;
 #[test]
 fn native_event_socket_passes_auth_and_reads_execution_message(){
  let listener=std::net::TcpListener::bind("127.0.0.1:0").unwrap();
  let addr=listener.local_addr().unwrap();
  let server=std::thread::spawn(move||{
   let (stream,_)=listener.accept().unwrap();
   let mut ws=tungstenite::accept_hdr(stream,|request:&tungstenite::handshake::server::Request,response:tungstenite::handshake::server::Response|{
    assert_eq!(request.headers().get("Authorization").unwrap(),"Bearer test-only");
    assert_eq!(request.uri().query(),Some("clientId=test-client"));
    assert!(!request.headers().contains_key("Origin"));
    Ok(response)
   }).unwrap();
   ws.send(Message::Text(r#"{"type":"executing","data":{"node":"1","prompt_id":"test"}}"#.into())).unwrap();
  });
  let mut request=format!("ws://{addr}/ws?clientId=test-client").into_client_request().unwrap();
  request.headers_mut().insert("Authorization","Bearer test-only".parse().unwrap());
  let(mut ws,_)=tungstenite::client::connect_with_config(request,None,0).unwrap();
  let message=ws.read().unwrap().into_text().unwrap();
  assert_eq!(serde_json::from_str::<Value>(&message).unwrap()["data"]["node"],"1");
  server.join().unwrap();
 }
}
