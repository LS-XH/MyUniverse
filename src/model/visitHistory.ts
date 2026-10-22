export class VisitHistory<T>{
 entries:T[]=[];index=-1
 constructor(private key:(value:T)=>string=JSON.stringify){}
 record(value:T){if(this.index>=0&&this.key(this.entries[this.index])===this.key(value))return;this.entries=this.entries.slice(0,this.index+1);this.entries.push(value);if(this.entries.length>200)this.entries.shift();this.index=this.entries.length-1}
 step(delta:number){const next=this.index+delta;if(next<0||next>=this.entries.length)return;this.index=next;return this.entries[next]}
}
