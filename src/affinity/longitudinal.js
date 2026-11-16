// 关系分析 v3 · 长期变化（纯函数）。
// - 周序列保留缺口（没有聊天的周不是 0 分）。
// - EWMA（λ=0.3）平滑短期波动；趋势用最近 ≤8 个有数据周的加权最小二乘（权重 = 1/SE²），给出 80% 区间。
// - 变化点用双侧 CUSUM（k=0.5σ，h=3σ；σ 取移动极差估计），只在 ≥6 个有数据周时启用；变化点把历史切成阶段，
//   并按“权重 × 维度变化”列出主要驱动因素。这些都是统计描述，不是对关系的结论。
import {DIMENSIONS,Z80} from './model.js';
import {addDays} from './weekly-signals.js';
export const EWMA_LAMBDA=0.3,TREND_WINDOW=8,CUSUM_K=0.5,CUSUM_H=3,MIN_TREND_WEEKS=4,MIN_CUSUM_WEEKS=6;

export function withGaps(scored){
 const list=[...scored].sort((a,b)=>a.start.localeCompare(b.start)),out=[];
 for(let i=0;i<list.length;i++){
  out.push(list[i]);const next=list[i+1];
  if(next)for(let w=addDays(list[i].start,7);w<next.start;w=addDays(w,7))out.push({start:w,end:addDays(w,6),gap:true});
 }
 return out;
}
export function ewma(values,lambda=EWMA_LAMBDA){let level=null;return values.map(v=>{if(v===null||!Number.isFinite(v))return level;level=level===null?v:lambda*v+(1-lambda)*level;return level;});}

export function trend(points){
 const data=points.filter(p=>!p.gap).slice(-TREND_WINDOW);
 if(data.length<MIN_TREND_WEEKS)return {direction:'insufficient',weeks:data.length};
 const t0=Date.parse(data[0].start+'T00:00:00Z'),xs=data.map(p=>(Date.parse(p.start+'T00:00:00Z')-t0)/(7*86400000)),ys=data.map(p=>p.index),ws=data.map(p=>1/Math.max(4,(p.se||10)**2));
 const W=ws.reduce((s,w)=>s+w,0),mx=xs.reduce((s,x,i)=>s+ws[i]*x,0)/W,my=ys.reduce((s,y,i)=>s+ws[i]*y,0)/W;
 const sxx=xs.reduce((s,x,i)=>s+ws[i]*(x-mx)**2,0);if(!sxx)return {direction:'insufficient',weeks:data.length};
 const slope=xs.reduce((s,x,i)=>s+ws[i]*(x-mx)*(ys[i]-my),0)/sxx;
 const resid=ys.map((y,i)=>y-(my+slope*(xs[i]-mx))),dof=Math.max(1,data.length-2);
 const s2=resid.reduce((s,r,i)=>s+ws[i]*r*r,0)/dof,se=Math.sqrt(s2/sxx);
 const low=slope-Z80*se,high=slope+Z80*se;
 const direction=low>0&&slope>=1?'rising':high<0&&slope<=-1?'falling':'stable';
 return {direction,slope,low,high,weeks:data.length,from:data[0].start,to:data.at(-1).start};
}

export function changePoints(points,{k=CUSUM_K,h=CUSUM_H}={}){
 const data=points.filter(p=>!p.gap);if(data.length<MIN_CUSUM_WEEKS)return [];
 // 噪声尺度用相邻周差（移动极差，MSSD）估计，而不是整体标准差——后者会把要检测的变化本身算进噪声里。
 const ys=data.map(p=>p.index);
 const mssd=Math.sqrt(ys.slice(1).reduce((s,y,i)=>s+(y-ys[i])**2,0)/(2*(ys.length-1)));
 const medianSe=[...data.map(p=>p.se||0)].sort((a,b)=>a-b)[Math.floor(data.length/2)];
 const sd=Math.max(3,mssd,medianSe*0.5);
 // 自启动 CUSUM：参照值是“上一个变化点以来”的均值（至少 2 周基线），避免用全局均值把早期阶段误报为变化。
 const out=[];let anchor=0,pos=0,neg=0;
 for(let i=anchor+2;i<ys.length;i++){
  const base=ys.slice(anchor,i),mu=base.reduce((s,y)=>s+y,0)/base.length,z=(ys[i]-mu)/sd;
  pos=Math.max(0,pos+z-k);neg=Math.max(0,neg-z-k);
  if(pos>h||neg>h){
   const up=pos>h;let start=i;
   // 变化起点：从检测时刻往回找连续偏离同一方向的第一周。
   for(let j=i-1;j>=anchor+2;j--){const zz=(ys[j]-mu)/sd;if(up?zz<=k:zz>=-k)break;start=j;}
   out.push({index:start,start:data[start].start,direction:up?'up':'down'});
   anchor=start;pos=0;neg=0;i=Math.max(i,anchor+1);
  }
 }
 return out;
}

export function phases(points,cps){
 const data=points.filter(p=>!p.gap);if(!data.length)return [];
 const cuts=[0,...cps.map(c=>c.index).filter(i=>i>0),data.length],out=[];
 for(let i=0;i<cuts.length-1;i++){
  const slice=data.slice(cuts[i],cuts[i+1]);if(!slice.length)continue;
  const avg=f=>slice.reduce((s,p)=>s+f(p),0)/slice.length;
  out.push({start:slice[0].start,end:slice.at(-1).end,weeks:slice.length,index:Math.round(avg(p=>p.index)),
   dims:Object.fromEntries(DIMENSIONS.map(d=>[d.key,avg(p=>p.dims[d.key].estimate)])),friction:avg(p=>p.friction.estimate)});
 }
 for(let i=1;i<out.length;i++){
  const prev=out[i-1],cur=out[i];
  cur.change=cur.index-prev.index;
  cur.drivers=[...DIMENSIONS.map(d=>({key:d.key,label:d.label,delta:cur.dims[d.key]-prev.dims[d.key],impact:100*d.weight*(cur.dims[d.key]-prev.dims[d.key])})),
   {key:'friction',label:'摩擦与修复',delta:cur.friction-prev.friction,impact:-60*(cur.friction-prev.friction)*0.5}]
   .filter(x=>Math.abs(x.impact)>=0.5).sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)).slice(0,3);
 }
 return out;
}

/** 汇总：带缺口的周序列、EWMA、趋势、变化点、阶段。 */
export function longitudinal(scored){
 const points=withGaps(scored),smooth=ewma(points.map(p=>p.gap?null:p.index));
 points.forEach((p,i)=>{p.ewma=smooth[i]===null?null:Math.round(smooth[i]*10)/10;});
 const cps=changePoints(points);
 return {points,trend:trend(points),changePoints:cps,phases:phases(points,cps),current:points.filter(p=>!p.gap).at(-1)||null};
}
