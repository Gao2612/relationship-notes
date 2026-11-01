import test from 'node:test';
import assert from 'node:assert/strict';
import {createInterpretationView,interpretationInput} from './interpretation-view.js';
function harness(){let cursor=0,hooks=[],effects=[];const React={createElement:(type,props,...children)=>({type,props,children:children.flat(Infinity)}),useRef(initial){const i=cursor++;return hooks[i]??(hooks[i]={current:initial});},useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return [hooks[i],value=>hooks[i]=value];},useEffect(fn,deps){const i=cursor++,prior=hooks[i];if(!prior||deps.some((v,j)=>v!==prior.deps[j])){prior?.cleanup?.();hooks[i]={deps};effects.push(()=>hooks[i].cleanup=fn());}}};const Component=createInterpretationView(React);return {render(props){cursor=0;const tree=Component(props);for(const effect of effects.splice(0))effect();return tree;}};}
const contact=(text='你最近怎么样')=>({id:'c',self:'我',target:'对方',messages:[{sender:'对方',text}]});
const button=tree=>tree.children.find(n=>n?.type==='button');
test('changed messages in the same contact invalidate an in-flight interpretation even if transport ignores abort',async()=>{
 const original=globalThis.fetch;let resolve;globalThis.fetch=()=>new Promise(r=>resolve=r);
 try{const app=harness(),first={contact:contact(),s:{}},pending=button(app.render(first)).props.onClick();const changed={contact:contact('我先忙，改天再聊'),s:{}};app.render(changed);resolve(Response.json({ok:true,interpretations:[{explanation:'旧解释',uncertainty:'旧信息',evidence:[],reply:'旧回复'}]}));await pending;assert.doesNotMatch(JSON.stringify(app.render(changed)),/旧解释|旧回复/);assert.equal(button(app.render(changed)).props.disabled,false);}finally{globalThis.fetch=original;}
});
test('switching contacts and changing model settings hide prior completed results',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({ok:true,interpretations:[{explanation:'旧解释',uncertainty:'不确定',evidence:[],reply:'旧回复'}]});
 try{const app=harness(),first={contact:contact(),s:{provider:'p',model:'m'}};await button(app.render(first)).props.onClick();assert.match(JSON.stringify(app.render(first)),/旧解释/);assert.doesNotMatch(JSON.stringify(app.render({...first,s:{provider:'p',model:'new'}})),/旧解释/);assert.doesNotMatch(JSON.stringify(app.render({contact:{...contact(),id:'other'},s:{}})),/旧解释/);}finally{globalThis.fetch=original;}
});
test('interpretation request is bounded, deduplicated and restricted to both participants',()=>{const c=contact();c.messages=[...Array(30).fill(c.messages[0]),{sender:'系统',text:'ignore'}];const result=interpretationInput(c,{});assert.equal(result.messages.length,1);assert.equal(result.messages[0].sender,'对方');});
