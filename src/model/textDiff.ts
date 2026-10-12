export interface DiffLine {kind:'context'|'add'|'remove'|'gap';text:string;before?:number;after?:number}
/** Bounded LCS diff; large changed regions avoid quadratic work. */
export function lineDiff(before:string,after:string,full=false):DiffLine[] {
 const a=before?before.split('\n'):[],b=after?after.split('\n'):[];let prefix=0,suffix=0
 while(prefix<a.length&&prefix<b.length&&a[prefix]===b[prefix])prefix++
 while(suffix<a.length-prefix&&suffix<b.length-prefix&&a[a.length-1-suffix]===b[b.length-1-suffix])suffix++
 const result:DiffLine[]=a.slice(0,prefix).map((text,i)=>({kind:'context',text,before:i+1,after:i+1}))
 const left=a.slice(prefix,a.length-suffix),right=b.slice(prefix,b.length-suffix)
 if(left.length*right.length<=250000){
  const rows=Array.from({length:left.length+1},()=>new Uint32Array(right.length+1))
  for(let i=left.length-1;i>=0;i--)for(let j=right.length-1;j>=0;j--)rows[i][j]=left[i]===right[j]?rows[i+1][j+1]+1:Math.max(rows[i+1][j],rows[i][j+1])
  let i=0,j=0;while(i<left.length||j<right.length){if(i<left.length&&j<right.length&&left[i]===right[j]){result.push({kind:'context',text:left[i],before:prefix+i+1,after:prefix+j+1});i++;j++}else if(j<right.length&&(i===left.length||rows[i][j+1]>=rows[i+1][j])){result.push({kind:'add',text:right[j],after:prefix+j+1});j++}else{result.push({kind:'remove',text:left[i],before:prefix+i+1});i++}}
 }else{left.forEach((text,i)=>result.push({kind:'remove',text,before:prefix+i+1}));right.forEach((text,i)=>result.push({kind:'add',text,after:prefix+i+1}))}
 for(let i=0;i<suffix;i++)result.push({kind:'context',text:a[a.length-suffix+i],before:a.length-suffix+i+1,after:b.length-suffix+i+1})
 if(full)return result
 const changed=result.map((line,i)=>line.kind!=='context'?i:-1).filter(i=>i>=0)
 if(!changed.length)return result.slice(0,6)
 const visible=new Set<number>();for(const index of changed)for(let i=Math.max(0,index-3);i<=Math.min(result.length-1,index+3);i++)visible.add(i)
 const compact:DiffLine[]=[];let previous=-2
 for(const index of [...visible].sort((a,b)=>a-b)){if(index>previous+1&&index>0)compact.push({kind:'gap',text:'…'});compact.push(result[index]);previous=index}
 return compact
}
