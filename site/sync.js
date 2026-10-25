const clone=value=>JSON.parse(JSON.stringify(value));
const stamp=value=>JSON.stringify(value);
const LOCAL_PREFIX='quant-study.private.v1.';
export const syncLabels={disabled:'记录保存在此浏览器',checking:'正在确认登录',guest:'登录后自动同步',loading:'正在读取学习记录',ready:'已同步',pending:'等待同步',syncing:'正在同步',offline:'离线，草稿已保存在此浏览器',error:'同步未完成，草稿已保存在此浏览器',conflict:'发现另一份记录，请选择保留方式',expired:'登录已失效，草稿仍保存在此浏览器'};
export class PrivateSync{
 constructor({enabled=false,fetcher=(...args)=>globalThis.fetch(...args),storage=globalThis.localStorage,fresh=()=>({}),normalize=clone,onState=()=>{},onStatus=()=>{},delay=700,schedule=(callback,ms)=>globalThis.setTimeout(callback,ms),cancel=id=>globalThis.clearTimeout(id)}={}){
  Object.assign(this,{enabled,fetcher,storage,fresh,normalize,onState,onStatus,delay,schedule,cancel});this.user=null;this.phase=enabled?'checking':'disabled';this.version=0;this.updatedAt=null;this.state=null;this.dirty=false;this.conflict=null;this.error='';this.generation=0;this.inflight=null;this.timer=null;this.retryDelay=2000;this.storageOK=true;
 }
 snapshot(){return {user:this.user,phase:this.phase,version:this.version,updatedAt:this.updatedAt,dirty:this.dirty,conflict:this.conflict,error:this.error||(!this.storageOK?'浏览器无法保存草稿，请导出记录备份。':''),label:!this.storageOK&&this.dirty?'同步未完成，请导出草稿备份':syncLabels[this.phase]||syncLabels.error};}
 emit(phase=this.phase,error=''){this.phase=phase;this.error=error;this.onStatus(this.snapshot());}
 key(){return LOCAL_PREFIX+encodeURIComponent(this.user.id);}
 cache(){try{if(!this.storage)throw new Error('Storage unavailable');this.storage.setItem(this.key(),JSON.stringify({state:this.state,version:this.version,updatedAt:this.updatedAt,dirty:this.dirty}));this.storageOK=true;}catch{this.storageOK=false;}}
 readCache(){try{const data=JSON.parse(this.storage?.getItem(this.key())||'null');if(data&&Number.isInteger(data.version)&&data.version>=0)return {...data,state:this.normalize(data.state)};}catch{}return null;}
 async request(path,{method='GET',body,anonymous=false}={}){
  const generation=this.generation,account=this.user?.id,headers={Accept:'application/json'};if(body!==undefined)headers['Content-Type']='application/json';if(!anonymous&&account)headers['X-Account-ID']=account;
  const controller=new AbortController(),timeout=globalThis.setTimeout(()=>controller.abort(),15000);timeout.unref?.();let response,data={};
  try{response=await this.fetcher(path,{method,credentials:'same-origin',headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});try{data=await response.json();}catch{throw new Error('服务暂时无法读取，请稍后重试。');}}
  catch(error){if(error.name==='AbortError')throw new Error('连接超时，请稍后重试。');throw error;}finally{globalThis.clearTimeout(timeout);}
  if(generation!==this.generation||(!anonymous&&account!==this.user?.id))throw new Error('账号已变更，请重新打开学习记录。');
  if(!response.ok){const error=new Error(data.error||'请求没有完成，请稍后重试。');error.status=response.status;error.data=data;if(!anonymous&&(response.status===401||String(data.code).toLowerCase()==='account_changed'))this.emit('expired');throw error;}
  return data;
 }
 async authenticate(mode,credentials){
  if(!['login','register'].includes(mode))throw new Error('登录方式不支持');
  const result=await this.request('/api/auth/'+mode,{method:'POST',body:credentials,anonymous:true});
  await this.start();return result;
 }

 async start(){
  if(!this.enabled){this.emit('disabled');return;}
  if(this.timer)this.cancel(this.timer);this.timer=null;this.inflight=null;
  const generation=++this.generation;this.user=null;this.state=null;this.version=0;this.updatedAt=null;this.dirty=false;this.conflict=null;this.emit('checking');
  try{
   const result=await this.request('/api/me',{anonymous:true});if(generation!==this.generation)return;
   if(!result.user){this.user=null;this.emit('guest');return;}
   this.user=result.user;this.emit('loading');const cached=this.readCache();
   this.state=cached?.state||this.fresh();this.version=cached?.version||0;this.updatedAt=cached?.updatedAt||null;this.dirty=!!cached?.dirty;this.onState(clone(this.state));
   const remote=await this.request('/api/state');if(generation!==this.generation)return;
   const serverState=remote.state?this.normalize(remote.state):this.fresh(),serverVersion=remote.version||0;
   if(this.dirty){
    if(this.version!==serverVersion){this.conflict={state:serverState,version:serverVersion,updatedAt:remote.updatedAt};this.emit('conflict');return;}
    this.emit('pending');this.queue();return;
   }
   this.state=serverState;this.version=serverVersion;this.updatedAt=remote.updatedAt||null;this.onState(clone(this.state));this.cache();this.emit('ready');
  }catch(error){if(generation!==this.generation)return;if(this.phase==='expired')return;this.emit(this.user?'offline':'error',error.message);}
 }
 update(state){
  if(!this.user||!this.state)return;const next=this.normalize(clone(state));if(stamp(next)===stamp(this.state))return;this.state=next;this.dirty=true;this.cache();
  if(this.phase==='expired'||this.phase==='conflict')return;this.emit('pending');this.queue();
 }
 queue(delay=this.delay){if(this.timer)this.cancel(this.timer);this.timer=this.schedule(()=>{this.timer=null;this.flush();},delay);this.timer?.unref?.();}
 async flush(){
  if(this.inflight){await this.inflight;return !this.dirty&&this.phase==='ready';}
  if(!this.user||!this.dirty||['expired','conflict'].includes(this.phase))return !this.dirty&&this.phase==='ready';
  if(this.timer)this.cancel(this.timer);this.timer=null;
  const generation=this.generation,sent=clone(this.state),baseVersion=this.version;this.emit('syncing');
  this.inflight=(async()=>{
   try{
    const result=await this.request('/api/state',{method:'PUT',body:{state:sent,baseVersion}});if(generation!==this.generation)return false;
    this.version=result.version;this.updatedAt=result.updatedAt||null;this.dirty=stamp(sent)!==stamp(this.state);this.cache();this.retryDelay=2000;this.emit(this.dirty?'pending':'ready');if(this.dirty)this.queue();return !this.dirty;
   }catch(error){
    if(generation!==this.generation)return false;
    if(error.status===409&&error.data?.state!==undefined&&Number.isInteger(error.data.version)){this.conflict={state:error.data.state?this.normalize(error.data.state):this.fresh(),version:error.data.version,updatedAt:error.data.updatedAt};this.emit('conflict');}
    else if(this.phase!=='expired'){this.emit(error.status?'error':'offline',error.message);this.queue(this.retryDelay);this.retryDelay=Math.min(this.retryDelay*2,30000);}return false;
   }finally{if(generation===this.generation)this.inflight=null;}
  })();return this.inflight;
 }
 async syncNow(){for(let n=0;n<8;n++){if(!await this.flush()){if(this.inflight||this.phase==='pending')continue;return false;}return true;}return false;}
 async reload(){
  if(!this.user||this.dirty)return this.flush();const generation=this.generation;
  try{const result=await this.request('/api/state');if(generation!==this.generation||this.dirty)return false;const next=result.state?this.normalize(result.state):this.fresh(),changed=stamp(next)!==stamp(this.state);this.state=next;this.version=result.version||0;this.updatedAt=result.updatedAt||null;this.cache();if(changed)this.onState(clone(this.state));this.emit('ready');return true;}
  catch(error){if(this.phase!=='expired')this.emit('error',error.message);return false;}
 }
 useRemote(){if(!this.conflict)return;this.state=clone(this.conflict.state);this.version=this.conflict.version;this.updatedAt=this.conflict.updatedAt||null;this.conflict=null;this.dirty=false;this.cache();this.onState(clone(this.state));this.emit('ready');}
 keepLocal(){if(!this.conflict)return;this.version=this.conflict.version;this.conflict=null;this.dirty=true;this.cache();this.emit('pending');return this.flush();}
 importLocal(state){if(!this.user||this.phase==='expired'||this.phase==='loading')return;this.state=this.normalize(clone(state));this.onState(clone(this.state));this.dirty=true;this.cache();if(this.phase!=='conflict'){this.emit('pending');this.queue();}}
 stop(){this.generation++;if(this.timer)this.cancel(this.timer);this.timer=null;this.inflight=null;this.user=null;this.state=null;this.dirty=false;this.version=0;this.updatedAt=null;this.conflict=null;this.emit(this.enabled?'guest':'disabled');}
}
