/** Turn validated DSH conversation imports into the same evidence-rich contacts as file imports. */
export function consumeImports(values, seen, extractFacts) {
  if (!Array.isArray(values)) return [];
  const contacts=[];
  for (const value of values.slice(-20)) {
    if (!value || typeof value.version!=='string' || !value.version || seen.has(value.version)) continue;
    seen.add(value.version);
    if (typeof value.self!=='string' || !value.self.trim() || typeof value.target!=='string' || !value.target.trim() || value.self===value.target || !Array.isArray(value.messages) || value.messages.length>500) continue;
    if (!value.messages.every(m=>m && (m.sender===value.self || m.sender===value.target) && typeof m.text==='string' && m.text.trim())) continue;
    if (!value.messages.some(m=>m.sender===value.self) || !value.messages.some(m=>m.sender===value.target)) continue;
    const messages=value.messages.map((m,i)=>({sender:m.sender,text:m.text,timestamp:typeof m.timestamp==='string'?m.timestamp:'',file:'DSH 会话',source:'DSH 对话',messageIndex:i+1}));
    contacts.push({id:'dsh-import-'+value.version,importVersion:value.version,self:value.self,target:value.target,messages,facts:extractFacts(messages.filter(m=>m.sender===value.target)),isSample:false});
  }
  return contacts;
}
