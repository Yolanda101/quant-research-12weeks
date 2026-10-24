import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {poolAt,reportsAt,labelsAt} from '../site/week01-workbench.js';
const data=JSON.parse(await readFile(new URL('../data/week01-lab.json',import.meta.url)));
test('股票池按生效区间保留退市记录并排除尚未上市证券',()=>{
 assert.deepEqual(poolAt(data.universeRows,'2021-03-31'),['Q001','Q002','Q003']);
 assert.deepEqual(poolAt(data.universeRows,'2022-06-30'),['Q002','Q003','Q004']);
});
test('晚到财报和后续修订仅在可用后被选用',()=>{
 const values=t=>reportsAt(data.reports,t).map(r=>[r.asset,r.value]);
 assert.deepEqual(values('2021-03-31T15:00:00+08:00'),[['Q001',120],['Q002',70]]);
 assert.deepEqual(values('2021-03-31T17:00:00+08:00'),[['Q001',120],['Q002',80]]);
 assert.deepEqual(values('2021-04-02T09:00:00+08:00'),[['Q001',135],['Q002',80]]);
 assert.deepEqual(values('2019-01-01T09:00:00+08:00'),[]);
});
test('标签跨界时未知，到期后已知状态不代替训练范围判断',()=>{
 const before=labelsAt(data.labelRows,'2021-12-31T23:59:59+08:00');
 assert.deepEqual(before.map(r=>r.status),['标签已知','标签已知','标签尚未到期','尚未形成信号']);
 assert.equal(labelsAt(data.labelRows,'2022-03-01T23:59:59+08:00')[3].status,'标签已知');
});
