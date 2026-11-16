// 线性图标（24×24，1.6 描边，currentColor）。只用于有含义的位置：导航、主要操作、空状态。
const PATHS={
 contact:['M12 12.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z','M4.5 20c.9-3.6 3.9-5.6 7.5-5.6s6.6 2 7.5 5.6'],
 records:['M4 19.5h16','M6.5 16l3.6-4.4 3.2 2.6 4.6-6.2','M17.9 8h-3','M17.9 8v3'],
 communicate:['M5 17.5 3.8 20.6 8 19.3A8.5 8.5 0 1 0 5 17.5Z','M8.5 11.5h7','M8.5 14.5h4.5'],
 manage:['M4 7h9','M17 7h3','M15 5v4','M4 17h3','M11 17h9','M9 15v4'],
 import:['M12 4v10','M8 10.5l4 4 4-4','M5 15.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5'],
 settings:['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z','M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.4 7.4 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4Z'],
 spark:['M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9Z','M18.5 16v4','M16.5 18h4'],
 heart:['M12 19.5s-7-4.4-7-9.6A4 4 0 0 1 12 7.6a4 4 0 0 1 7 2.3c0 5.2-7 9.6-7 9.6Z'],
 book:['M5 4.5h10.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3Z','M5 16.5a3 3 0 0 1 3-3h10.5'],
 check:['M5 12.5l4.2 4.2L19 7'],
};
export const ICON_NAMES=Object.freeze(Object.keys(PATHS));
export function createIcon(React){
 const h=React.createElement;
 return function Icon({name,size=20,className='',title}){
  const paths=PATHS[name];if(!paths)return null;
  return h('svg',{className:'rn-icon '+className,width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':title?undefined:true,role:title?'img':undefined},title&&h('title',null,title),...paths.map((d,i)=>h('path',{key:i,d})));
 };
}
