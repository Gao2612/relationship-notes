import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSelfProfile,summarizeSelfProfile} from './self-profile.js';
import {suggestNextSteps} from './suggestions.js';
test('waiting for the other person does not also suggest immediate new topics',()=>{const result=suggestNextSteps({self:'我',target:'你',messages:[{sender:'我',text:'周末去看电影吗？'}],profileSummary:[{field:'interests',value:'电影',status:'active',confirmed:true}]});assert.equal(result.suggestions.length,1);assert.match(result.suggestions[0].text,/不用追加话题/);});
test('unconfirmed model facts are not presented as confirmed topic evidence',()=>{const result=suggestNextSteps({self:'我',target:'你',messages:[],profileSummary:[{field:'interests',value:'模型猜的爱好',status:'active',provenance:'model',confirmed:false}]});assert.equal(result.suggestions.length,0);assert.deepEqual(suggestNextSteps(null).suggestions,[]);});
test('explicit pause overrides topic and followup suggestions',()=>{
 const result=suggestNextSteps({self:'我',target:'你',messages:[{sender:'你',text:'我先忙，先不聊了'}],profileSummary:[{uid:'f',field:'followup',value:'周末安排',status:'active'}]});
 assert.equal(result.suggestions.length,1);assert.equal(result.suggestions[0].type,'nextStep');assert.match(result.suggestions[0].text,/停止追加/);
});
import {buildReplyPayload} from './reply-payload.js';

test('self profile is bounded, normalized and keeps voice and approved samples',()=>{
 const profile=normalizeSelfProfile({voice:{tone:['轻松'],particles:['哈哈'],emoji:'often',sentenceLength:'short'},interests:['摄影'],plans:[{text:'周末看展'}],boundaries:['不替我答应时间'],samples:[{text:'哈哈，这个确实有意思'}]});
 assert.equal(profile.voice.tone[0],'轻松');assert.equal(profile.samples[0].text,'哈哈，这个确实有意思');
 assert.equal(normalizeSelfProfile({voice:{emoji:'bad'}}).voice.emoji,'rare');
 assert.deepEqual(summarizeSelfProfile(profile).interests,['摄影']);
});

test('next-step suggestions cite a real recent question and confirmed facts only',()=>{
 const contact={self:'我',target:'小林',messages:[{sender:'小林',text:'你周末喜欢去看展吗？'}],profileSummary:[{uid:'f1',field:'interests',value:'喜欢摄影',quote:'我很喜欢摄影',status:'active'},{uid:'f2',field:'job',value:'新工作',status:'pending'}]};
 const result=suggestNextSteps(contact);assert(result.suggestions.some(s=>s.type==='reply'&&s.basis[0].quote.includes('周末')));assert(result.suggestions.some(s=>s.text.includes('照片')&&s.basis.some(b=>b.factId==='f1'&&b.quote==='我很喜欢摄影')));assert(!result.suggestions.some(s=>s.text.includes('新工作')));assert(result.disclaimer.includes('不代表'));
});

test('reply payload includes the self profile and bounded evidence-based suggestions',()=>{
 const payload=buildReplyPayload({provider:'p',model:'m',scenario:'continue',tone:'gentle',intent:'',selfProfile:{voice:{tone:['自然'],particles:['嗯']},samples:[{text:'嗯，好呀'}]}},{self:'我',target:'小林',messages:[{sender:'小林',text:'最近在看电影'}],profileSummary:[]});
 assert.deepEqual(payload.selfProfile.voice.tone,['自然']);assert.equal(payload.selfProfile.samples[0],'嗯，好呀');assert(payload.suggestions.length);assert(payload.suggestions[0].basis[0].quote.includes('电影'));
});
