export interface DiffLine {kind:'context'|'add'|'remove'|'gap';text:string;before?:number;after?:number}
/** Bounded LCS diff; large changed regions avoid quadratic work. */
export function lineDiff(before:string,after:string,full=false):DiffLine[] {
 const a=before?before.split('\n'):[],b=after?after.split('\n'):[],result:DiffLine[]=[]
 const context=(i:number,j:number)=>result.push({kind:'context',text:a[i],before:i+1,after:j+1})
 function range(al:number,ar:number,bl:number,br:number,depth=0){
  while(al<ar&&bl<br&&a[al]===b[bl])context(al++,bl++)
  let suffix=0;while(al<ar-suffix&&bl<br-suffix&&a[ar-1-suffix]===b[br-1-suffix])suffix++
  const ae=ar-suffix,be=br-suffix,n=ae-al,m=be-bl
  if(n*m<=250000){
   const rows=Array.from({length:n+1},()=>new Uint32Array(m+1))
   for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)rows[i][j]=a[al+i]===b[bl+j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1])
   let i=0,j=0;while(i<n||j<m){if(i<n&&j<m&&a[al+i]===b[bl+j]){context(al+i++,bl+j++)}else if(j<m&&(i===n||rows[i][j+1]>=rows[i+1][j])){result.push({kind:'add',text:b[bl+j],after:bl+j+1});j++}else{result.push({kind:'remove',text:a[al+i],before:al+i+1});i++}}
  }else{
   // Patience anchors divide a large document into small changed regions.
   // Unique instance headings remain context even when every instance gains a field.
   const left=new Map<string,number>(),right=new Map<string,number>()
   for(let i=al;i<ae;i++)left.set(a[i],left.has(a[i])?-1:i)
   for(let j=bl;j<be;j++)right.set(b[j],right.has(b[j])?-1:j)
   const pairs:[number,number][]=[]
   for(const [text,i] of left){const j=right.get(text);if(i>=0&&j!==undefined&&j>=0)pairs.push([i,j])}
   const tails:number[]=[],previous=new Int32Array(pairs.length).fill(-1)
   pairs.forEach((pair,i)=>{let lo=0,hi=tails.length;while(lo<hi){const mid=(lo+hi)>>>1;if(pairs[tails[mid]][1]<pair[1])lo=mid+1;else hi=mid}if(lo)previous[i]=tails[lo-1];tails[lo]=i})
   const anchors:[number,number][]=[];let cursor=tails.at(-1)??-1
   while(cursor>=0){anchors.push(pairs[cursor]);cursor=previous[cursor]}anchors.reverse()
   if(anchors.length&&depth<32){let i=al,j=bl;for(const [ai,bj] of anchors){range(i,ai,j,bj,depth+1);context(ai,bj);i=ai+1;j=bj+1}range(i,ae,j,be,depth+1)}
   else{
    // Linear-space monotone fallback retains shared repeated lines without an
    // unbounded LCS matrix. It may be non-minimal, but never replaces shared text wholesale.
    const positions=new Map<string,number[]>();for(let j=bl;j<be;j++){const list=positions.get(b[j])||[];list.push(j);positions.set(b[j],list)}
    let j=bl
    for(let i=al;i<ae;i++){
     const list=positions.get(a[i])||[];let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>>1;if(list[mid]<j)lo=mid+1;else hi=mid}
     const match=list[lo]
     if(match===undefined){result.push({kind:'remove',text:a[i],before:i+1});continue}
     while(j<match){result.push({kind:'add',text:b[j],after:j+1});j++}context(i,j++)
    }
    while(j<be){result.push({kind:'add',text:b[j],after:j+1});j++}
   }
  }
  for(let i=0;i<suffix;i++)context(ae+i,be+i)
 }
 range(0,a.length,0,b.length)
 if(full)return result
 const changed=result.map((line,i)=>line.kind!=='context'?i:-1).filter(i=>i>=0)
 if(!changed.length)return result.slice(0,6)
 const visible=new Set<number>();for(const index of changed)for(let i=Math.max(0,index-3);i<=Math.min(result.length-1,index+3);i++)visible.add(i)
 const compact:DiffLine[]=[];let previous=-2
 for(const index of [...visible].sort((a,b)=>a-b)){if(index>previous+1&&index>0)compact.push({kind:'gap',text:'…'});compact.push(result[index]);previous=index}
 return compact
}
