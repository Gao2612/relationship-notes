// One conservative signal vocabulary for daily and overall views.
export const question=text=>{text=directText(text);return /[?？]|(?:吗|么|如何|为什么|怎么|是否|什么|哪[里个天])/.test(text);};
export function boundary(text){
 // Reported speech and quoted text are not evidence of this sender's wishes.
 text=text.replace(/[“「『"][^”」』"]*[”」』"]/g,'');
 return text.split(/[。！!\n]/).some(part=>{
  // A separate follow-up question must not cancel a preceding direct refusal.
  part=part.replace(/[，,][^，,]*[?？]\s*$/, '');
  if(/(?:她|他|朋友|同事|对方|有人).*(?:说|表示|告诉)|(?:台词|原话|引用)/.test(part))return false;
  if(/[?？]|是不是|是否|能不能|可不可以|你.*(?:不想|不要|别再)/.test(part))return false;
  return /(?:请)?(?:不要|别)(?:再)?(?:联系我|给我发|发消息|发信息|打扰我|找我)|我不想(?:再)?(?:见面|见你|聊天|联系|继续)|请别再发|停止联系|不再联系我/.test(part);
 });
}
export const sharing=text=>{text=directText(text);return !question(text)&&/(?:^|[。！？!?，,\n])\s*我(?:最近|今天|昨天|刚刚|刚|正在|现在|周末|平时|已经|打算|计划|很|比较|最|一直|在)*(?:喜欢|爱好|偏好|去了|去过|参加|完成|忙着|在|住在|从事|学|买了|看了|吃了|做了|整理|拍了|写了|工作)/.test(text);};
export const acknowledgment=text=>/^(?:(?:好(?:的|呀|啊)?|嗯+|收到|了解|明白(?:了)?|谢谢|没问题|知道了)[，,。！!\s]*)+$/.test(text.trim());
const positivePattern=/(?:(?<!不)喜欢你|想你|想见你|期待(?:见你|和你)|开心(?:和你|见到你|跟你)|高兴(?:和你|见到你)|你真好|好可爱|好漂亮|好厉害|辛苦你了|谢谢你|关心你|担心你|抱抱|亲亲|❤️|❤|🥰|😍|😘)/i;

function directText(text){const value=String(text).replace(/[“「『"][^”」』"]*[”」』"]/g,'');return (value.match(/[^。！？!?；;\n]+[。！？!?；;\n]?/g)||[]).filter(part=>!/(?:她|他|朋友|同事|对方|有人).*(?:说|表示|告诉)|(?:台词|原话|引用)/.test(part)).join('');}
export function positive(text){const value=directText(text);for(const match of value.matchAll(new RegExp(positivePattern.source,'ig'))){if(!/(?:不|没|并非|不是|不太|不想|不再).{0,3}$/.test(value.slice(0,match.index)))return true;}return false;}
export function negative(text){const value=directText(text);return boundary(value)||/(?:不喜欢你|不想(?:再)?(?:见你|和你聊|联系你)|(?:和你(?:聊天|见面|交流)|你让我|我对你).{0,8}(?:不舒服|很烦|生气))/.test(value);}
export const interactionDetectors={question,sharing,positive,boundary:negative};
export function interactionScore(counts){const signals=Object.values(counts).reduce((a,b)=>a+b,0);return signals?Math.max(0,Math.min(100,50+12*(counts.positive||0)-18*(counts.boundary||0)+5*(counts.question||0)+4*(counts.sharing||0))):null;}
