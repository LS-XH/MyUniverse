/** Stateful UTF-8 / line decoder shared by fetch and the native byte channel. */
export class SSEDecoder {
 private decoder=new TextDecoder('utf-8',{fatal:true})
 private buffer=''
 private data:string[]=[]
 private first=true
 push(bytes:Uint8Array):string[]{return this.parse(this.decoder.decode(bytes,{stream:true}))}
 finish():string[]{const events=this.parse(this.decoder.decode(),true);this.buffer='';this.data=[];return events}
 private parse(text:string,final=false):string[]{
  if(this.first&&text){this.first=false;text=text.replace(/^\uFEFF/,'')}
  this.buffer+=text;const events:string[]=[]
  while(true){
   const index=this.buffer.search(/[\r\n]/);if(index<0)break
   if(!final&&this.buffer[index]==='\r'&&index===this.buffer.length-1)break
   const line=this.buffer.slice(0,index),length=this.buffer[index]==='\r'&&this.buffer[index+1]==='\n'?2:1
   this.buffer=this.buffer.slice(index+length)
   if(!line){if(this.data.length)events.push(this.data.join('\n'));this.data=[]}
   else if(line.startsWith('data:'))this.data.push(line.slice(5).replace(/^ /,''))
   else if(line==='data')this.data.push('')
  }
  return events
 }
}
