// Final text blocks replace deltas for the same index; reasoning stays private.
export function createModelTextCollector(limit=14000){
 const blocks=new Map();
 return chunk=>{
  if(chunk.type==='text-delta'){
   if(typeof chunk.text!=='string')throw new Error('模型输出无效。');
   blocks.set(chunk.index??0,(blocks.get(chunk.index??0)||'')+chunk.text);
  }else if(chunk.type==='block-end'&&chunk.block?.type==='text'){
   if(typeof chunk.block.text!=='string')throw new Error('模型输出无效。');
   blocks.set(chunk.index??0,chunk.block.text);
  }
  const output=[...blocks.entries()].sort((a,b)=>a[0]-b[0]).map(([,text])=>text).join('');
  if(output.length>limit)throw new Error('模型输出过长。');
  return output;
 };
}
