import test from 'node:test';
import assert from 'node:assert/strict';
import {REPOSITORY,progressSummary,completeRecord,buildSubmission,parseIssueURL,verifySubmission} from '../site/feedback.js';
const week={title:'研究数据和信息时点',lessons:[{id:'schema',title:'数据字典',quiz:[{},{}]},{id:'universe',title:'历史股票池',quiz:[{},{}]}],exercises:[{id:'audit-schema',title:'检查字段'}],assignment:{questions:['问题一','问题二','问题三']}};
const state={read:['schema'],quiz:{schema:2},passed:['audit-schema'],answers:['解释一','解释二','解释三'],auditNotes:'五条追溯笔记',drafts:{assignment:'print("SECRET_CODE")'},assignmentReview:{passed:true,checkedAt:'2026-10-25T00:00:00Z'}};
const profile={studentId:'student-01',question:'为什么修订版不能提前使用？',assignmentUrl:'https://github.com/example/work/blob/main/week01.py'};
test('摘要使用实际进度，完整记录含解释和笔记但不含代码',()=>{
 const summary=progressSummary(week,state),record=completeRecord(week,state,profile,'abc-1');
 assert.match(summary,/讲义已读：1 \/ 2/);assert.match(summary,/数据字典：2 \/ 2/);assert.match(summary,/历史股票池：未作答/);assert.match(summary,/代码检查通过/);assert.match(record,/解释三/);assert.match(record,/五条追溯笔记/);assert.doesNotMatch(record,/SECRET_CODE/);
});
test('预填地址只使用title和body，正文保留唯一记录编号',()=>{
 const result=buildSubmission(week,state,profile,'abc-1'),url=new URL(result.url);
 assert.equal(url.origin,'https://github.com');assert.equal(url.pathname,'/'+REPOSITORY+'/issues/new');assert.deepEqual([...url.searchParams.keys()],['title','body']);assert.match(url.searchParams.get('body'),/<!-- quant-study:abc-1 -->/);assert.match(url.searchParams.get('body'),/为什么修订版不能提前使用/);assert.equal(result.attachmentRequired,false);assert.doesNotMatch(url.searchParams.get('body'),/解释三/);
});
test('长正文改用附件提示，完整记录保持原文',()=>{
 const question='疑问'.repeat(10000),result=buildSubmission(week,state,{...profile,question},'abc-long');
 assert.ok(result.url.length<=8000);assert.equal(result.attachmentRequired,true);assert.ok(result.record.includes(question));assert.match(new URL(result.url).searchParams.get('body'),/完整内容在学习记录附件中/);
});
test('仅接受同仓库https Issue链接，拒绝PR、假域名和凭据',()=>{
 assert.deepEqual(parseIssueURL('https://github.com/yolanda101/quant-research-12weeks/issues/12#issuecomment-4'),{number:'12',url:'https://github.com/'+REPOSITORY+'/issues/12'});
 for(const url of ['https://evil.example/Yolanda101/quant-research-12weeks/issues/12','https://github.com/Yolanda101/other/issues/12','https://github.com/'+REPOSITORY+'/pull/12','https://user@github.com/'+REPOSITORY+'/issues/12','http://github.com/'+REPOSITORY+'/issues/12','https://github.com/'+REPOSITORY+'/issues/0'])assert.throws(()=>parseIssueURL(url));
});
test('核验从公开API读取同一次记录，不发送授权头',async()=>{
 let actual;
 const result=await verifySubmission('https://github.com/'+REPOSITORY+'/issues/12','abc-1',async(url,options)=>{actual={url,options};return{ok:true,json:async()=>({body:'<!-- quant-study:abc-1 -->',title:'学习记录',user:{login:'student'},state:'open'})};});
 assert.equal(actual.url,'https://api.github.com/repos/'+REPOSITORY+'/issues/12');assert.equal(actual.options.headers.Authorization,undefined);assert.equal(result.number,'12');assert.equal(result.author,'student');assert.ok(result.verifiedAt);
});
test('不存在、错误编号和PR不能核验成功',async()=>{
 const url='https://github.com/'+REPOSITORY+'/issues/12';
 await assert.rejects(()=>verifySubmission(url,'',async()=>{}),/先准备/);
 await assert.rejects(()=>verifySubmission(url,'abc-1',async()=>({ok:false,status:404})),/未找到/);
 await assert.rejects(()=>verifySubmission(url,'abc-1',async()=>({ok:true,json:async()=>({body:'<!-- quant-study:another -->'})})),/不含本次/);
 await assert.rejects(()=>verifySubmission(url,'abc-1',async()=>({ok:true,json:async()=>({body:'<!-- quant-study:abc-1 -->',pull_request:{}})})),/不含本次/);
});
test('限流和断网返回准确状态',async()=>{
 const url='https://github.com/'+REPOSITORY+'/issues/12';
 await assert.rejects(()=>verifySubmission(url,'abc-1',async()=>({ok:false,status:403})),/限制查询/);
 await assert.rejects(()=>verifySubmission(url,'abc-1',async()=>{throw new TypeError('fetch failed');}),/网络暂时不可用/);
});
