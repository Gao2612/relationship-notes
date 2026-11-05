// 一级导航（最多两层）：一级入口 + 页内 tab。旧的路由 id 全部保留为别名，
// 通过 GROUP_ALIASES 映射到新的分组，避免任何死链。
export const NAVIGATION = [
  {id:'contact',label:'联系人',items:[{id:'profile',label:'联系人档案',tabs:[['basic','基本资料'],['interests','兴趣偏好']]}]},
  {id:'records',label:'记录与评分',items:[{id:'behavior',label:'行为记录',tabs:[['daily','每日历程'],['metrics','互动评分'],['basis','打分依据'],['review','周/月复盘'],['evidence','记录列表'],['rules','评分规则']]}]},
  {id:'communicate',label:'沟通',items:[{id:'replies',label:'回复草稿',tabs:[['session','会话']]},{id:'goals',label:'行动计划',tabs:[['current','当前目标'],['progress','进展记录']]}]},
  {id:'manage',label:'设置',items:[{id:'settings',label:'通用设置',tabs:[['general','通用设置']]},{id:'import',label:'聊天导入',tabs:[['file','导入文件'],['identity','身份确认'],['result','导入结果']]}]},
];
// 旧的一级分组 id（data/observe/communicate/manage）继续可解析。
const GROUP_ALIASES={data:'contact',observe:'records',communicate:'communicate',manage:'manage'};
export function resolveNavigation(feature,tab){
  // 1) 精确的 item id 优先（新路由都走这里）。
  const exactGroup=NAVIGATION.find(g=>g.items.some(i=>i.id===feature)),exactItem=exactGroup?.items.find(i=>i.id===feature);
  if(exactItem)return {group:exactGroup,item:exactItem,tab:exactItem.tabs.some(t=>t[0]===tab)?tab:exactItem.tabs[0][0]};
  // 2) feature 是旧分组 id：先用 tab 在全部页面里反查 item，再由命中的 item 反推分组，
  //    这样 'observe/progress' 落到页内 tab 真正所在的「行动计划」而不是记录页。
  const crossHit=NAVIGATION.flatMap(group=>group.items.map(item=>({group,item}))).find(({item})=>item.tabs.some(t=>t[0]===tab));
  if(crossHit)return {group:crossHit.group,item:crossHit.item,tab};
  // 3) 其余旧分组 id / 未知输入：退回分组别名或首个分组。
  const group=NAVIGATION.find(g=>g.id===(GROUP_ALIASES[feature]||feature))||NAVIGATION[0];
  const item=group.items[0];
  return {group,item,tab:item.tabs.some(t=>t[0]===tab)?tab:item.tabs[0][0]};
}
// 把一级入口下的所有页面 tab 合并成一条二级 tab 条：key = `itemId__tabId`。
export function groupTabs(group){
  return (group?.items||[]).filter(item=>!item.hidden).flatMap(item=>item.tabs.map(([tab,label])=>({key:item.id+'__'+tab,item:item.id,tab,label})));
}
export function createWorkspaceStore(initial={}){
  let value={feature:'profile',tab:'basic',contacts:[],selectedId:'',pending:null,importName:'',importError:'',importBusy:false,self:'',target:'',scenario:'continue',tone:'gentle',intent:'',draft:'',draftReason:'',draftSource:'',draftEvidence:[],exchangeSent:'',exchangeReply:'',status:'',modelBusy:false,models:[],provider:'',model:'',modelError:'',consent:false,mediaConsent:false,mediaAnalysis:{},mediaAnalysisBusy:{},goals:[],...initial};
  const listeners=new Set();
  return {getSnapshot:()=>value,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},set(change){value={...value,...(typeof change==='function'?change(value):change)};for(const fn of listeners)fn();},navigate(feature,tab){const n=resolveNavigation(feature,tab);value={...value,feature:n.item.id,tab:n.tab};for(const fn of listeners)fn();}};
}
