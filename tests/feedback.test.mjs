import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {progressSummary,authLink,mountFeedback,isSyncLoading,studentAuthHTML,registrationURL} from '../site/feedback.js';
test('record summary reports actual learning state',()=>{const week={id:'01',title:'研究数据',lessons:[{id:'a',title:'信息时点'}],exercises:[{id:'b',title:'面板数据'}]};const result=progressSummary(week,{read:['a'],passed:[],assignmentReview:{passed:false}});assert.match(result,/讲义已读：1 \/ 1/);assert.match(result,/未全部通过/);});
test('login returns to course entry using platform return_to contract',()=>{const url=new URL(authLink('signin','/course/index.html'),'https://example.test');assert.equal(url.pathname,'/signin-with-chatgpt');assert.equal(url.searchParams.get('return_to'),'/course/index.html#week/01/records');assert.equal(url.searchParams.has('returnTo'),false);});
test('private feedback has no public issue submission or GitHub API transmission',async()=>{const text=await readFile(new URL('../site/feedback.js',import.meta.url),'utf8');assert.doesNotMatch(text,/issues\/new|api\.github\.com|buildSubmission|verifySubmission/);assert.match(text,/\/api\/questions/);assert.match(text,/\/api\/assignment/);});

test('loading account renders no editable question or submit controls',()=>{
 for(const phase of ['checking','loading']){const root={innerHTML:'',querySelector(){throw new Error('Editable content must not be mounted while loading');}};mountFeedback(root,{config:{backendEnabled:true},sync:{snapshot:()=>({phase,user:{id:'student-a'}})}});assert.match(root.innerHTML,/正在读取学习记录/);assert.doesNotMatch(root.innerHTML,/<textarea|<input|<button|<form/);}
 assert.equal(isSyncLoading('ready'),false);assert.equal(isSyncLoading('pending'),false);assert.equal(isSyncLoading('conflict'),false);
});

test('student login uses a username and password, teacher access stays separate',()=>{
 const html=studentAuthHTML();assert.match(html,/name="username"/);assert.match(html,/name="password" type="password" autocomplete="current-password"/);assert.doesNotMatch(html,/>登录 ChatGPT|>使用 ChatGPT|>登录学习账号<\/a>/);assert.match(html,/teacher-auth-entry/);assert.doesNotMatch(html,/name="displayName"/);
});
test('registration needs an invitation and collects password confirmation without embedding invite token',()=>{
 const blocked=studentAuthHTML({register:true});assert.match(blocked,/请使用教师提供的注册链接注册/);assert.match(blocked,/type="submit" disabled/);
 const allowed=studentAuthHTML({register:true,invite:'private-token'});assert.match(allowed,/name="displayName"/);assert.match(allowed,/name="confirmPassword" type="password" autocomplete="new-password"/);assert.match(allowed,/minlength="10" maxlength="128"/);assert.doesNotMatch(allowed,/private-token|type="submit" disabled/);
});
test('registration URL contains only invitation parameters and course records route',()=>{
 const url=new URL(registrationURL('token-one','https://example.test/course/index.html?old=1#teacher'));assert.equal(url.pathname,'/course/index.html');assert.equal(url.searchParams.get('register'),'1');assert.equal(url.searchParams.get('invite'),'token-one');assert.equal(url.searchParams.has('old'),false);assert.equal(url.hash,'#week/01/records');
});
