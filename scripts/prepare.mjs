import {mkdir,copyFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {weeks} from '../site/curriculum.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const downloads=path.join(root,'site/downloads');
await mkdir(downloads,{recursive:true});
for(const week of weeks){
 for(const extension of ['py','ipynb'])await copyFile(path.join(root,`assignments/week${week.id}.${extension}`),path.join(downloads,`week${week.id}.${extension}`));
 await copyFile(path.join(root,`lessons/week${week.id}.md`),path.join(downloads,`week${week.id}.md`));
 const rubric={week:week.id,revision:week.revision||1,title:week.title,expected:week.assignment.expected,check:week.assignment.check};
 await writeFile(path.join(root,`assignments/week${week.id}-rubric.json`),JSON.stringify(rubric,null,2)+'\n');
}
for(const filename of await readdir(path.join(root,'data')))if(/^week0[1-4]-.*\.csv$/.test(filename))await copyFile(path.join(root,'data',filename),path.join(downloads,filename));
await copyFile(path.join(root,'data/week01-lab.json'),path.join(downloads,'week01-lab.json'));
await copyFile(path.join(root,'assignments/README.md'),path.join(downloads,'assignment-guide.md'));
console.log('已准备第一周的讲义、作业和数据。');
