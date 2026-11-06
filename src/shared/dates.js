// 无时区导出时间统一按上海本地时间解释。
export function shanghaiTimestamp(value){
 if(typeof value==='string')value=value.trim();
 if(value===null||value===undefined||value==='')return null;
 if(value instanceof Date)return Number.isFinite(value.getTime())?value.getTime():null;
 if(typeof value==='number'||typeof value==='string'&&/^\d{10,13}$/.test(value)){
  const number=Number(value),millis=number<1e12?number*1000:number;
  return Number.isFinite(millis)&&Number.isFinite(new Date(millis).getTime())?millis:null;
 }
 if(typeof value!=='string')return null;
 const local=/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/.exec(value.trim());
 if(local){
  const [,year,month,day,hour='0',minute='0',second='0',fraction='0']=local;
  const millis=Date.UTC(+year,+month-1,+day,+hour,+minute,+second,+fraction.slice(0,3).padEnd(3,'0'));
  const date=new Date(millis);
  if(date.getUTCFullYear()!==+year||date.getUTCMonth()!==+month-1||date.getUTCDate()!==+day||+hour>23||+minute>59||+second>59)return null;
  return millis-28800000;
 }
 if(!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim()))return null;
 const millis=Date.parse(value.trim());
 return Number.isFinite(millis)?millis:null;
}

export function shanghaiDateKey(value){
 if(value===null||value===undefined||value==='')return null;
 const millis=shanghaiTimestamp(value);
 if(millis===null)return null;
 const date=new Date(millis);
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function reviewPeriodRange(period='week',anchor=shanghaiDateKey(Date.now())){
 if(!['week','month'].includes(period)||!/^\d{4}-\d{2}-\d{2}$/.test(anchor||'')||shanghaiDateKey(anchor)!==anchor)throw Error('请选择有效的周/月日期。');
 const date=new Date(anchor+'T00:00:00Z');let start,end;
 if(period==='week'){start=new Date(date);start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);end=new Date(start);end.setUTCDate(end.getUTCDate()+6);}
 else{start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1));end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0));}
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
