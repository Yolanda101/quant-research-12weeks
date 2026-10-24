export const KEY='quant-study.week01.v1';
export const COURSE_KEY='quant-study.course.v3';
export const LEGACY_COURSE_KEY='quant-study.course.v2';
const legacyLessons=['python','returns','series','statistics','costs'];
const legacyExercises=['rate','compound','series','stats','fees'];
export const freshState=(firstLesson='python',revision=1)=>({version:1,revision,read:[],quiz:{},passed:[],drafts:{},answers:['','',''],auditNotes:'',assignmentReview:null,lastLesson:firstLesson});
export function normalizeState(raw, definition) {
 if(!raw||raw.version!==1)throw new Error('记录格式不支持');
 const lessonIds=definition?definition.lessons.map(x=>x.id):legacyLessons;
 const exerciseIds=definition?definition.exercises.map(x=>x.id):legacyExercises;
 const s=freshState(lessonIds[0],definition?.revision||1);
 if(definition&&(raw.revision||1)!==(definition.revision||1))return s;
 s.read=Array.isArray(raw.read)?[...new Set(raw.read.filter(x=>lessonIds.includes(x)))]:[];
 s.passed=Array.isArray(raw.passed)?[...new Set(raw.passed.filter(x=>exerciseIds.includes(x)))]:[];
 const draftIds=[...exerciseIds,'assignment',...lessonIds.map(x=>'example-'+x)];
 if(raw.drafts&&typeof raw.drafts==='object')for(const k of draftIds)if(typeof raw.drafts[k]==='string')s.drafts[k]=raw.drafts[k].slice(0,30000);
 if(raw.quiz&&typeof raw.quiz==='object')for(const k of lessonIds){const limit=definition?.lessons.find(x=>x.id===k)?.quiz.length??2;if(Number.isInteger(raw.quiz[k])&&raw.quiz[k]>=0&&raw.quiz[k]<=limit)s.quiz[k]=raw.quiz[k];}
 if(raw.assignmentReview&&typeof raw.assignmentReview.passed==='boolean'&&typeof raw.assignmentReview.checkedAt==='string')s.assignmentReview={passed:raw.assignmentReview.passed,checkedAt:raw.assignmentReview.checkedAt.slice(0,40)};
 s.auditNotes=typeof raw.auditNotes==='string'?raw.auditNotes.slice(0,12000):'';
 s.answers=[0,1,2].map(i=>typeof raw.answers?.[i]==='string'?raw.answers[i].slice(0,5000):'');
 if(lessonIds.includes(raw.lastLesson))s.lastLesson=raw.lastLesson;
 return s;
}
export const compounded=(a,b)=>(1+a/100)*(1+b/100)-1;
export const overallProgress=(s,lessonCount=5,exerciseCount=5)=>Math.round((s.read.length+s.passed.length)/(lessonCount+exerciseCount)*100);
export function freshCourseState(definitions){return {version:3,currentWeek:'01',weeks:Object.fromEntries(definitions.map(w=>[w.id,freshState(w.lessons[0].id,w.revision||1)])),archives:{},feedback:{}};}
export function normalizeCourseState(raw,definitions){
 const course=freshCourseState(definitions);
 if(!raw||![1,2,3].includes(raw.version))throw new Error('记录格式不支持');
 if(raw.feedback&&typeof raw.feedback==='object')for(const w of definitions){const item=raw.feedback[w.id];if(!item||typeof item!=='object')continue;course.feedback[w.id]={};for(const [key,limit] of Object.entries({studentId:60,question:12000,assignmentUrl:2000,submissionUrl:2000,verifiedUrl:2000,verifiedAt:40,submissionId:100}))if(typeof item[key]==='string')course.feedback[w.id][key]=item[key].slice(0,limit);}
 const first=definitions.find(w=>w.id==='01');
 const keepLegacy=old=>{if(old&&(first?.revision||1)>1&&(old.revision||1)===1)course.archives['week01.v1']=normalizeState(old);};
 if(raw.version===1){keepLegacy(raw);course.weeks['01']=normalizeState(raw,first);return course;}
 if(!raw.weeks||typeof raw.weeks!=='object')throw new Error('记录格式不支持');
 if(raw.archives?.['week01.v1'])course.archives['week01.v1']=normalizeState(raw.archives['week01.v1']);
 keepLegacy(raw.weeks['01']);
 for(const w of definitions)if(raw.weeks[w.id])course.weeks[w.id]=normalizeState(raw.weeks[w.id],w);
 if(definitions.some(w=>w.id===raw.currentWeek))course.currentWeek=raw.currentWeek;
 return course;
}
