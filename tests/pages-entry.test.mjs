import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {LOGIN_URL,loginURL,buildPagesEntry} from '../scripts/build-pages-entry.mjs';

test('Pages 入口只跳转固定登录站点，保留注册链接和课程位置',()=>{
 const invite='a'.repeat(43);
 const target=new URL(loginURL('https://yolanda101.github.io/quant-research-12weeks/?register=1&invite='+invite+'#week/01/lesson/schema'));
 assert.equal(target.origin+target.pathname,LOGIN_URL);
 assert.equal(target.searchParams.get('register'),'1');
 assert.equal(target.searchParams.get('invite'),invite);
 assert.equal(target.searchParams.get('return_to'),'/course/#week/01/lesson/schema');
});

test('外部重定向、附加参数和无效邀请码不能进入登录地址',()=>{
 const target=new URL(loginURL('https://example.test/?return_to=https://attacker.example&next=//attacker.example&invite=bad&student=private#teacher'));
 assert.equal(target.origin+target.pathname,LOGIN_URL);
 assert.deepEqual([...target.searchParams.keys()],['return_to']);
 assert.equal(target.searchParams.get('return_to'),'/course/#teacher');
});

test('发布目录只保留登录文件，课程模块和旧文件不进入 Pages',async()=>{
 const temporary=await mkdtemp(path.join(os.tmpdir(),'quant-pages-entry-'));
 const output=path.join(temporary,'pages-site');
 try{
  await buildPagesEntry(output);
  await writeFile(path.join(output,'old-course.json'),'private');
  const result=await buildPagesEntry(output);
  assert.deepEqual((await readdir(output)).sort(),['.nojekyll','entry.css','entry.js','index.html']);
  assert.equal(result.files.length,4);
  const html=await readFile(path.join(output,'index.html'),'utf8');
  assert.doesNotMatch(html,/curriculum|app\.js|downloads|本周记录|学习进度/);
  assert.match(html,/no-referrer/);
  let replaced;
  const anchor={};
  vm.runInNewContext(await readFile(path.join(output,'entry.js'),'utf8'),{URL,location:{href:'https://example.test/#week/01/records',replace:target=>{replaced=target;}},document:{getElementById:id=>{assert.equal(id,'login');return anchor;}}});
  assert.equal(anchor.href,replaced);
  assert.equal(new URL(replaced).searchParams.get('return_to'),'/course/#week/01/records');
 }finally{await rm(temporary,{recursive:true,force:true});}
});

test('入口生成器拒绝覆盖课程源码目录',async()=>{
 await assert.rejects(()=>buildPagesEntry(path.resolve('site')),/入口目录有误/);
});
