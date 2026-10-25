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
 const ending=['请将网站导出的学习记录 .txt 和作业文件拖入此处，再点击 创建按钮。','',marker(submissionId)];
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

export function mountFeedback(root){
  root.innerHTML = '<section class="panel feedback-panel"><h2>学习记录</h2><p>公开提交入口已关闭。你的学习记录仍保存在当前浏览器。</p><p>登录同步和私有答疑正在接入。</p></section>';
}
