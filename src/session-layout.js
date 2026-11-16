// 会话页三栏的响应式布局（纯函数，便于测试）。
// 断点必须与 workspace.js / workspace-theme.js 中的 @container rn-session-shell 规则一致：
//   width > 900        三栏：列表 | 聊天 | 工具，列表与工具都可直接收起（inline）
//   621 ≤ width ≤ 900  列表默认隐藏，按按钮以抽屉方式浮出（drawer）；工具栏 inline
//   width ≤ 620        列表为抽屉；工具栏默认隐藏，按按钮在聊天下方展开（overlay）
// width 为 0（尚未测量）时按宽屏处理，与首帧 CSS 一致。
export const SESSION_BREAKPOINTS=Object.freeze({compact:900,narrow:620});
export function sessionPaneLayout(width,{listHidden=false,listDrawer=false,toolsOpen=false,toolsHidden=false}={}){
 const w=Number(width)||0,measured=w>0;
 const listMode=measured&&w<=SESSION_BREAKPOINTS.compact?'drawer':'inline';
 const toolsMode=measured&&w<=SESSION_BREAKPOINTS.narrow?'overlay':'inline';
 const listVisible=listMode==='drawer'?Boolean(listDrawer):!listHidden;
 const toolsVisible=toolsMode==='overlay'?Boolean(toolsOpen):!toolsHidden;
 const classes=[];
 if(listMode==='inline'&&!listVisible)classes.push('list-hidden');
 if(listMode==='drawer'&&listVisible)classes.push('list-open');
 if(toolsMode==='overlay'&&toolsVisible)classes.push('right-open');
 if(toolsMode==='inline'&&!toolsVisible)classes.push('right-hidden');
 return {listMode,toolsMode,listVisible,toolsVisible,classes};
}
