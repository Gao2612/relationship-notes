import {profileMessageId} from './profile-lifecycle.js';
export function interpretationInput(contact,s){
 const messages=[...new Map((contact?.messages||[]).filter(m=>[contact.self,contact.target].includes(m.sender)&&m.text?.trim()).slice(-20).map(m=>[String(profileMessageId(m)),m])).values()].map(m=>({id:String(profileMessageId(m)),sender:m.sender,text:m.text.slice(0,2000)}));
 const body={self:contact?.self,target:contact?.target,messages,selfProfile:s.selfProfile};if(s.provider&&s.model){body.provider=s.provider;body.model=s.model;}return body;
}
export function createInterpretationView(React){const h=React.createElement;return function InterpretationView({contact,s}){
 const body=interpretationInput(contact,s),key=JSON.stringify([contact?.id,body]),scope=React.useRef(key),controller=React.useRef(null);scope.current=key;
 const [result,setResult]=React.useState(null),[busy,setBusy]=React.useState(''),[error,setError]=React.useState(null);
 React.useEffect(()=>{controller.current?.abort();setResult(null);setError(null);setBusy('');return()=>controller.current?.abort();},[key]);
 const run=async()=>{controller.current?.abort();const current=new AbortController();controller.current=current;const active=()=>!current.signal.aborted&&controller.current===current&&scope.current===key;setBusy(key);setError(null);setResult(null);
  try{const response=await fetch('api/relationship-notes/interpretation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:current.signal}),data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'分析失败。');if(active())setResult({key,items:data.interpretations});}catch(err){if(active())setError({key,text:err.message});}finally{if(active())setBusy('');}
 };
 const copy=async text=>{try{await navigator.clipboard.writeText(text);}catch{if(scope.current===key)setError({key,text:'复制失败，请手动选择草稿。'});}};
 if(!contact)return null;
 return h('section',{className:'rn-interpretations'},h('h3',null,'可能解释与回复思路'),h('p',null,'按最近聊天提出多种解释，供你核对；无法知道对方真实想法。点击后会把最近最多20条消息和本人档案交给所选模型。'),h('button',{type:'button',disabled:busy===key,onClick:run},busy===key?'正在整理可能解释…':'分析可能解释'),busy===key&&h('button',{type:'button',onClick:()=>{controller.current?.abort();setBusy('');}},'取消'),error?.key===key&&h('p',{role:'alert'},error.text),...(result?.key===key?result.items:[]).map((item,index)=>h('article',{className:'rn-message',key:index},h('strong',null,'可能解释 '+(index+1)),h('p',null,item.explanation),h('p',null,'不确定性：'+item.uncertainty),h('details',null,h('summary',null,'原文依据'),...item.evidence.map((e,i)=>h('blockquote',{key:i},e.quote))),h('p',null,'回复思路：'+item.reply),h('button',{type:'button',onClick:()=>copy(item.reply)},'复制这条草稿'))));
 };}
