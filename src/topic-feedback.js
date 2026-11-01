const hash=text=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(36);};
export function topicSuggestionKey(suggestion){return 'topic-'+hash(JSON.stringify([suggestion.type,suggestion.text,(suggestion.basis||[]).map(b=>[b.factId||b.refId||'',b.quote||''])]));}
export function recordTopicFeedback(contact,suggestion,status,{now=Date.now(),note=''}={}){
 if(!['unsuitable','discussed','reset'].includes(status)||suggestion?.type!=='topic')throw Error('请选择有效的话题反馈。');
 return {...contact,topicFeedback:[...(contact.topicFeedback||[]),{suggestionId:topicSuggestionKey(suggestion),status,note:String(note).slice(0,300),at:now}]};
}
export function applyTopicFeedback(suggestions,feedback=[]){
 const latest=new Map((feedback||[]).filter(f=>f&&typeof f.suggestionId==='string').map(f=>[f.suggestionId,f]));
 const visible=[],suppressed=[];
 for(const suggestion of suggestions){const id=topicSuggestionKey(suggestion),item={...suggestion,id},entry=latest.get(id);if(item.type==='topic'&&entry&&entry.status!=='reset')suppressed.push({...item,feedback:entry});else visible.push(item);}
 return {suggestions:visible,suppressed};
}
