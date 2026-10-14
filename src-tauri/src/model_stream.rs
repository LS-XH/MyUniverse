use std::{collections::HashMap,sync::{Mutex,OnceLock},time::Duration};
use serde::Serialize;
use std::{future::{Future,poll_fn},task::Poll};
use serde_json::Value;
use tauri::{ipc::Channel,WebviewWindow};
use tokio::sync::watch;

type Jobs=HashMap<String,(String,watch::Sender<bool>)>;
static JOBS:OnceLock<Mutex<Jobs>>=OnceLock::new();
fn jobs()->&'static Mutex<Jobs>{JOBS.get_or_init(||Mutex::new(HashMap::new()))}
fn transport_error(error:reqwest::Error,reading:bool)->String {
 let category=if error.is_timeout(){"请求超时"}else if error.is_connect(){"无法连接模型服务"}else if reading{"模型响应流读取失败（连接中断或响应传输异常）"}else{"发送模型请求失败"};
 // The outer reqwest message hides the useful cause; exclude the endpoint URL.
 let error=error.without_url();
 let mut details=vec![error.to_string()];
 let mut cause=std::error::Error::source(&error);
 while let Some(source)=cause{details.push(source.to_string());cause=source.source();}
 format!("{}：{}",category,details.join("；"))
}
#[derive(Clone,Serialize)]
#[serde(tag="kind",rename_all="camelCase")]
pub enum StreamEvent {Ready,Chunk{data:Vec<u8>},Complete,Error{error:String}}

async fn pump(url:String,api_key:String,body:Value,timeout_seconds:u64,channel:&Channel<StreamEvent>)->Result<(),String>{
 let target=reqwest::Url::parse(&url).map_err(|e|e.to_string())?;
 if !["http","https"].contains(&target.scheme())||!target.username().is_empty()||target.password().is_some(){return Err("Invalid model endpoint".into())}
 let client=reqwest::Client::builder().timeout(Duration::from_secs(timeout_seconds.clamp(1,600))).redirect(reqwest::redirect::Policy::none()).build().map_err(|e|e.to_string())?;
 let mut request=client.post(target).header("Accept","text/event-stream").json(&body);
 if !api_key.is_empty(){request=request.bearer_auth(api_key)}
 let mut response=request.send().await.map_err(|e|transport_error(e,false))?;
 if !response.status().is_success(){return Err(format!("HTTP {}",response.status()))}
 if !response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|h|h.to_str().ok()).unwrap_or("").to_ascii_lowercase().contains("text/event-stream"){return Err("Service did not return SSE".into())}
 let mut size=0usize;
 while let Some(chunk)=response.chunk().await.map_err(|e|transport_error(e,true))?{
  size+=chunk.len();if size>32_000_000{return Err("Model response too large".into())}
  channel.send(StreamEvent::Chunk{data:chunk.to_vec()}).map_err(|_|"Stream channel closed")?;
 }
 channel.send(StreamEvent::Complete).map_err(|_|"Stream channel closed")?;Ok(())
}
async fn cancellable<T>(future:impl Future<Output=Result<T,String>>,mut receiver:watch::Receiver<bool>)->Result<T,String>{
 if *receiver.borrow(){return Err("Stream cancelled".into())}
 let mut future=Box::pin(future);let mut cancelled=Box::pin(receiver.changed());
 poll_fn(|cx|{if cancelled.as_mut().poll(cx).is_ready(){return Poll::Ready(Err("Stream cancelled".into()))}future.as_mut().poll(cx)}).await
}
#[tauri::command]
pub async fn model_stream(window:WebviewWindow,url:String,api_key:String,body:Value,timeout_seconds:u64,request_id:String,channel:Channel<StreamEvent>)->Result<(),String>{
 if request_id.len()!=36||!request_id.chars().all(|c|c.is_ascii_hexdigit()||c=='-'){return Err("Invalid stream request ID".into())}
 let (sender,receiver)=watch::channel(false);
 {let mut map=jobs().lock().map_err(|_|"Stream registry unavailable")?;if map.contains_key(&request_id){return Err("Duplicate stream request ID".into())}map.insert(request_id.clone(),(window.label().to_string(),sender));}
 let result=match channel.send(StreamEvent::Ready){Ok(())=>cancellable(pump(url,api_key,body,timeout_seconds,&channel),receiver).await,Err(_)=>Err("Stream channel closed".into())};
 if let Ok(mut map)=jobs().lock(){map.remove(&request_id);}
 if let Err(error)=&result{let _=channel.send(StreamEvent::Error{error:error.clone()});}
 result
}
#[tauri::command]
pub fn cancel_model_stream(window:WebviewWindow,request_id:String)->Result<(),String>{
 let map=jobs().lock().map_err(|_|"Stream registry unavailable")?;
 if let Some((owner,sender))=map.get(&request_id){if owner!=window.label(){return Err("Stream belongs to another window".into())}let _=sender.send(true);}
 Ok(())
}

#[cfg(test)]
mod tests {
 use super::*;
 use std::{io::{Read,Write},net::TcpListener,thread};
 #[test]
 fn native_sse_passes_post_auth_and_bytes(){
  let listener=TcpListener::bind("127.0.0.1:0").unwrap();let url=format!("http://{}",listener.local_addr().unwrap());
  let server=thread::spawn(move||{
   let(mut socket,_)=listener.accept().unwrap();socket.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
   // Drain the complete POST before closing: unread request bytes can reset the
   // socket on Windows and truncate an otherwise valid response nondeterministically.
   let mut bytes=Vec::new();let mut buffer=[0u8;8192];
   loop {
    let count=socket.read(&mut buffer).unwrap();assert!(count>0,"request ended before its body");bytes.extend_from_slice(&buffer[..count]);
    if let Some(end)=bytes.windows(4).position(|part|part==b"\r\n\r\n"){
     let headers=String::from_utf8_lossy(&bytes[..end]);
     let length=headers.lines().find_map(|line|{let(key,value)=line.split_once(':')?;if key.eq_ignore_ascii_case("content-length"){value.trim().parse::<usize>().ok()}else{None}}).unwrap();
     if bytes.len()>=end+4+length {break;}
    }
   }
   let request=String::from_utf8_lossy(&bytes);assert!(request.starts_with("POST"));assert!(request.to_lowercase().contains("authorization: bearer dummy"));assert!(request.contains("\"stream\":true"));
   let body="data: {\"choices\":[]}\n\ndata: [DONE]\n\n";write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
  });
  let collected=std::sync::Arc::new(Mutex::new(Vec::<u8>::new()));let copy=collected.clone();
  let channel=Channel::new(move|body|{if let tauri::ipc::InvokeResponseBody::Json(text)=body{let value:Value=serde_json::from_str(&text).unwrap();if value["kind"]=="chunk"{copy.lock().unwrap().extend(value["data"].as_array().unwrap().iter().map(|n|n.as_u64().unwrap() as u8));}}Ok(())});
  tauri::async_runtime::block_on(pump(url,"dummy".into(),serde_json::json!({"stream":true}),5,&channel)).unwrap();server.join().unwrap();assert!(String::from_utf8(collected.lock().unwrap().clone()).unwrap().contains("[DONE]"));
 }
 #[test]
 fn truncated_response_exposes_read_failure_and_cause(){
  let listener=TcpListener::bind("127.0.0.1:0").unwrap();let url=format!("http://{}",listener.local_addr().unwrap());
  let server=thread::spawn(move||{let(mut socket,_)=listener.accept().unwrap();let mut buffer=[0u8;8192];socket.read(&mut buffer).unwrap();write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: 1000\r\nConnection: close\r\n\r\ndata: partial\n\n").unwrap();});
  let channel=Channel::new(|_|Ok(()));
  let error=tauri::async_runtime::block_on(pump(url.clone(),String::new(),serde_json::json!({"stream":true}),5,&channel)).unwrap_err();server.join().unwrap();
  assert!(error.contains("模型响应流读取失败"));assert!(error.contains("；"));assert!(!error.contains(&url));
 }
 #[test]
 fn cancel_drops_pending_request(){
  tauri::async_runtime::block_on(async{let(sender,receiver)=watch::channel(false);sender.send(true).unwrap();let result=cancellable(std::future::pending::<Result<(),String>>(),receiver).await;assert!(result.is_err());});
 }
}
