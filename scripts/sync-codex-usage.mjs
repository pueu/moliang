// Read only local token_count events. No prompts, responses, credentials, or session IDs are exported.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import os from 'node:os';
const localCodexRoot=process.env.CODEX_HOME || path.join(os.homedir(),'.codex');
const target=process.env.CODEX_USAGE_OUTPUT ? path.resolve(process.env.CODEX_USAGE_OUTPUT) : path.resolve(import.meta.dirname,'../data/codex-usage.json');
const stats={files:0,usageEvents:0,duplicates:0,resets:0,unreadableFiles:0,invalidEvents:0};
const events=[];
async function filesIn(directory){const found=[];let entries;try{entries=await fs.promises.readdir(directory,{withFileTypes:true});}catch{return found;}for(const entry of entries){const file=path.join(directory,entry.name);if(entry.isDirectory())found.push(...await filesIn(file));else if(entry.isFile()&&entry.name.endsWith('.jsonl'))found.push(file);}return found;}
for(const directory of ['sessions','archived_sessions']){
 for(const file of await filesIn(path.join(localCodexRoot,directory))){
  stats.files++;
  let previous={input_tokens:0,cached_input_tokens:0,output_tokens:0,total_tokens:0};
  let sessionId=file;
  try{
   const reader=readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity});
   for await(const line of reader){
    if(!line.includes('"token_count"')&&!line.includes('"session_meta"'))continue;
    let record;try{record=JSON.parse(line);}catch{stats.invalidEvents++;continue;}
    if(record.type==='session_meta'){sessionId=record.payload?.id||sessionId;continue;}
    if(record.type!=='event_msg'||record.payload?.type!=='token_count'||!record.payload.info?.total_token_usage)continue;
    const total=record.payload.info.total_token_usage;
    if(!Number.isFinite(total.total_tokens)||!record.timestamp)continue;
    const timestamp=new Date(record.timestamp);if(Number.isNaN(timestamp.getTime()))continue;
    stats.usageEvents++;
    const reset=total.total_tokens<previous.total_tokens;
    if(reset)stats.resets++;
    const delta={};for(const key of ['input_tokens','cached_input_tokens','output_tokens','total_tokens'])delta[key]=Math.max(0,(Number(total[key])||0)-(reset?0:previous[key]||0));
    previous=total;
    if(delta.total_tokens===0)continue;
    events.push({timestamp:timestamp.toISOString(),sessionId,total,delta});
   }
  }catch{stats.unreadableFiles++;}
 }
}
events.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
const seen=new Set();const sessionTotals=new Map();const daily=new Map();
for(const event of events){
 const signature=event.sessionId+'|'+event.timestamp+'|'+['total_tokens','input_tokens','cached_input_tokens','output_tokens'].map(k=>event.total[k]||0).join('|');
 const identity=event.sessionId;
 const prior=sessionTotals.get(identity);
 // A continued rollout may begin with an inherited cumulative total. Limit first deltas to the difference from its prior file.
 let delta=event.delta;
 if(prior&&event.total.total_tokens>=prior.total_tokens){delta={};for(const k of ['input_tokens','cached_input_tokens','output_tokens','total_tokens'])delta[k]=Math.min(event.delta[k],Math.max(0,(event.total[k]||0)-(prior[k]||0)));}
 sessionTotals.set(identity,event.total);
 if(seen.has(signature)){stats.duplicates++;continue;}seen.add(signature);
 if(delta.total_tokens<=0)continue;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(event.timestamp));
 const day=daily.get(date)||{date,tokens:0,inputTokens:0,cachedInputTokens:0,outputTokens:0};
 day.tokens+=delta.total_tokens;day.inputTokens+=delta.input_tokens;day.cachedInputTokens+=delta.cached_input_tokens;day.outputTokens+=delta.output_tokens;daily.set(date,day);
}
const days=[...daily.values()].sort((a,b)=>a.date.localeCompare(b.date));
if(!days.length)throw new Error('No readable Codex usage records found; existing snapshot was preserved.');
const snapshot={updatedAt:new Date().toISOString(),source:'本机 Codex 会话记录 · 按北京时间汇总',days};
await fs.promises.mkdir(path.dirname(target),{recursive:true});
const temporary=target+'.tmp';await fs.promises.writeFile(temporary,JSON.stringify(snapshot,null,2)+'\n');await fs.promises.rename(temporary,target);
console.log(JSON.stringify({...stats,recordedDays:days.length,firstDate:days[0].date,lastDate:days.at(-1).date,totalTokens:days.reduce((sum,d)=>sum+d.tokens,0),destination:target}));
