// Conservative, local recognition of present, directly expressed boundaries.
// Keep requests for space visible even when they are phrased politely as questions.
const QUOTED=/[“「『‘"][^”」』’"]*[”」』’"]/g;
const REPORTED=/(?:她|他|朋友|同事|对方|有人).*(?:说|表示|告诉)|(?:台词|原话|引用)/;
const PAST=/^(?:我)?(?:以前|从前|曾经|之前|过去|当时|那时|那天)/;
const PREFERENCE_QUESTION=/^(?:你|他|她)(?:真的?|现在|也|还|是)?(?:是不是|是否|想不想|愿不愿|不想|不喜欢)|^(?:是不是|是否)你/;
const REASSURANCE=/(?:不是|并非|没有|并没有)(?:说过|说|觉得|真的?|完全|真的说)?(?:不喜欢你|不想(?:再)?(?:见面|见你|聊天|联系|继续)|不要(?:再)?(?:联系我|打扰我|找我)|不愿(?:再)?(?:见你|聊天|联系))/;
const STOP=/(?:不要|别)(?:再)?(?:联系我(?!的|们|老板|朋友|同事|家人)|给我发|发消息|发信息|打扰我|找我)|请别再发|停止联系|(?:我们|咱们)(?:就)?(?:(?:不要|别)(?:再)?|不再)(?:联系|聊天)/;
const PERSONAL_OBJECT=/^(?:的|这样|这么|这种|那样|那么|那种|妈妈|爸爸|父母|朋友|同事|老板)/;

function clauses(text){
 const direct=String(text??'').replace(QUOTED,'');
 const sentences=direct.match(/[^。！？!?；;\n]+[。！？!?；;\n]*/g)||[];
 return sentences.filter(sentence=>!REPORTED.test(sentence)).flatMap(sentence=>sentence.split(/[，,]|但是|不过|然而|可是|但(?=我|你|请|别|不要|不想|不愿|现在)/)).map(part=>part.trim()).filter(Boolean);
}

function currentClause(part){
 return !PAST.test(part)&&!REASSURANCE.test(part)&&!PREFERENCE_QUESTION.test(part)&&!/(?:不喜欢你|不想见你)(?:是)?(?:以前|过去|之前)的(?:事|想法)/.test(part);
}

export function boundary(text){
 return clauses(text).some(part=>{
  if(!currentClause(part))return false;
  // "能不能别再联系我？" asks for an action; its question mark does not revoke it.
  if(STOP.test(part))return true;
  if(/[?？]/.test(part))return false;
  const desire=/(?:^|\s)(?:现在|目前|其实)?我(?:现在|真的)?不想(?:再)?(见面|见你|聊天|联系|继续)/.exec(part);
  if(desire){
   const action=desire[1],rest=part.slice(desire.index+desire[0].length);
   if(action==='见你')return !PERSONAL_OBJECT.test(rest);
   if(action==='联系')return /^(?:你)?(?:了)?[。！!\s]*$/.test(rest);
   if(action==='继续')return /^(?:(?:和你|跟你)?(?:联系|聊天|聊|见面)|这段关系)?(?:了)?[。！!\s]*$/.test(rest);
   return true;
  }
  return /^不再联系我(?:了)?[。！!\s]*$/.test(part);
 });
}

export function negative(text){
 if(boundary(text))return true;
 return clauses(text).some(part=>{
  if(!currentClause(part)||/[?？]/.test(part))return false;
  const rejection=/(?:不喜欢你|不想(?:再)?(?:见你|和你聊|联系你))/g;
  for(const match of part.matchAll(rejection)){
   if(!PERSONAL_OBJECT.test(part.slice(match.index+match[0].length)))return true;
  }
  if(/(?:没有|没|不|不再|并不|不是).{0,3}(?:不舒服|很烦|生气)/.test(part))return false;
  if(/(?:没有|没|不|不再|并不|不是)(?:觉得|认为|感觉)?(?:[和跟]你(?:聊天|见面|交流)|你让我|我对你).{0,8}(?:不舒服|很烦|生气)/.test(part))return false;
  return /(?:[和跟]你(?:聊天|见面|交流)|你让我|我对你).{0,8}(?:不舒服|很烦|生气)/.test(part);
 });
}
