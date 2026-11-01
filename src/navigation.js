export const NAVIGATION = [
  {id:'data',label:'联系人档案',items:[{id:'profile',label:'联系人档案',tabs:[['basic','基本资料'],['interests','兴趣偏好']]}]},
  {id:'observe',label:'关系观察',items:[{id:'behavior',label:'行为记录',tabs:[['daily','每日历程'],['metrics','互动评分'],['review','周/月复盘'],['evidence','记录列表'],['rules','评分规则']]},{id:'goals',label:'行动计划',tabs:[['current','当前目标'],['progress','进展记录']]}]},
  {id:'communicate',label:'沟通辅助',items:[{id:'replies',label:'回复草稿',tabs:[['session','会话']]}]},
  {id:'manage',label:'设置',hidden:true,items:[{id:'settings',label:'设置',tabs:[['general','通用设置']]},{id:'import',label:'聊天导入',tabs:[['file','导入文件'],['identity','身份确认'],['result','导入结果']],hidden:true}]},
];
export function resolveNavigation(feature,tab){
  const group=NAVIGATION.find(g=>g.items.some(i=>i.id===feature))||NAVIGATION[0];
  const item=group.items.find(i=>i.id===feature)||group.items[0];
  return {group,item,tab:item.tabs.some(t=>t[0]===tab)?tab:item.tabs[0][0]};
}
export function createWorkspaceStore(initial={}){
  let value={feature:'profile',tab:'basic',contacts:[],selectedId:'',pending:null,importName:'',importError:'',importBusy:false,self:'',target:'',scenario:'continue',tone:'gentle',intent:'',draft:'',draftReason:'',draftSource:'',draftEvidence:[],exchangeSent:'',exchangeReply:'',status:'',modelBusy:false,models:[],provider:'',model:'',modelError:'',consent:false,mediaConsent:false,mediaAnalysis:{},mediaAnalysisBusy:{},goals:[],...initial};
  const listeners=new Set();
  return {getSnapshot:()=>value,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},set(change){value={...value,...(typeof change==='function'?change(value):change)};for(const fn of listeners)fn();},navigate(feature,tab){const n=resolveNavigation(feature,tab);value={...value,feature:n.item.id,tab:n.tab};for(const fn of listeners)fn();}};
}
