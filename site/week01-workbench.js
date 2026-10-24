const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=value=>esc(value?.replace('T',' ').replace('+08:00','')||'未记录');
export const poolAt=(rows,day)=>rows.filter(x=>x.listed_at<=day&&(!x.delisted_at||day<x.delisted_at)).map(x=>x.asset).sort();
export function reportsAt(rows,signal){
 const selected=new Map();
 for(const r of [...rows].sort((a,b)=>a.period_end.localeCompare(b.period_end)||a.available_at.localeCompare(b.available_at)||a.version-b.version)){
  if(r.available_at<=signal&&r.published_at<=signal)selected.set(r.asset,r);
 }
 return [...selected.values()].sort((a,b)=>a.asset.localeCompare(b.asset));
}
export function labelsAt(rows,fit){return rows.map(r=>({...r,status:r.signal_at>fit?'尚未形成信号':r.label_available_at>fit?'标签尚未到期':'标签已知'}));}
const table=(headers,rows)=>`<div class="data-scroll" tabindex="0"><table class="data-table"><thead><tr>${headers.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const badge=(text,yes=true)=>`<span class="data-badge ${yes?'visible':'pending'}">${esc(text)}</span>`;
const link=id=>`<a class="text-link" href="#week/01/lesson/${id}">阅读本节讲义 ↗</a>`;
const panel=(title,description,body,id)=>`<section class="panel data-panel"><div class="eyebrow">数据实验 / 第 01 周</div><h2>${title}</h2><p class="data-intro">${description}</p>${body}<div class="data-end">${link(id)}</div></section>`;
export function mountWorkbench(root,data){
 const choices=[['2021-03-31T15:00:00+08:00','3 月 31 日 15:00'],['2021-03-31T17:00:00+08:00','3 月 31 日 17:00'],['2021-04-02T09:00:00+08:00','4 月 2 日 09:00']];
 const model={tab:'reports',day:'2021-03-31',signal:choices[0][0],dividend:true,fit:'2021-12-31',minute:'2021-04-01T09:31:00+08:00'};
 root.innerHTML=`<div class="workbench"><nav class="experiment-tabs" aria-label="数据实验目录">${[['reports','01 财报版本'],['universe','02 历史股票池'],['pricing','03 收益标签'],['splits','04 时间切分'],['manifest','05 资料版本']].map(([id,label])=>`<button data-experiment="${id}" aria-pressed="${id===model.tab}">${label}</button>`).join('')}</nav><div id="experiment-body"></div><div class="experiment-export"><button class="button secondary" id="export-experiment">导出实验记录 ↓</button><p>记录包含你的选择和计算结果，可作为本周作业的追溯材料。</p></div></div>`;
 const body=root.querySelector('#experiment-body');
 function paint(){
  root.querySelectorAll('[data-experiment]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.experiment===model.tab)));
  if(model.tab==='reports'){
   const selected=reportsAt(data.reports,model.signal),byAsset=new Map(selected.map(r=>[r.asset,r]));
   const next=data.calendarRows.find(r=>r.is_observation_day&&r.session_open>model.signal);
   body.innerHTML=panel('信号形成前，能看到哪一版？','修改信号时点，观察财报的可见状态。所有时间按上海时区显示。',`<label class="control-label" for="signal-select">选择信号时点</label><select id="signal-select">${choices.map(([value,label])=>`<option value="${value}" ${model.signal===value?'selected':''}>2021 年 ${label}</option>`).join('')}</select><div class="experiment-answer" aria-live="polite"><span>当时选用</span><h3>${selected.map(r=>`${esc(r.asset)}：${r.value}，版本 ${r.version}`).join('　')}</h3><p>按可用时间筛选，再取每只股票当时最新的报告期和版本。</p></div>${table(['证券 / 报告期','公开时间','首次可用时间','数值','信号时的状态'],data.reports.map(r=>{const visible=r.available_at<=model.signal&&r.published_at<=model.signal;const chosen=byAsset.get(r.asset)===r;return [`${esc(r.asset)}<small>${esc(r.period_end)} · 版本 ${r.version}</small>`,stamp(r.published_at),stamp(r.available_at),r.value,badge(chosen?'选用':visible?'已有更新记录':'尚不可用',chosen)];}))}<p class="data-note">available_at 包含公开和到达数据源的限制。修订版可用后才替换旧版，期末日期不能代替公开时间。</p><div class="trace-line"><span>信号截止<br><b>${stamp(model.signal)}</b></span><span class="trace-arrow" aria-hidden="true">↓</span><span>配套日历中的下一次开盘<br><b>${next?stamp(next.session_open):'日历范围外'}</b></span></div>`,'availability');
   body.querySelector('#signal-select').onchange=e=>{model.signal=e.target.value;paint();};
  }else if(model.tab==='universe'){
   const historical=poolAt(data.universeRows,model.day),latest=poolAt(data.universeRows,'2023-12-31'),lost=historical.filter(a=>!latest.includes(a));
   body.innerHTML=panel('按当天的存续区间选样本','历史股票池使用当时的加入和退出日期。样本假设存续状态在生效前已公开，退出生效当天不再纳入。',`<label class="control-label" for="universe-date">观察日期</label><input id="universe-date" type="date" min="2016-01-01" max="2023-12-31" value="${model.day}"><div class="experiment-answer" aria-live="polite"><span>当日股票池 · ${model.day}</span><h3>${historical.join(' · ')||'没有符合条件的证券'}</h3><p>若用 2023 年末存续名单回填，遗漏：${lost.join('、')||'无'}。</p></div>${table(['证券','加入生效日','退出生效日','观察日状态'],data.universeRows.map(r=>[`${esc(r.asset)}<small>${esc(r.name)}</small>`,esc(r.listed_at),esc(r.delisted_at||'仍存续'),badge(historical.includes(r.asset)?'纳入':model.day<r.listed_at?'尚未加入':'已退出',historical.includes(r.asset))]))}<p class="data-note">筛选条件：listed_at ≤ 观察日期，且退出日期为空或观察日期 &lt; delisted_at。样本使用虚构的存续事件表，实际研究还要单独核对停牌和交易资格。</p>`,'universe');
   body.querySelector('#universe-date').onchange=e=>{if(e.target.validity.valid&&e.target.value){model.day=e.target.value;paint();}};
  }else if(model.tab==='pricing'){
   const c=data.labelCase,dividend=model.dividend?c.cash_dividend:0,result=(c.exit_price+dividend)/c.entry_price-1;
   body.innerHTML=panel('跟踪一笔交易的收益标签','使用原始开盘价成交，按持有期分红核对总收益。',`<ol class="event-timeline">${data.events.map(e=>`<li><time>${stamp(e.at)}</time><h3>${esc(e.title)}</h3><p>${esc(e.detail)}</p></li>`).join('')}</ol><label class="toggle-label"><input id="dividend-toggle" type="checkbox" ${model.dividend?'checked':''}> 计入持有期每股现金分红 2 元</label><div class="experiment-answer" aria-live="polite"><span>${model.dividend?'含现金分红收益':'原始价格收益'}</span><h3>${(result*100).toFixed(2)}%</h3><p class="numeric-formula">${model.dividend?'〔101 + 2〕÷ 100 − 1':'101 ÷ 100 − 1'} = ${(result*100).toFixed(2)}%</p><p>${model.dividend?`标签到期时间为 ${stamp(c.label_available_at)}。`:'未计入分红的结果只描述价格变化。'}</p></div><p class="data-note">分红现金在支付日入账。总收益在退出时计算，示例忽略税费。已包含分红的总收益序列不能再次加分红；调整价格不用于现金成交。</p>`,'pricing');
   body.querySelector('#dividend-toggle').onchange=e=>{model.dividend=e.target.checked;paint();};
  }else if(model.tab==='splits'){
   const fit=model.fit+'T23:59:59+08:00',rows=labelsAt(data.labelRows,fit),included=rows.filter(r=>r.status==='标签已知').map(r=>r.sample);
   body.innerHTML=panel('训练前，标签是否已经到期？','选择拟合截止日，检查每条信号的收益标签是否已知。',`<div class="split-track"><div><span>研究期</span><b>2016—2021</b></div><div><span>滚动验证期</span><b>2022—2023</b></div><div class="sealed"><span>封存测试期</span><b>2024—2025</b></div></div><label class="control-label" for="fit-date">拟合截止日</label><select id="fit-date">${['2021-12-31','2022-02-01','2022-03-01'].map(d=>`<option ${d===model.fit?'selected':''}>${d}</option>`).join('')}</select><div class="experiment-answer" aria-live="polite"><span>标签已知的样本</span><h3>${included.join(' · ')||'无'}</h3><p>训练还需满足指定研究区间。延后拟合日期后，原先跨界的标签可能到期；原有切分规则仍须保留。</p></div>${table(['样本','形成信号','标签到期','拟合时状态'],rows.map(r=>[esc(r.sample),stamp(r.signal_at),stamp(r.label_available_at),badge(r.status,r.status==='标签已知')]))}<div class="sealed-note"><h3>封存测试期</h3><p>起始 2024-01-01，结束 2025-12-31。此处只保留区间记录。完成研究规则和验证后再开启测试。</p></div><p class="data-note">开发面板有 ${data.panelSummary.rows} 行月度观察，覆盖 2016 至 2023 年。月度面板不能替代逐日成交数据。样本 C 的信号在 2021 年末，标签到 2022 年 2 月才可得。</p>`,'splits');
   body.querySelector('#fit-date').onchange=e=>{model.fit=e.target.value;paint();};
  }else{
   const signal=choices[0][0],bars=data.minuteRows.filter(r=>r.available_at<=model.minute);
   body.innerHTML=panel('保存每份资料的时间和版本','检查文本公开时间、编码器发布记录和分钟数据结束时间。',`<h3>公告文本</h3><p>信号截止：2021 年 3 月 31 日 15:00。</p>${table(['文档','公开时间','首次可用时间','状态'],data.textRows.map(r=>[esc(r.document_id),stamp(r.published_at),stamp(r.available_at),badge(r.available_at<=signal?'可用':'尚不可用',r.available_at<=signal)]))}<h3>编码器</h3>${table(['名称 / 版本','训练资料截止','发布时点','核对结果'],data.encoderRows.map(r=>{const valid=r.training_cutoff&&r.training_cutoff<=signal.slice(0,10)&&r.released_at<=signal;return [`${esc(r.encoder)}<small>${esc(r.version)}</small>`,esc(r.training_cutoff||'未记录'),stamp(r.released_at),badge(valid?'时间条件满足':r.training_cutoff?'晚于历史信号':'截止未知',!!valid)];}))}<p class="data-note">时间条件通过后仍须核对训练资料来源。训练截止未知的版本保留为待核对，历史实验使用已核实版本。</p><h3>分钟数据</h3><label class="control-label" for="minute-select">决策时点</label><select id="minute-select">${data.minuteRows.map(r=>`<option value="${r.available_at}" ${r.available_at===model.minute?'selected':''}>${r.available_at.slice(11,19)}</option>`).join('')}</select><div class="experiment-answer" aria-live="polite"><span>已结束且已可用的分钟记录</span><h3>${bars.map(r=>r.bar_end.slice(11,16)).join(' · ')}</h3><p>同一根分钟线的收盘价在结束后才可用于决策，成交需安排在后续可交易时点。</p></div><details class="manifest-details"><summary>查看数据文件和字段</summary>${table(['文件','用途 / 版本','字段'],data.manifest.map(r=>[`<a class="text-link" href="./downloads/${esc(r.file)}" download>${esc(r.file)} ↓</a>`,`${esc(r.role)}<small>${esc(r.version)}</small>`,esc(r.fields)]))}</details>`,'manifest');
   body.querySelector('#minute-select').onchange=e=>{model.minute=e.target.value;paint();};
  }
 }
 root.querySelectorAll('[data-experiment]').forEach(b=>b.onclick=()=>{model.tab=b.dataset.experiment;paint();});
 root.querySelector('#export-experiment').onclick=()=>{
  const report={week:'01',saved_at:new Date().toISOString(),timezone:data.timezone,selection:{...model},historical_pool:poolAt(data.universeRows,model.day),selected_reports:reportsAt(data.reports,model.signal),label_return:(data.labelCase.exit_price+(model.dividend?data.labelCase.cash_dividend:0))/data.labelCase.entry_price-1,label_audit:labelsAt(data.labelRows,model.fit+'T23:59:59+08:00'),sealed_range:[data.split.test_start,data.split.test_end]};
  const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));a.href=u;a.download='week01-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
 };
 paint();
}
