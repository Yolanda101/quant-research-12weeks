import {mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LOGIN_URL='https://quant-learning-records.zanewan1107.chatgpt.site/login';

export function loginURL(source){
 const current=new URL(source);
 const target=new URL('https://quant-learning-records.zanewan1107.chatgpt.site/login');
 const invite=current.searchParams.get('invite');
 if(invite&&/^[A-Za-z0-9_-]{43}$/.test(invite))target.searchParams.set('invite',invite);
 if(current.searchParams.get('register')==='1')target.searchParams.set('register','1');
 target.searchParams.set('return_to','/course/'+current.hash.slice(0,1000));
 return target.href;
}

export async function buildPagesEntry(directory=path.resolve('pages-site')){
 const output=path.resolve(directory);
 if(path.basename(output)!=='pages-site'&&!output.endsWith(path.join('github-login-entry','site')))throw new Error('入口目录有误。');
 await rm(output,{recursive:true,force:true});
 await mkdir(output,{recursive:true});
 const files={
  '.nojekyll':'',
  'index.html':`<!doctype html>
<html lang="zh-CN">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <meta name="referrer" content="no-referrer">
 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'">
 <title>量化研究</title>
 <link rel="stylesheet" href="./entry.css">
 <script type="module" src="./entry.js"></script>
</head>
<body><main><span class="symbol" aria-hidden="true">Σ</span><h1>量化研究</h1><a id="login" href="${LOGIN_URL}" rel="noreferrer">登录</a></main></body>
</html>
`,
  'entry.css':`*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#fff;color:#193b56;font-family:system-ui,-apple-system,"PingFang SC",sans-serif}main{text-align:center;border:1px solid #d8eaf5;border-top:3px solid #74c8e6;padding:48px 72px;max-width:calc(100vw - 40px)}.symbol{font-size:40px;color:#2689b0}h1{font-size:26px;letter-spacing:3px;margin:18px 0 32px}a{display:block;padding:13px 40px;background:#197fa5;color:#fff;text-decoration:none;border-radius:4px;font-weight:600}a:focus-visible{outline:3px solid #8ed9f1;outline-offset:4px}\n`,
  'entry.js':`${loginURL.toString()}\nconst target=loginURL(location.href);\ndocument.getElementById('login').href=target;\nlocation.replace(target);\n`
 };
 for(const [name,content] of Object.entries(files))await writeFile(path.join(output,name),content);
 return {output,files:Object.keys(files)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const at=process.argv.indexOf('--output');
 const result=await buildPagesEntry(at<0?undefined:process.argv[at+1]);
 console.log('登录入口：'+result.output);
}
