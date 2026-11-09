import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../client-engine.js';
function harness(factory){let cursor=0,hooks=[];const React={createElement:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity)}),useRef:value=>({current:value}),useEffect(){},useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return [hooks[i],value=>hooks[i]=value];}};const Component=factory(React,E),nodes=(node,out=[])=>{if(node&&typeof node==='object'){if(typeof node.type==='function')return nodes(node.type(node.props),out);out.push(node);for(const child of node.children||[])nodes(child,out);}return out;};return {render(props){cursor=0;return nodes(Component(props));}};}
const find=(nodes,label)=>nodes.find(n=>n.type==='button'&&n.children.includes(label));
const base=()=>E.ensureContactMessageIds({id:'person',self:'我',target:'对方',messages:[{sender:'我',text:'今天怎么样',timestamp:'2026-11-01 10:00'},{sender:'对方',text:'最近在看电影',timestamp:'2026-11-01 10:01'}],profileSummary:[]});
test('evidence dialog resolves original context and closes through its action',()=>{const contact=base(),app=harness(E.createEvidenceContextView);let closed=false;const nodes=app.render({contact,reference:{messageId:contact.messages[1].messageId},onClose:()=>closed=true});assert(nodes.some(n=>n.props['aria-label']==='引用原文'));assert(nodes.some(n=>n.children.includes('最近在看电影')));find(nodes,'关闭上下文').props.onClick();assert.equal(closed,true);});
test('topic feedback hides a topic and restores it through visible controls',()=>{let contact=base();const app=harness(E.createTopicSuggestionsView),props=()=>({result:E.suggestNextSteps(contact),onFeedback:(item,status)=>contact=E.recordTopicFeedback(contact,item,status),onEvidence(){}});let nodes=app.render(props());find(nodes,'不合适').props.onClick();nodes=app.render(props());assert.equal(find(nodes,'不合适'),undefined);find(nodes,'恢复此话题').props.onClick();assert(find(app.render(props()),'不合适'));assert.equal(contact.topicFeedback.length,2);});
test('reply feedback requires explicit approval and allows undo without automatic profile changes',()=>{let profile=E.normalizeSelfProfile({samples:[{text:'旧样例'}]}),changes=0;const before=profile,app=harness(E.createReplyFeedbackView),props=()=>({contactId:'person',draft:'好呀，等你方便。',selfProfile:profile,onChange:value=>{profile=value;changes++;}});let nodes=app.render(props());assert.equal(changes,0);find(nodes,'确认保存当前回复为本人样例').props.onClick();assert.equal(profile.samples[0].text,'好呀，等你方便。');nodes=app.render(props());find(nodes,'撤销本次样例保存').props.onClick();assert.strictEqual(profile,before);});
test('share scope preview prevents invalid limits and applies a valid scope without enabling sharing',()=>{let applied;const app=harness(E.createShareScopeView),props={contact:base(),scope:{},onApply:value=>applied=value};let nodes=app.render(props);nodes.find(n=>n.type==='input'&&n.props.type==='number').props.onChange({target:{value:'0'}});nodes=app.render(props);assert.equal(find(nodes,'应用读取范围').props.disabled,true);assert.equal(applied,undefined);nodes.find(n=>n.type==='input'&&n.props.type==='number').props.onChange({target:{value:'1'}});nodes=app.render(props);find(nodes,'应用读取范围').props.onClick();assert.equal(applied.limit,1);});
test('period review changes persisted preferences and opens its evidence',()=>{const contact=base(),app=harness(E.createPeriodReviewView);let preferences,reference;const nodes=app.render({contact,preferences:{period:'month',anchor:'2026-11-01'},onPreferencesChange:value=>preferences=value,onEvidence:value=>reference=value});nodes.find(n=>n.type==='select').props.onChange({target:{value:'week'}});assert.deepEqual(preferences,{period:'week',anchor:'2026-11-01'});find(nodes,'查看上下文').props.onClick();assert.equal(reference.messageId,contact.messages[1].messageId);});
test('contact followup completion and reopening use lifecycle actions',()=>{let contact={...base(),profileSummary:[{uid:'f',field:'followup',value:'问候考试进展',status:'active',confirmed:true}]};const app=harness(E.createProfileLifecycleView),props=()=>({contact,onAction:action=>contact=E.changeProfile(contact,action),onEvidence(){}});find(app.render(props()),'标记已完成').props.onClick();assert.equal(E.profileRows(contact)[0].status,'completed');find(app.render(props()),'重新打开').props.onClick();assert.equal(E.profileRows(contact)[0].status,'active');});
test('own-plan controls complete plans without losing expression samples',()=>{let profile=E.normalizeSelfProfile({plans:[{text:'周末爬山',when:'周六'}],samples:[{text:'嗯，好呀'}]});const app=harness(E.createSelfPlanView),props=()=>({profile,onChange:value=>profile=value});find(app.render(props()),'完成计划').props.onClick();assert.equal(profile.plans[0].planState,'completed');assert.equal(profile.samples[0].text,'嗯，好呀');find(app.render(props()),'重新开始计划').props.onClick();assert.equal(profile.plans[0].planState,'active');assert.equal(profile.plans[0].when,'周六');});
test('unconfirmed contact proposals cannot be completed, cancelled or expired through lifecycle controls',()=>{const contact={...base(),profileSummary:[{uid:'f',field:'followup',value:'模型提议',status:'pending',confirmed:false}]},app=harness(E.createProfileLifecycleView),nodes=app.render({contact,onAction(){throw Error('must confirm first');},onEvidence(){}});assert.equal(find(nodes,'标记已完成'),undefined);assert.equal(find(nodes,'取消此事项'),undefined);assert.equal(find(nodes,'标记已过期'),undefined);assert(nodes.some(n=>n.children.includes('先确认资料，再管理有效期。')));});
test('missing and ambiguous evidence show explicit status instead of unrelated context',()=>{
 const contact=base(),app=harness(E.createEvidenceContextView);
 let nodes=app.render({contact,reference:{messageId:'removed'},onClose(){}});
 assert(nodes.some(n=>n.props.role==='status'&&n.children.some(c=>typeof c==='string'&&c.includes('无法定位'))));
 assert(!nodes.some(n=>n.props['aria-label']==='引用原文'));
 const repeated={...contact,messages:[...contact.messages,{...contact.messages[1],messageId:'different',timestamp:'2026-11-01 11:00'}]};
 nodes=app.render({contact:repeated,reference:{quote:'最近在看电影'},onClose(){}});
 assert(nodes.some(n=>n.props.role==='status'&&n.children.some(c=>typeof c==='string'&&c.includes('多处相似'))));
});
test('share date inversion cannot apply while a corrected date range can',()=>{
 let applied;const app=harness(E.createShareScopeView),props={contact:base(),scope:{since:'2026-11-02',until:'2026-11-01'},onApply:value=>applied=value};
 let nodes=app.render(props);assert.equal(find(nodes,'应用读取范围').props.disabled,true);
 nodes.filter(n=>n.type==='input'&&n.props.type==='date')[0].props.onChange({target:{value:'2026-11-01'}});
 nodes=app.render(props);assert.equal(find(nodes,'应用读取范围').props.disabled,false);find(nodes,'应用读取范围').props.onClick();assert.equal(applied.since,'2026-11-01');
});
test('period review date control retains selected period in preference updates',()=>{
 let preferences;const app=harness(E.createPeriodReviewView),nodes=app.render({contact:base(),preferences:{period:'week',anchor:'2026-11-01'},onPreferencesChange:value=>preferences=value,onEvidence(){}});
 nodes.find(n=>n.type==='input'&&n.props.type==='date').props.onChange({target:{value:'2026-11-08'}});
 assert.deepEqual(preferences,{period:'week',anchor:'2026-11-08'});
});

test('relation stage view saves manual profile and stage override',()=>{
 let action;const contact={...base(),relationProfile:{label:'小林',context:'大学同学，聊工作和电影',expectation:'先做稳定的朋友'}};
 const app=harness(E.createRelationStageView),props=()=>({contact,onAction:value=>action=value,onEvidence(){}});
 let nodes=app.render(props());
 assert(nodes.some(n=>n.children.includes('关系画像与阶段')));
 assert.equal(nodes.find(n=>n.props['aria-label']==='对方称谓').props.value,'小林');
 assert(nodes.some(n=>n.children.includes('当前阶段：')));
 nodes.find(n=>n.props['aria-label']==='对方称谓').props.onChange({target:{value:'小林同学'}});
 nodes=app.render(props());
 find(nodes,'保存关系画像').props.onClick();
 assert.equal(action.type,'setProfile');assert.equal(action.label,'小林同学');
 nodes.find(n=>n.props['aria-label']==='手动设定阶段').props.onChange({target:{value:'ambiguous'}});
 nodes=app.render(props());
 find(nodes,'保存阶段设定').props.onClick();
 assert.deepEqual({type:action.type,stage:action.stage},{type:'setStage',stage:'ambiguous'});
});