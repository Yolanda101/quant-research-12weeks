import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,normalizeState,compounded,overallProgress} from '../site/state.js';
test('复利使用增长倍数，不把收益相加',()=>{assert.ok(Math.abs(compounded(10,-10)+.01)<1e-10);assert.ok(Math.abs(compounded(10,20)-.32)<1e-10);});
test('导入仅保留已知课程和有效数据',()=>{const s=normalizeState({version:1,read:['python','python','x'],passed:['rate','rate'],quiz:{python:100,returns:2},drafts:{rate:'print(1)',__proto__:'x'},answers:['a',2,'c']});assert.deepEqual(s.read,['python']);assert.deepEqual(s.passed,['rate']);assert.deepEqual(s.quiz,{returns:2});assert.deepEqual(s.answers,['a','','c']);assert.equal(s.drafts.rate,'print(1)');assert.equal(overallProgress(s),20);});
test('损坏备份不会被当作空记录导入',()=>{assert.throws(()=>normalizeState(null));assert.throws(()=>normalizeState({version:2}));});
test('新记录的数组和字典彼此独立',()=>{const a=freshState(),b=freshState();a.read.push('python');a.drafts.rate='x';assert.deepEqual(b.read,[]);assert.deepEqual(b.drafts,{});});

test('旧版第一周记录可迁移，其他周使用空记录',async()=>{
 const {normalizeCourseState}=await import('../site/state.js');
 const definitions=Array.from({length:4},(_,i)=>({id:String(i+1).padStart(2,'0'),lessons:i?[{id:'intro',quiz:[{},{}]}]:[{id:'python',quiz:[{},{}]}],exercises:[{id:i?'practice':'rate'}]}));
 const course=normalizeCourseState({version:1,read:['python'],passed:['rate'],drafts:{rate:'print(1)'},answers:['一','二','三'],lastLesson:'python'},definitions);
 assert.equal(course.version,3);assert.deepEqual(course.weeks['01'].read,['python']);assert.equal(course.weeks['01'].drafts.rate,'print(1)');
 assert.deepEqual(course.weeks['02'].read,[]);assert.equal(course.weeks['02'].lastLesson,'intro');
});
test('各周相同练习名分别保存，导入保留相应周次',async()=>{
 const {freshCourseState,normalizeCourseState}=await import('../site/state.js');
 const definitions=Array.from({length:4},(_,i)=>({id:String(i+1).padStart(2,'0'),lessons:[{id:'intro',quiz:[{},{}]}],exercises:[{id:'practice'}]}));
 const course=freshCourseState(definitions);course.currentWeek='03';course.weeks['02'].drafts.practice='second';course.weeks['03'].drafts.practice='third';course.weeks['03'].read=['intro'];
 const restored=normalizeCourseState(JSON.parse(JSON.stringify(course)),definitions);
 assert.equal(restored.currentWeek,'03');assert.equal(restored.weeks['02'].drafts.practice,'second');assert.equal(restored.weeks['03'].drafts.practice,'third');assert.deepEqual(restored.weeks['02'].read,[]);
});
test('新课程的周次记录和解释互不共用数组',async()=>{
 const {freshCourseState}=await import('../site/state.js');
 const definitions=[{id:'01',lessons:[{id:'a'}]},{id:'02',lessons:[{id:'b'}]}];
 const course=freshCourseState(definitions);course.weeks['01'].answers[0]='一';course.weeks['01'].read.push('a');
 assert.equal(course.weeks['02'].answers[0],'');assert.deepEqual(course.weeks['02'].read,[]);
});

test('课程内容更新后隔离旧作业并保留旧记录',async()=>{
 const {normalizeCourseState}=await import('../site/state.js');
 const definitions=[{id:'01',revision:2,lessons:[{id:'schema',quiz:[{},{}]}],exercises:[{id:'audit-schema'}]},{id:'02',lessons:[{id:'intro',quiz:[{},{}]}],exercises:[{id:'practice'}]}];
 const old={version:2,currentWeek:'02',weeks:{'01':{...freshState(),read:['python'],drafts:{assignment:'old homework'},answers:['旧解释','','']},'02':{...freshState('intro'),drafts:{practice:'keep second'}}}};
 const next=normalizeCourseState(old,definitions);
 assert.equal(next.weeks['01'].revision,2);assert.deepEqual(next.weeks['01'].drafts,{});assert.equal(next.weeks['01'].answers[0],'');
 assert.equal(next.archives['week01.v1'].drafts.assignment,'old homework');assert.equal(next.weeks['02'].drafts.practice,'keep second');
 next.weeks['01'].drafts.assignment='new homework';next.weeks['01'].auditNotes='保存五条追溯记录';
 const restored=normalizeCourseState(JSON.parse(JSON.stringify(next)),definitions);
 assert.equal(restored.weeks['01'].drafts.assignment,'new homework');assert.equal(restored.weeks['01'].auditNotes,'保存五条追溯记录');assert.equal(restored.archives['week01.v1'].answers[0],'旧解释');
});

test('学习记录和作业检查结果能保存后恢复',async()=>{
 const {freshCourseState,normalizeCourseState}=await import('../site/state.js');
 const definitions=[{id:'01',revision:2,lessons:[{id:'schema',quiz:[{},{}]}],exercises:[{id:'audit-schema'}]}];
 const course=freshCourseState(definitions);course.feedback['01']={studentId:'student-01',question:'如何处理晚到财报？',submissionId:'record-1',verifiedUrl:'https://github.com/Yolanda101/quant-research-12weeks/issues/1'};
 course.weeks['01'].assignmentReview={passed:true,checkedAt:'2026-10-25T00:00:00Z'};
 const restored=normalizeCourseState(JSON.parse(JSON.stringify(course)),definitions);
 assert.equal(restored.feedback['01'].studentId,'student-01');assert.equal(restored.feedback['01'].submissionId,'record-1');assert.equal(restored.weeks['01'].assignmentReview.passed,true);
});
