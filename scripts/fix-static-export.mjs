import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../out');
async function files(directory){const list=[];for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())list.push(...await files(file));else list.push(file);}return list;}
let aliases=0;
for(const file of await files(root)){
 if(!file.endsWith('.txt'))continue;
 const parts=path.relative(root,file).split(path.sep);
 const index=parts.findIndex(part=>part.startsWith('__next.'));
 if(index<0||index===parts.length-1)continue;
 const alias=path.join(root,...parts.slice(0,index),parts.slice(index).join('.'));
 await fs.copyFile(file,alias);aliases++;
}
await fs.writeFile(path.join(root,'.nojekyll'),'');
console.log(JSON.stringify({staticSegmentAliases:aliases,nojekyll:true}));
