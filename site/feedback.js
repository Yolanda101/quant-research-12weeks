export const REPOSITORY='Yolanda101/quant-research-12weeks';
const GITHUB='https://github.com/'+REPOSITORY;
const MAX_URL_LENGTH=8000;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const marker=id=>'<!-- quant-study:'+id+' -->';
const makeId=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
const items=(definitions,selected)=>definitions.map(item=>(selected.includes(item.id)?'已完成':'未完成')+' · '+item.title).join('\n');

export function progressSummary(week,state){
 const read=Array.isArray(state.read)?state.read:[],passed=Array.isArray(state.passed)?state.passed:[];
 const quizzes=week.lessons.map(lesson=>lesson.title+'：'+(Number.isInteger(state.quiz?.[lesson.id])?state.quiz[lesson.id]+' / '+lesson.quiz.length:'未作答'));
 const review=state.assignmentReview;
 let assignment='尚无代码检查记录';
 if(review===true||review?.passed===true)assignment='代码检查通过，文字待教师阅读';
 else if(review?.passed===false)assignment='代码检查未全部通过';
 if(review?.checkedAt)assignment+='，检查时间 '+review.checkedAt;
 return ['第一周学习记录','课程：'+week.title,'讲义已读：'+read.filter(id=>week.lessons.some(item=>item.id===id)).length+' / '+week.lessons.length,items(week.lessons,read),'','测验',...quizzes,'','练习通过：'+passed.filter(id=>week.exercises.some(item=>item.id===id)).length+' / '+week.exercises.length,items(week.exercises,passed),'','作业：'+assignment].join('\n');
}

export function completeRecord(week,state,profile,submissionId){
 const text=['学习代号：'+(profile.studentId?.trim()||'未填写'),'提交编号：'+submissionId,'',progressSummary(week,state),'','当前疑问',profile.question?.trim()||'暂无',''];
 if(profile.assignmentUrl?.trim())text.push('作业链接',profile.assignmentUrl.trim(),'');
 text.push('文字解释');
 for(let i=0;i<3;i++)text.push(String(i+1)+'. '+(week.assignment?.questions?.[i]||'解释'),state.answers?.[i]?.trim()||'未填写','');
 text.push('五条记录的追溯笔记',state.auditNotes?.trim()||'未填写','',marker(submissionId));
 return text.join('\n');
}

export function buildSubmission(week,state,profile,submissionId){
 const title='[第一周学习记录] '+(profile.studentId?.trim()||'未填写');
 const summary=progressSummary(week,state);
 const common=['学习代号：'+(profile.studentId?.trim()||'未填写'),'提交编号：'+submissionId,'',summary,''];
 if(profile.assignmentUrl?.trim())common.push('作业链接：'+profile.assignmentUrl.trim(),'');
 const ending=['请将网站导出的学习记录 .txt 和作业文件拖入此处，再点击 Submit new issue。','',marker(submissionId)];
 const full=[...common,'当前疑问',profile.question?.trim()||'暂无','',...ending].join('\n');
 const makeURL=body=>GITHUB+'/issues/new?'+new URLSearchParams({title,body}).toString();
 let url=makeURL(full),attachmentRequired=false;
 if(url.length>MAX_URL_LENGTH){
  attachmentRequired=true;
  const short=['学习代号：'+(profile.studentId?.trim()||'未填写'),'提交编号：'+submissionId,'',summary,'','疑问和文字记录较长，完整内容在学习记录附件中。','请先回到学习网站导出学习记录 .txt，再将文件拖入此处。','',marker(submissionId)].join('\n');
  url=makeURL(short);
 }
 if(url.length>MAX_URL_LENGTH)throw new Error('记录摘要过长，请复制完整记录，在 GitHub 新建 Issue。');
 return {url,attachmentRequired,title,record:completeRecord(week,state,profile,submissionId)};
}

export function parseIssueURL(value){
 let url;try{url=new URL(value);}catch{throw new Error('请粘贴 GitHub 提交页面的链接。');}
 if(url.protocol!=='https:'||url.hostname!=='github.com'||url.port||url.username||url.password)throw new Error('请使用本课程仓库的 GitHub Issue 链接。');
 const match=url.pathname.match(/^\/Yolanda101\/quant-research-12weeks\/issues\/([1-9]\d*)\/?$/i);
 if(!match)throw new Error('请使用本课程仓库的 GitHub Issue 链接。');
 return {number:match[1],url:GITHUB+'/issues/'+match[1]};
}

export async function verifySubmission(value,submissionId,fetcher=globalThis.fetch){
 if(!submissionId)throw new Error('请先准备本次学习记录，再核验链接。');
 const issue=parseIssueURL(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetcher('https://api.github.com/repos/'+REPOSITORY+'/issues/'+issue.number,{headers:{Accept:'application/vnd.github+json'},signal:controller.signal});
  if(!response.ok){
   if(response.status===404)throw new Error('未找到这份提交，请检查链接。');
   if(response.status===403||response.status===429)throw new Error('GitHub 暂时限制查询，请稍后核验。');
   throw new Error('暂时无法核验，请稍后重试。');
  }
  const raw=await response.json(),data=raw.value||raw;
  if(data.pull_request||typeof data.body!=='string'||!data.body.includes(marker(submissionId)))throw new Error('这份提交不含本次记录编号，请核对后重试。');
  return {url:issue.url,number:issue.number,title:data.title||'',author:data.user?.login||'',state:data.state,verifiedAt:new Date().toISOString()};
 }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw new Error('网络暂时不可用，记录仍保存在此浏览器。');if(error instanceof SyntaxError)throw new Error('暂时无法读取 GitHub 的核验结果，请稍后重试。');throw error;}
 finally{clearTimeout(timer);}
}

export function mountFeedback(root,{week,state,profile,onChange=()=>{}}){
 if(profile.verifiedUrl){try{profile.verifiedUrl=parseIssueURL(profile.verifiedUrl).url;}catch{profile.verifiedUrl='';profile.verifiedAt='';}}
 let candidateId=profile.submissionId||makeId(),opened=!!profile.submissionId,busy=false;
 const save=()=>onChange(profile);
 const $=selector=>root.querySelector(selector);
 root.innerHTML=`<div class="feedback-stack"><section class="panel homework-brief feedback-panel"><h2>准备学习记录</h2><p>讲义、练习和作业草稿会保存在此浏览器。提交后，教师可以集中查看并回复。</p><p>提交内容会公开显示，请使用学习代号。提交时需要登录 GitHub。</p><div class="feedback-fields"><label for="feedback-student">学习代号</label><input id="feedback-student" maxlength="60" autocomplete="nickname" value="${escape(profile.studentId)}" placeholder="例如 student-01"><label for="feedback-question">当前疑问</label><textarea id="feedback-question" maxlength="12000" placeholder="写出卡住的步骤、尝试过的方法或希望教师检查的内容。">${escape(profile.question)}</textarea><label for="feedback-assignment">作业链接，可留空</label><input id="feedback-assignment" type="url" maxlength="2000" value="${escape(profile.assignmentUrl)}" placeholder="https://github.com/…"></div></section><section class="panel homework-brief feedback-panel"><h2>记录预览</h2><pre id="feedback-preview" class="feedback-preview"></pre><p>完整记录还包含三段解释和追溯笔记。作业代码请在作业页导出，再作为附件提交。</p><div class="download-row"><button id="feedback-copy" class="button secondary">复制完整记录</button><button id="feedback-download" class="button secondary">导出学习记录 .txt ↓</button></div><div id="feedback-action-status" class="form-feedback" role="status"></div></section><section class="panel homework-brief feedback-panel"><h2>提交给教师</h2><ol><li>导出学习记录和作业文件。</li><li>点击下方按钮，在 GitHub 核对内容并添加附件。</li><li>点击 GitHub 页面中的 Submit new issue。</li><li>把生成的 Issue 链接粘贴到下方，再核验提交。</li></ol><p id="feedback-length-note" class="muted" hidden></p><div class="download-row"><button id="feedback-open" class="button primary">去 GitHub 提交 ↗</button></div><p id="feedback-submit-status" class="form-feedback" role="status"></p><div class="feedback-fields"><label for="feedback-issue">已提交的 Issue 链接</label><input id="feedback-issue" type="url" value="${escape(profile.submissionUrl)}" placeholder="https://github.com/${REPOSITORY}/issues/123"></div><div class="download-row"><button id="feedback-verify" class="button secondary">核验提交</button><a id="feedback-replies" class="button secondary" target="_blank" rel="noopener noreferrer" hidden>查看教师回复 ↗</a></div><p id="feedback-verify-status" class="form-feedback" role="status"></p></section></div>`;
 const build=()=>buildSubmission(week,state,profile,candidateId);
 const record=()=>completeRecord(week,state,profile,candidateId);
 function update(){
  $('#feedback-preview').textContent=progressSummary(week,state);
  let long=false;try{long=build().attachmentRequired;}catch{long=true;}
  $('#feedback-length-note').hidden=!long;
  $('#feedback-length-note').textContent='疑问较长，请导出完整记录作为附件。GitHub 表单保留进度摘要和提交编号。';
  $('#feedback-submit-status').textContent=profile.verifiedUrl?'已核验上次提交。新的学习进度需重新提交。':opened?'待完成提交。请在 GitHub 点击 Submit new issue，再回来核验链接。':'尚未提交。';
  const reply=$('#feedback-replies');reply.hidden=!profile.verifiedUrl;if(profile.verifiedUrl)reply.href=profile.verifiedUrl;
 }
 function changed(){
  profile.studentId=$('#feedback-student').value;profile.question=$('#feedback-question').value;profile.assignmentUrl=$('#feedback-assignment').value;
  if(opened||profile.verifiedUrl){candidateId=makeId();profile.submissionId='';profile.verifiedUrl='';profile.verifiedAt='';profile.submissionUrl='';$('#feedback-issue').value='';opened=false;}
  save();update();
 }
 for(const id of ['feedback-student','feedback-question','feedback-assignment'])$('#'+id).oninput=changed;
 $('#feedback-issue').oninput=()=>{profile.submissionUrl=$('#feedback-issue').value;save();};
 $('#feedback-copy').onclick=async()=>{
  try{await navigator.clipboard.writeText(record());$('#feedback-action-status').textContent='完整记录已复制。';}
  catch{const area=document.createElement('textarea');area.value=record();root.append(area);area.select();let copied=false;try{copied=document.execCommand('copy');}catch{}area.remove();$('#feedback-action-status').textContent=copied?'完整记录已复制。':'复制失败，请导出学习记录。';}
 };
 $('#feedback-download').onclick=()=>{
  profile.submissionId=candidateId;opened=true;save();update();
  const objectURL=URL.createObjectURL(new Blob([record()],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=objectURL;link.download='week01-learning-record.txt';link.click();setTimeout(()=>URL.revokeObjectURL(objectURL),1000);$('#feedback-action-status').textContent='学习记录已导出，请保留文件并在 GitHub 添加附件。';
 };
 $('#feedback-open').onclick=()=>{
  if(!profile.studentId?.trim()){$('#feedback-action-status').textContent='请先填写学习代号。';$('#feedback-student').focus();return;}
  if(profile.assignmentUrl?.trim()){try{const u=new URL(profile.assignmentUrl);if(!['https:','http:'].includes(u.protocol))throw new Error();}catch{$('#feedback-action-status').textContent='请填写完整的作业链接，或清空这一项。';$('#feedback-assignment').focus();return;}}
  try{
   if(profile.verifiedUrl){candidateId=makeId();profile.verifiedUrl='';profile.verifiedAt='';profile.submissionUrl='';$('#feedback-issue').value='';}
   const submission=build();profile.submissionId=candidateId;opened=true;save();update();
   const link=document.createElement('a');link.href=submission.url;link.target='_blank';link.rel='noopener noreferrer';root.append(link);link.click();link.remove();
  }catch(error){$('#feedback-action-status').textContent=error.message;}
 };
 $('#feedback-verify').onclick=async()=>{
  if(busy)return;busy=true;$('#feedback-verify').disabled=true;$('#feedback-verify-status').textContent='正在核验提交。';
  const pendingId=profile.submissionId,pendingURL=profile.submissionUrl;
  try{
   const result=await verifySubmission(pendingURL,pendingId);
   if(!root.isConnected||profile.submissionId!==pendingId||profile.submissionUrl!==pendingURL)return;
   profile.verifiedUrl=result.url;profile.verifiedAt=result.verifiedAt;profile.submissionUrl=result.url;$('#feedback-issue').value=result.url;save();update();$('#feedback-verify-status').textContent='已找到本次提交，教师可以查看。';
  }catch(error){if(root.isConnected)$('#feedback-verify-status').textContent=error.message;}
  finally{busy=false;if(root.isConnected)$('#feedback-verify').disabled=false;}
 };
 update();
}
