// Conservative clause-level preference evidence, not general semantic entailment.
// Positive topics must come from their own literal supporting clause.
export function extractPreferenceEvidence(value){
 const result={positive:[],negative:[],ambiguous:[]};
 const clauses=String(value||'').split(/[，,。；;！!？?\n]|(?:但是|但后来|但现在|但|不过|可是|然而)/u).map(s=>s.trim()).filter(Boolean);
 for(const quote of clauses){
  if(/[“”「」『』"]|(?:他说|她说|别人|朋友|你|他|她).{0,5}(?:喜欢|感兴趣)|(?:不是不|没有不|不讨厌|不反感|不是没|不一定|不是很|并不是|不算|算不上|不觉得|谈不上|如果|假如|可能|也许|曾经|以前|为什么|哪种|是否)|喜欢什么|(?:吗|么|呢)$/u.test(quote)){result.ambiguous.push(quote);continue;}
  const negative=/(?:不太|不怎么|并不|不再|不|没)(?:喜欢|喜爱|爱玩|爱看|爱吃|爱|玩|看|吃)\s*(.+)|(?:对)?(.+?)(?:不太|不怎么|并不|不|没有|没)(?:啥|什么)?(?:感兴趣|兴趣)|(?:讨厌|反感)\s*(.+)|(?:对)?(.+?)(?:不感冒|反感)/u.exec(quote);
  if(negative){const text=(negative[1]||negative[2]||negative[3]||negative[4]||'').replace(/^(?:我|本人)(?:本来|现在|其实|就|也|都|对)*/u,'').trim();if(text)result.negative.push({text,quote});else result.ambiguous.push(quote);continue;}
  const positive=/(?:喜欢|喜爱|爱好是|兴趣是|爱玩|爱看|爱吃|偏好)\s*(.+)|(?:对)(.+?)(?:很|挺|特别|非常)?感兴趣/u.exec(quote);
  if(positive){const text=(positive[1]||positive[2]||'').trim().replace(/^(?:玩|看|吃|喝)(?=.{1,})/u,'');if(text)result.positive.push({text,quote});}
 }
 return result;
}
export function hasNegativePreference(text){return extractPreferenceEvidence(text).negative.length>0;}
export function preferenceSummarySupported(fact){
 if(!fact||!['interests','preferences'].includes(fact.field))return true;
 const source=extractPreferenceEvidence(fact.quote),summary=extractPreferenceEvidence(fact.value);
 // Negative preferences are useful profile data and must not be discarded.
 if(summary.positive.length===0&&summary.negative.length>0)return true;
 if(source.positive.length>0)return true;
 if(source.negative.length>0||source.ambiguous.length>0)return false;
 return summary.positive.length===0;
}
export function selectPositivePreference(fact){
 if(!fact||!['interests','preferences'].includes(fact.field))return null;
 const source=String(fact.quote||'').trim();
 // Imported/model facts with no literal supporting quote cannot seed a topic.
 // A user-maintained value is allowed only if it explicitly states a preference.
 const evidence=source||(fact.manual===true?fact.value:'');
 return extractPreferenceEvidence(evidence).positive[0]||null;
}
