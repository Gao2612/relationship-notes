export function shanghaiDateKey(value){
 if(value===null||value===undefined||value==='')return null;
 if(typeof value==='string'){
  const local=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:$|[ T])/.exec(value.trim());
  if(local&&!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())){const [,y,m,d]=local,day=new Date(Date.UTC(+y,+m-1,+d));if(day.getUTCFullYear()!==+y||day.getUTCMonth()!==+m-1||day.getUTCDate()!==+d)return null;return day.toISOString().slice(0,10);}
 }
 const numeric=typeof value==='number'||typeof value==='string'&&/^\d{10,13}$/.test(value),number=Number(value),date=numeric?new Date(number<1e12?number*1000:number):new Date(value);
 if(!Number.isFinite(date.getTime()))return null;
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function reviewPeriodRange(period='week',anchor=shanghaiDateKey(Date.now())){
 if(!['week','month'].includes(period)||!/^\d{4}-\d{2}-\d{2}$/.test(anchor||'')||shanghaiDateKey(anchor)!==anchor)throw Error('请选择有效的周/月日期。');
 const date=new Date(anchor+'T00:00:00Z');let start,end;
 if(period==='week'){start=new Date(date);start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);end=new Date(start);end.setUTCDate(end.getUTCDate()+6);}
 else{start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1));end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0));}
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
