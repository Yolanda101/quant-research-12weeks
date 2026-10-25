import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {progressSummary,authLink,mountFeedback,isSyncLoading} from '../site/feedback.js';
test('record summary reports actual learning state',()=>{const week={id:'01',title:'研究数据',lessons:[{id:'a',title:'信息时点'}],exercises:[{id:'b',title:'面板数据'}]};const result=progressSummary(week,{read:['a'],passed:[],assignmentReview:{passed:false}});assert.match(result,/讲义已读：1 \/ 1/);assert.match(result,/未全部通过/);});
test('login returns to course entry using platform return_to contract',()=>{const url=new URL(authLink('signin','/course/index.html'),'https://example.test');assert.equal(url.pathname,'/signin-with-chatgpt');assert.equal(url.searchParams.get('return_to'),'/course/index.html#week/01/records');assert.equal(url.searchParams.has('returnTo'),false);});
test('private feedback has no public issue submission or GitHub API transmission',async()=>{const text=await readFile(new URL('../site/feedback.js',import.meta.url),'utf8');assert.doesNotMatch(text,/issues\/new|api\.github\.com|buildSubmission|verifySubmission/);assert.match(text,/\/api\/questions/);assert.match(text,/\/api\/assignment/);});

test('loading account renders no editable question or submit controls',()=>{
 for(const phase of ['checking','loading']){const root={innerHTML:'',querySelector(){throw new Error('Editable content must not be mounted while loading');}};mountFeedback(root,{config:{backendEnabled:true},sync:{snapshot:()=>({phase,user:{id:'student-a'}})}});assert.match(root.innerHTML,/正在读取学习记录/);assert.doesNotMatch(root.innerHTML,/<textarea|<input|<button|<form/);}
 assert.equal(isSyncLoading('ready'),false);assert.equal(isSyncLoading('pending'),false);assert.equal(isSyncLoading('conflict'),false);
});
