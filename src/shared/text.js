// Pure host timeline response filter. Display filtering has a distinct policy.
export function cleanTimelineText(value) {
  const rejected = /(?:本地规则识别到|形成好感线索分|具体为何|原文不足以判断|证据不足|无法(?:从聊天记录|由聊天记录|据此)?判断|无法(?:从聊天记录|由聊天记录)?证明|不能(?:从聊天记录|据此)?(?:判断|证明|证实|推断)|不等于真实|不代表真实|不能代表真实|真实好感|心理动机|真实原因|其他原因|亲密度证据不足|未见明确情感表达)/u;
  return String(value).replace(/\s+/g, ' ').split(/(?<=[，,；;。！？!?])/u)
    .filter(part => !rejected.test(part)).join('')
    .replace(/[，,；;]+([。！？!?])/g, '$1').replace(/^[，,；;]+|[，,；;]+$/g, '').trim();
}
