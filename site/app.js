import {weeks,weekById} from './curriculum.js';
import {PythonEngine} from './python-engine.js';
import {KEY,COURSE_KEY,LEGACY_COURSE_KEY,freshCourseState,normalizeCourseState,overallProgress} from './state.js';
import {mountWorkbench} from './week01-workbench.js';
import {mountFeedback,mountTeacher,updateAccountStatus,authLink,isSyncLoading} from './feedback.js';
import {PrivateSync} from './sync.js';

const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chinese=['','一','二','三','四'];
let course=freshCourseState(weeks),storageOK=true,sync=null,portalConfig={backendEnabled:false,privatePortalUrl:''},anonymousCourse=null,browserStorage=null;
try{browserStorage=window.localStorage;}catch{storageOK=false;}
try{const saved=localStorage.getItem(COURSE_KEY)||localStorage.getItem(LEGACY_COURSE_KEY)||localStorage.getItem(KEY);if(saved)course=normalizeCourseState(JSON.parse(saved),weeks);}catch{storageOK=false;}
let week=weekById(course.currentWeek),state=course.weeks[week.id],lessons=week.lessons,exercises=week.exercises;
let activeExercise=exercises[0].id,busy=false,toastTimer,renderToken=0;
const assignmentTemplates=new Map();
const engine=new PythonEngine({onStatus:({message})=>document.querySelectorAll('[data-runtime]').forEach(x=>x.textContent=message)});
const url=(route='overview',id='')=>`#week/${week.id}/${route}${id?'/'+id:''}`;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
function save(){
 if(sync?.user){if(sync.phase!=='loading')sync.update(course);return;}
 try{localStorage.setItem(COURSE_KEY,JSON.stringify(course));storageOK=true;anonymousCourse=JSON.parse(JSON.stringify(course));}
 catch{storageOK=false;$('#notice').hidden=false;$('#notice').textContent='浏览器暂时无法保存记录，请使用导出记录备份。';}
 $('#storage-label').textContent=storageOK?'记录保存在此浏览器':'请导出记录备份';
}
function download(name,text,type='text/plain;charset=utf-8'){
 const blob=new Blob([text],{type}),objectURL=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=objectURL;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(objectURL),1000);
}
function progressHTML(){
 const progress=overallProgress(state,lessons.length,exercises.length);
 return `<section class="panel progress-card"><div class="progress-top"><h2>本周进度</h2></div><div class="progress-ring" role="progressbar" aria-label="讲义和练习进度" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100" style="--progress:${progress}%"><div><b>${progress}<small>%</small></b><span>讲义和练习</span></div></div><p>已读 ${state.read.length} / ${lessons.length} 节 · 练习通过 ${state.passed.length} / ${exercises.length} 项</p></section>`;
}
function heading(title,description,tag=''){
 return `<div class="heading-row"><div><div class="eyebrow">第 ${week.id} 周 / ${escape(week.title)}</div><h1>${escape(title)}</h1><p class="description">${escape(description)}</p></div>${tag?`<span class="week-badge">${escape(tag)}</span>`:''}</div>`;
}
function researchOverview(){
 const progress=overallProgress(state,lessons.length,exercises.length);
 const started=state.read.length||Object.keys(state.drafts).length;
 $('#main').innerHTML=heading(week.title,week.summary)+`<div class="study-overview"><section class="hero"><div class="hero-copy"><div class="eyebrow">本周问题</div><h2>${escape(week.opening)}</h2><p>${escape(week.openingText)}</p><div class="study-actions"><a href="${url('workbench')}" class="button primary">进入数据实验 ↗</a><a href="${url('lesson',state.lastLesson)}" class="button secondary">${started?'继续学习':'开始第一节'}</a></div></div><div class="study-facts"><span><b>06</b>节讲义</span><span><b>06</b>项代码练习</span><span><b>28</b>小时</span><span><b>01</b>份研究记录</span></div></section><section class="panel study-section"><div class="eyebrow">完成本周后</div><h2>你需要回答的问题</h2><ul class="study-goals">${week.objectives.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></section><section class="panel study-section"><div class="eyebrow">学习任务</div><h2>按顺序完成六项任务</h2><p>先核对样本，再读讲义和运行代码。每项任务保留一份计算结果和文字解释。</p><ol class="session-list">${week.sessions.map((session,i)=>{const l=lessons.find(l=>l.id===session.lesson),done=state.read.includes(l.id),passed=state.passed.includes(session.exercise);return `<li class="session-item"><div class="session-title"><span class="lesson-number">${String(i+1).padStart(2,'0')}</span><h3>${escape(l.title)}</h3><span class="muted">${session.hours} 小时${done?' · 讲义已读':''}${passed?' · 练习通过':''}</span></div><p>${escape(session.task)}</p><div class="session-output">保存：${escape(session.output)}</div><div class="session-links"><a class="text-link" href="${url('lesson',l.id)}">阅读讲义 ↗</a><a class="text-link" href="${url('lab',session.exercise)}">完成代码练习 ↗</a></div></li>`;}).join('')}</ol><div class="overview-progress"><a class="text-link" href="${url('records')}">查看学习记录 ↗</a><p>已读 ${state.read.length} / 6 节 · 练习通过 ${state.passed.length} / 6 项</p><div class="progress-bar" role="progressbar" aria-label="本周学习进度" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${progress}%"></div></div></div></section><section class="panel study-section"><div class="eyebrow">数学和统计</div><h2>把概念用在当前样本</h2><p>用向量和矩阵表示股票面板，计算对数收益和复利，比较条件均值、方差和协方差。检查同日记录的相关性，区分数据行数和独立信息。</p><div class="study-actions"><a class="button secondary" href="${url('lesson','schema')}">查看面板表示</a><a class="button secondary" href="${url('lesson','pricing')}">计算收益标签</a></div></section><section class="panel study-section"><div class="eyebrow">本周作业</div><h2>提交一份数据审计</h2><p>${escape(week.assignment.intro)}</p><p style="margin-top:12px">抽查五条记录，写清原值、公开时间、首次可用时间、信号截止和最早成交。补齐代码，再解释你发现的错误。</p><div class="study-actions"><a class="button primary" href="${url('assignment')}">开始本周作业 ↗</a><a class="button secondary" href="./downloads/week01.md" download>下载本周讲义 ↓</a></div></section></div>`;
}
let workbenchData;
async function workbenchPage(token){
 $('#main').innerHTML=heading('数据实验','选择日期和信号时点，追溯每条记录的来源。')+'<section class="panel study-section"><p>正在读取样本。</p></section>';
 try{
  if(!workbenchData){const response=await fetch('./downloads/week01-lab.json');if(!response.ok)throw new Error('sample');workbenchData=await response.json();}
  if(token!==renderToken)return;
  $('#main').innerHTML=heading('数据实验','使用虚构市场样本和配套交易日历。所有时点按上海时区显示。')+'<div id="data-workbench"></div>';
  mountWorkbench($('#data-workbench'),workbenchData);
 }catch{if(token!==renderToken)return;$('#main').innerHTML=heading('数据实验','样本暂时没有加载成功。')+'<section class="panel study-section"><button class="button secondary" id="retry-workbench">重新加载</button></section>';$('#retry-workbench').onclick=render;}
}
function overview(){
 if(week.id==='01'){researchOverview();return;}
 $('#main').innerHTML=heading(week.title,week.summary)+`<section class="hero"><div class="hero-copy"><div class="eyebrow">本周从这里开始</div><h2>${escape(week.opening)}</h2><p>${escape(week.openingText)}</p><a href="${url('lesson',state.lastLesson)}" class="button primary">${state.read.length?'继续学习':'开始第一节'} <span aria-hidden="true">↗</span></a></div></section><div class="overview-grid"><section class="panel"><div class="panel-header"><h2>本周讲义</h2><span class="muted">${lessons.length} 节 · 按顺序学习</span></div><div class="lesson-list">${lessons.map(l=>`<a href="${url('lesson',l.id)}" class="lesson-card"><span class="lesson-number">${l.number}</span><div><h3>${escape(l.title)}</h3><p>${escape(l.summary)}</p></div><span class="arrow">${state.read.includes(l.id)?'<span class="completed-tag">已读</span>':'↗'}</span></a>`).join('')}</div></section><div class="side-stack">${progressHTML()}<section class="panel homework-brief"><h2>本周作业</h2><p>${escape(week.assignment.intro)}</p><div class="download-row"><a class="button secondary" href="${url('assignment')}">查看作业</a><a class="text-link" href="./downloads/week${week.id}.md" download>下载本周讲义 ↓</a></div></section></div></div>`;
}
function lessonPage(id){
 const lesson=lessons.find(x=>x.id===id)||lessons[0],index=lessons.indexOf(lesson);
 state.lastLesson=lesson.id;save();
 const body=lesson.html.replace('<h3>预期输出</h3>','<h3>示例代码</h3><pre><code>'+escape(lesson.example)+'</code></pre><h3>预期输出</h3>');
 $('#main').innerHTML=heading(lesson.title,lesson.summary,'讲义 '+lesson.number)+`<nav class="lesson-tabs" aria-label="讲义目录">${lessons.map(x=>`<a href="${url('lesson',x.id)}" class="${lesson.id===x.id?'active':''}">${x.number} ${escape(x.title)}</a>`).join('')}</nav><div class="reading-layout"><article class="article">${body}<section class="quiz"><h3>检查理解</h3><form id="quiz-form">${lesson.quiz.map((q,i)=>`<div class="quiz-question"><fieldset><legend>${i+1}. ${escape(q.question)}</legend><div class="quiz-options">${q.options.map((option,j)=>`<label><input type="radio" name="q${i}" value="${j}" required><span>${escape(option)}</span></label>`).join('')}</div></fieldset><div id="quiz-feedback-${i}" role="status"></div></div>`).join('')}<button class="button secondary" type="submit">核对答案</button></form></section><div class="lesson-bottom"><a class="button ghost" href="${index?url('lesson',lessons[index-1].id):url()}">← ${index?'上一节':'本周概览'}</a><button class="button primary" id="mark-read">继续</button></div></article><aside class="panel reading-aside"><div class="eyebrow">本节练习</div><h3>把示例运行一次</h3><p>修改一个输入或参数，运行代码。核对输出后，解释发生了什么变化。</p><button id="open-example" class="button primary">运行本节示例 ↗</button><a href="${url('lab')}" class="button secondary">进入代码练习</a><a href="./downloads/week${week.id}.md" download class="text-link" style="display:block;margin-top:17px">下载本周讲义 ↓</a></aside></div>`;
 $('#quiz-form').onsubmit=event=>{event.preventDefault();let score=0;lesson.quiz.forEach((q,i)=>{const selected=new FormData(event.target).get('q'+i),correct=selected!==null&&+selected===q.answer;if(correct)score++;const target=$('#quiz-feedback-'+i);target.className='quiz-feedback '+(correct?'good':'bad');target.textContent=(correct?'回答正确。':'再看一下。')+q.explanation;});state.quiz[lesson.id]=score;save();toast(`答对 ${score} / ${lesson.quiz.length} 题`);};
 $('#mark-read').onclick=()=>{if(!state.read.includes(lesson.id))state.read.push(lesson.id);save();location.hash=index<lessons.length-1?url('lesson',lessons[index+1].id):url('lab');};
 $('#open-example').onclick=()=>location.hash=url('lab','example-'+lesson.id);
}
function editorHTML(code,filename='practice.py'){return `<div class="editor"><div class="editor-top"><span><i class="editor-dot"></i> ${filename}</span><span>Python</span></div><textarea id="code-editor" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Python 代码">${escape(code)}</textarea><div class="editor-tools"><button id="run-code" class="button primary small">▶ 运行代码</button><button id="check-code" class="button secondary small">检查练习</button><button id="stop-code" class="button ghost" hidden>停止</button><button id="reset-code" class="button ghost">重置</button><span data-runtime class="runtime">点击运行后加载 Python</span></div></div><div class="output-block"><div class="output-label"><span>运行结果</span><span>⌘ / Ctrl + Enter 运行</span></div><pre id="code-output" class="output" role="status" aria-live="polite">运行后，输出会显示在这里。</pre><ul id="checks" class="checks" aria-live="polite"></ul></div>`;}
function setBusy(value){busy=value;['#run-code','#check-code','#reset-code'].forEach(s=>{if($(s))$(s).disabled=value;});if($('#stop-code'))$('#stop-code').hidden=!value;if($('#code-editor'))$('#code-editor').readOnly=value;}
function showResult(r){const out=$('#code-output');if(!out)return;out.textContent=[r.stdout,r.stderr,r.error].filter(Boolean).join('\n')||'运行完成，没有输出。可以使用 print 显示结果。';out.classList.toggle('error',!!r.error);$('#checks').innerHTML=(r.checks||[]).map(x=>`<li class="${x.passed?'':'fail'}"><span>${x.passed?'✓':'×'}</span><span>${x.passed?'通过':'未通过'} · ${escape(x.label)}${x.detail?`<small class="detail">${escape(x.detail)}</small>`:''}</span></li>`).join('');}
function attachEditor({key,initial,check='',assignment=false}){
 const editor=$('#code-editor');
 editor.oninput=()=>{state.drafts[key]=editor.value;if(assignment)state.assignmentReview=null;if(!assignment)state.passed=state.passed.filter(x=>x!==key);save();};
 editor.onkeydown=e=>{if(e.key==='Tab'){e.preventDefault();const start=editor.selectionStart;editor.setRangeText('    ',start,editor.selectionEnd,'end');editor.dispatchEvent(new Event('input'));}if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();if(!busy)run(false);}};
 async function run(validate){
  if(busy)return;const runToken=renderToken;let code=editor.value;if(assignment)code+='\n\nanswers = '+JSON.stringify(state.answers)+'\n';
  state.drafts[key]=editor.value;save();setBusy(true);$('#code-output').textContent='正在准备 Python 环境…';$('#code-output').classList.remove('error');$('#checks').innerHTML='';
  try{const result=await engine.run(code,{checkCode:validate?check:''});if(runToken!==renderToken)return;showResult(result);if(validate&&assignment){state.assignmentReview={passed:!result.error&&!!result.checks.length&&result.checks.every(x=>x.passed),checkedAt:new Date().toISOString()};save();}if(validate&&!assignment&&!result.error&&result.checks.length&&result.checks.every(x=>x.passed)){if(!state.passed.includes(key))state.passed.push(key);save();toast('练习检查通过');}if(validate&&assignment&&!result.error&&result.checks.length&&result.checks.every(x=>x.passed))toast('计算检查通过，文字解释请交给指导者审阅');}
  catch(e){if(runToken===renderToken)showResult({error:e.message,checks:[]});}finally{if(runToken===renderToken)setBusy(false);}
 }
 $('#run-code').onclick=()=>run(false);$('#check-code').onclick=()=>run(true);$('#stop-code').onclick=()=>engine.cancel();
 if(!check)$('#check-code').hidden=true;
 $('#reset-code').onclick=()=>{if(!confirm('重置本页代码？当前代码会被替换。'))return;editor.value=initial;if(assignment)state.assignmentReview=null;state.drafts[key]=initial;state.passed=state.passed.filter(x=>x!==key);save();$('#checks').innerHTML='';$('#code-output').textContent='代码已重置。';};
}
function labPage(id){
 let exercise=exercises.find(x=>x.id===id);const example=lessons.find(x=>'example-'+x.id===id);
 if(example)exercise={id,title:example.title,description:'这是讲义中的完整示例。先运行，再修改一个输入或参数并核对输出。',target:'修改代码后重新运行，观察结果',code:example.example,hint:'先核对数据和变量单位，再比较修改前后的结果。',check:''};
 if(!exercise)exercise=exercises[0];activeExercise=exercise.id;
 $('#main').innerHTML=heading('代码练习','先写出计算，再运行并检查。每次运行都会重新开始，请保留本题需要的全部代码。',exercises.length+' 项练习')+`<div class="lab-layout"><nav class="panel lab-nav" aria-label="练习目录">${exercises.map((x,i)=>`<button data-exercise="${x.id}" class="${x.id===exercise.id?'active':''}"><span>${String(i+1).padStart(2,'0')}</span>${escape(x.title)}${state.passed.includes(x.id)?' ✓':''}</button>`).join('')}${example?'<button class="active"><span>↳</span>讲义示例</button>':''}<p>代码会自动保存。登录后可同步到学习账号。首次运行需要下载 Python 环境和本周使用的计算工具。</p></nav><section class="panel"><div class="task"><h2>${escape(exercise.title)}</h2><p>${escape(exercise.description)}</p><div class="target">${escape(exercise.target)}</div><details><summary>查看提示</summary><p>${escape(exercise.hint)}</p></details></div>${editorHTML(state.drafts[exercise.id]??exercise.code)}<div class="export-help"><button id="download-practice" class="text-link">下载这段代码 ↓</button></div></section></div>`;
 document.querySelectorAll('[data-exercise]').forEach(button=>button.onclick=()=>location.hash=url('lab',button.dataset.exercise));
 attachEditor({key:exercise.id,initial:exercise.code,check:exercise.check});
 $('#download-practice').onclick=()=>download('week'+week.id+'-'+exercise.id+'.py',$('#code-editor').value);
}
function notebook(code){return {cells:[{cell_type:'markdown',metadata:{},id:'instructions',source:[`# 第${chinese[week.number]}周作业\n`,week.title]},{cell_type:'code',metadata:{},id:'solution',source:code.split(/(?<=\n)/),execution_count:null,outputs:[]}],metadata:{kernelspec:{display_name:'Python 3',language:'python',name:'python3'},language_info:{name:'python',version:'3.12'}},nbformat:4,nbformat_minor:5};}
async function assignmentPage(token){
 const id=week.id,assignment=week.assignment,filename='week'+id;
 if(!assignmentTemplates.has(id)){
  try{const response=await fetch('./downloads/'+filename+'.py');if(!response.ok)throw new Error();assignmentTemplates.set(id,await response.text());}
  catch{if(token!==renderToken)return;$('#main').innerHTML=heading('本周作业','作业模板暂时没有加载成功。')+'<div class="panel empty"><p>请检查网络后重试。</p><button id="retry-assignment" class="button primary">重新加载</button></div>';$('#retry-assignment').onclick=render;return;}
 }
 if(token!==renderToken)return;
 const template=assignmentTemplates.get(id);
 const downloads=`<div class="download-row">${assignment.dataFiles.map(f=>`<a class="button secondary small" href="./downloads/${f.file}" download>${escape(f.label)} ↓</a>`).join('')}<a class="button secondary small" href="./downloads/${filename}.py" download>Python 模板 ↓</a><a class="button secondary small" href="./downloads/${filename}.ipynb" download>Notebook 模板 ↓</a></div>`;
 $('#main').innerHTML=heading('本周作业',assignment.intro)+`<div class="homework-top">${assignment.sections}</div><section class="panel homework-brief"><h2>作业资料</h2>${downloads}</section><section class="panel assignment-workspace"><div class="task"><h2>完成作业</h2><p>补齐模板中的代码。文字解释在下方填写，导出时会一同保存。</p></div>${editorHTML(state.drafts.assignment??template,filename+'.py')}<div class="assignment-answer">${week.id==='01'?`<label for="audit-notes">五条记录的追溯笔记</label><p class="muted">每条写出原值、公开时间、首次可用时间、信号截止和最早成交，说明是否可以使用。</p><textarea id="audit-notes" placeholder="记录 1：证券或文档、原值、公开时间、首次可用时间、信号截止、最早成交、判断" style="min-height:220px">${escape(state.auditNotes||'')}</textarea>`:''}<h3>写下你的解释</h3>${assignment.questions.map((q,i)=>`<label for="answer-${i}">${i+1}. ${escape(q)}</label><textarea id="answer-${i}" data-answer="${i}" placeholder="用自己的话说明">${escape(state.answers[i])}</textarea>`).join('')}<div class="download-row"><button id="export-py" class="button primary">导出作业 .py ↓</button><button id="export-notebook" class="button secondary">导出 Notebook ↓</button></div></div></section><section class="panel submission"><h2>提交作业</h2><ol><li>运行代码，点击“检查作业”并核对结果。</li><li>写好解释和追溯笔记。</li><li>打开“学习记录”，登录账号后提交本周作业。</li><li>在“学习记录”查看教师回复。</li></ol><a class="button primary" href="${url('records')}">提交本周作业 ↗</a></section>`;
 attachEditor({key:'assignment',initial:template,check:assignment.check,assignment:true});$('#check-code').textContent='检查作业';
 document.querySelectorAll('[data-answer]').forEach(input=>input.oninput=()=>{state.answers[+input.dataset.answer]=input.value;state.assignmentReview=null;save();});
 if($('#audit-notes'))$('#audit-notes').oninput=event=>{state.auditNotes=event.target.value;save();};
 const code=()=>$('#code-editor').value+'\n\n# 文字解释\nanswers = '+JSON.stringify(state.answers,null,4)+'\n'+(week.id==='01'?'audit_notes = '+JSON.stringify(state.auditNotes||'')+'\n':'');
 $('#export-py').onclick=()=>download(filename+'.py',code());$('#export-notebook').onclick=()=>download(filename+'.ipynb',JSON.stringify(notebook(code()),null,2),'application/x-ipynb+json');
}
function importAnonymous(){
 if(!anonymousCourse||!sync?.user)return;
 if(!confirm('用登录前的记录替换当前账号记录？当前账号记录可以先导出备份。'))return;
 sync.importLocal(anonymousCourse);toast('记录已导入，正在等待同步');
}
function refreshSyncStatus(snapshot=sync?.snapshot()){
 if(!snapshot)return;
 $('#storage-label').textContent=snapshot.label;
 const loading=portalConfig.backendEnabled&&isSyncLoading(snapshot.phase);$('#import-progress').disabled=loading;$('#progress-file').disabled=loading;
 const bar=$('#account-bar');
 if(bar){
  const user=snapshot.user;
  bar.innerHTML=user?`<span>${escape(user.name||user.email||'学习账号')}</span><span class="account-sync" data-phase="${escape(snapshot.phase)}">${escape(snapshot.label)}</span>${user.role==='teacher'?'<a class="text-link" href="#teacher">学员记录</a>':''}<a class="text-link" href="${url('records')}">学习账号</a>${snapshot.phase==='expired'?`<a class="text-link" href="${authLink()}" target="_top">重新登录</a>`:''}`:portalConfig.backendEnabled?`<span>${escape(snapshot.label)}</span><a class="text-link" href="${authLink()}" target="_top">登录学习账号</a>`:portalConfig.privatePortalUrl?`<span>登录后自动同步学习记录</span><a class="text-link" href="${escape(portalConfig.privatePortalUrl+'#week/01/records')}">进入学习账号 ↗</a>`:'';
 }
 const root=$('#feedback-root');if(root)updateAccountStatus(root,snapshot,{onRemote:()=>{if(confirm('使用云端记录？当前草稿可以先导出备份。'))sync.useRemote();},onLocal:()=>{if(confirm('用当前草稿更新云端记录？'))sync.keepLocal();},onExport:()=>download('quant-study-progress.json',JSON.stringify(course,null,2),'application/json')});
}
function recordsPage(){
 const profile=course.feedback[week.id]||(course.feedback[week.id]={});
 $('#main').innerHTML=heading('学习记录','查看完成情况、提交作业和向教师提问。')+'<div id="feedback-root"></div>';
 mountFeedback($('#feedback-root'),{week,state,profile,onChange:()=>save(),sync,config:portalConfig,anonymousAvailable:!!anonymousCourse&&Object.values(anonymousCourse.weeks||{}).some(w=>w.read?.length||Object.keys(w.drafts||{}).length),onImportAnonymous:importAnonymous,onConflict:()=>refreshSyncStatus()});
}
function updateNavigation(route){
 const weekLabel=`第${chinese[week.number]}周 · ${week.title}`;
 document.title=week.title+' · 量化研究';
 $('.brand').href=url();$('.brand small').textContent=weekLabel;$('.footer span').textContent='量化研究 · 第'+chinese[week.number]+'周';
 document.querySelectorAll('[data-nav]').forEach(link=>{link.hidden=link.dataset.nav==='workbench'&&week.id!=='01';link.classList.toggle('active',link.dataset.nav===route);link.href=url(link.dataset.nav,link.dataset.nav==='lesson'?state.lastLesson:'');});
 $('#week-nav').innerHTML=weeks.map(w=>`<a href="#week/${w.id}/overview" ${w.id===week.id?'aria-current="page"':''}><span>第${chinese[w.number]}周</span>${escape(w.title)}</a>`).join('');
}
async function render(){
 const token=++renderToken;if(busy)engine.cancel();busy=false;
 if(portalConfig.backendEnabled&&(!sync||isSyncLoading(sync.phase))){$('#main').innerHTML='<section class="panel homework-brief"><p role="status">正在读取学习记录，请稍候。</p></section>';return;}
 const parts=(location.hash.slice(1)||'overview').split('/');
 if(parts[0]==='teacher'){updateNavigation('teacher');$('#main').innerHTML='<div class="heading-row"><div><div class="eyebrow">教师页面</div><h1>学员记录</h1><p class="description">进度、作业和问题仅本人及教师可见。</p></div></div><div id="teacher-root"></div>';if(!sync||sync.phase==='checking'||sync.phase==='loading')$('#teacher-root').textContent='正在确认账号。';else await mountTeacher($('#teacher-root'),{sync,weeks,studentId:parts[1]==='student'?decodeURIComponent(parts[2]||''):null,isCurrent:()=>token===renderToken});return;}
 const explicitWeek=parts[0]==='week';
 const selected=explicitWeek?weekById(parts[1]):weekById(location.hash?'01':course.currentWeek);
 const switched=selected.id!==week.id;week=selected;state=course.weeks[week.id];lessons=week.lessons;exercises=week.exercises;course.currentWeek=week.id;
 if(switched)activeExercise=exercises[0].id;
 const route=explicitWeek?(parts[2]||'overview'):parts[0],id=explicitWeek?parts[3]:parts[1];
 updateNavigation(route);save();refreshSyncStatus();
 if(route==='lesson')lessonPage(id);else if(route==='lab')labPage(id||activeExercise);else if(route==='assignment')await assignmentPage(token);else if(route==='workbench'&&week.id==='01')await workbenchPage(token);else if(route==='records')recordsPage();else overview();
 if(token===renderToken)window.scrollTo({top:0,behavior:'instant'});
}
$('#export-progress').onclick=()=>download('quant-study-progress.json',JSON.stringify({...course,exportedAt:new Date().toISOString()},null,2),'application/json');
$('#import-progress').onclick=()=>$('#progress-file').click();
$('#progress-file').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2500000)throw new Error('记录文件过大');const imported=normalizeCourseState(JSON.parse(await file.text()),weeks);if(portalConfig.backendEnabled&&isSyncLoading(sync?.phase))throw new Error('请等学习记录读取完成后再导入');if(!confirm('导入记录会替换当前浏览器中的进度和代码，是否继续？'))return;if(sync?.user){sync.importLocal(imported);}else{course=imported;save();}const destination='#week/'+course.currentWeek+'/overview';if(location.hash===destination)await render();else location.hash=destination;toast('记录已导入');}catch(error){toast('无法导入：'+error.message);}finally{event.target.value='';}};
document.querySelector('.skip').onclick=event=>{event.preventDefault();$('#main').focus();};
window.addEventListener('hashchange',render);
if(!storageOK){$('#notice').hidden=false;$('#notice').textContent='原有记录无法读取，当前使用空白记录。请用导出的文件恢复。';}
anonymousCourse=JSON.parse(JSON.stringify(course));
async function initializeSync(){
 try{const response=await fetch('./portal-config.json',{cache:'no-store'});if(response.ok)portalConfig=await response.json();}catch{}
 let identity='',previousPhase='';
 sync=new PrivateSync({enabled:portalConfig.backendEnabled===true,fetcher:fetch.bind(window),storage:browserStorage,fresh:()=>freshCourseState(weeks),normalize:raw=>normalizeCourseState(raw,weeks),onState:next=>{course=next;state=course.weeks[week.id];if(!isSyncLoading(sync?.phase))render();},onStatus:snapshot=>{refreshSyncStatus(snapshot);const nextIdentity=(snapshot.user?.id||'')+':'+(snapshot.user?.role||'')+':'+(['guest','error'].includes(snapshot.phase)?snapshot.phase:'');const loadingChanged=isSyncLoading(previousPhase)!==isSyncLoading(snapshot.phase),identityChanged=nextIdentity!==identity;previousPhase=snapshot.phase;identity=nextIdentity;if(loadingChanged||(identityChanged&&(location.hash.includes('/records')||location.hash.startsWith('#teacher'))))render();}});
 refreshSyncStatus();await sync.start();
 if(location.hash.includes('/records')||location.hash.startsWith('#teacher'))render();
}
window.addEventListener('online',()=>sync?.flush());
window.addEventListener('focus',()=>{if(sync?.user){if(sync.dirty)sync.flush();else sync.reload();}});
window.addEventListener('pagehide',()=>{if(sync?.user)sync.cache();});
render();initializeSync();
