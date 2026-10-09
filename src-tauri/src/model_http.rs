use serde_json::Value;
use std::time::Duration;
use base64::Engine;

#[tauri::command]
pub async fn model_http(url:String,method:String,api_key:String,body:Option<Value>,timeout_seconds:u64,as_image:Option<bool>)->Result<Value,String> {
    let target=reqwest::Url::parse(&url).map_err(|e|e.to_string())?;
    if !["http","https"].contains(&target.scheme())||!target.username().is_empty()||target.password().is_some(){return Err("Invalid model endpoint".into());}
    let client=reqwest::Client::builder().timeout(Duration::from_secs(timeout_seconds.clamp(1,600))).redirect(reqwest::redirect::Policy::none()).build().map_err(|e|e.to_string())?;
    let mut request=match method.as_str(){"GET"=>client.get(target),"POST"=>client.post(target),_=>return Err("Unsupported method".into())};
    if !api_key.is_empty(){request=request.bearer_auth(api_key);}
    if let Some(value)=body{request=request.json(&value);}
    let response=request.send().await.map_err(|e|e.to_string())?;
    let status=response.status().as_u16();
    if response.content_length().unwrap_or(0)>32_000_000{return Err("Model response too large".into());}
    if as_image.unwrap_or(false)&&response.status().is_success(){
        let mime=response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v|v.to_str().ok()).unwrap_or("image/png").to_string();
        if !mime.starts_with("image/"){return Err("Response is not an image".into());}
        let data=response.bytes().await.map_err(|e|e.to_string())?;
        if data.len()>32_000_000{return Err("Image too large".into());}
        return Ok(serde_json::json!({"status":status,"text":format!("data:{};base64,{}",mime,base64::engine::general_purpose::STANDARD.encode(data))}));
    }
    let text=response.text().await.map_err(|e|e.to_string())?;
    if text.len()>32_000_000{return Err("Model response too large".into());}
    Ok(serde_json::json!({"status":status,"text":text}))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{io::{Read,Write},net::TcpListener,thread};
    fn server(body:&'static [u8],mime:&'static str)->(String,thread::JoinHandle<String>){
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();
        let url=format!("http://{}/test",listener.local_addr().unwrap());
        let handle=thread::spawn(move||{
            let (mut stream,_)=listener.accept().unwrap();stream.set_read_timeout(Some(Duration::from_secs(5))).unwrap();
            let mut data=Vec::new();let mut buffer=[0;4096];
            loop{let count=stream.read(&mut buffer).unwrap();if count==0{break}data.extend_from_slice(&buffer[..count]);if let Some(start)=data.windows(4).position(|part|part==b"\r\n\r\n"){
                let header=String::from_utf8_lossy(&data[..start]).to_lowercase();let length=header.lines().find_map(|line|line.strip_prefix("content-length:").and_then(|v|v.trim().parse::<usize>().ok())).unwrap_or(0);if data.len()>=start+4+length{break}
            }}
            write!(stream,"HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",mime,body.len()).unwrap();stream.write_all(body).unwrap();String::from_utf8(data).unwrap()
        });(url,handle)
    }
    #[test]
    fn desktop_json_transport_passes_auth_and_body(){
        let (url,server)=server(br#"{"choices":[{"message":{"content":"ok"}}]}"#,"application/json");
        let response=tauri::async_runtime::block_on(model_http(url,"POST".into(),"dummy-key".into(),Some(serde_json::json!({"model":"test"})),5,None)).unwrap();
        assert_eq!(response["status"],200);assert!(response["text"].as_str().unwrap().contains("choices"));
        let sent=server.join().unwrap();assert!(sent.to_lowercase().contains("authorization: bearer dummy-key"));assert!(sent.contains("\"model\":\"test\""));
    }
    #[test]
    fn desktop_image_transport_returns_a_data_url(){
        let (url,server)=server(b"image-bytes","image/png");
        let response=tauri::async_runtime::block_on(model_http(url,"GET".into(),"".into(),None,5,Some(true))).unwrap();
        assert_eq!(response["text"],"data:image/png;base64,aW1hZ2UtYnl0ZXM=");server.join().unwrap();
    }
    #[test]
    fn rejects_unsupported_urls_before_request(){
        assert!(tauri::async_runtime::block_on(model_http("file:///test".into(),"GET".into(),"".into(),None,5,None)).is_err());
        assert!(tauri::async_runtime::block_on(model_http("http://key:secret@localhost/test".into(),"GET".into(),"".into(),None,5,None)).is_err());
    }
}
