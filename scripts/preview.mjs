import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../out');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const base=process.env.PREVIEW_BASE_PATH ?? (html.match(/src="([^"\s]*)\/_next\//)?.[1] || '');
const port=Number(process.env.PORT || 3000);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.txt':'text/plain','.json':'application/json','.woff2':'font/woff2'};
http.createServer((req,res)=>{let file;try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(base && pathname==='/'){res.writeHead(302,{Location:base+'/'});res.end();return;}if(base&&(pathname===base||pathname.startsWith(base+'/')))pathname=pathname.slice(base.length)||'/';file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root)throw 0;if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file)){res.statusCode=404;file=path.join(root,'404.html');}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');const stream=fs.createReadStream(file);stream.on('error',()=>{res.statusCode=500;res.end();});stream.pipe(res);}catch{res.writeHead(400);res.end();}}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port+base+'/'));
