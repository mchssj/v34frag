import fs from 'fs';
const K=fs.readFileSync('E:/Css V34 Web/v34frag/.env','utf8').match(/^SFTP_CSS_API_KEY\s*=\s*["']?([^"'\r\n]+)/m)[1];
const H={Authorization:'Bearer '+K,Accept:'application/json','User-Agent':'Mozilla/5.0'};
const once=s=>new Promise(async(res,rej)=>{
  const j=(await (await fetch(`https://panel-mvzg.com/api/client/servers/${s}/websocket`,{headers:H})).json()).data;
  const w=new WebSocket(j.socket,{headers:{Origin:'https://panel-mvzg.com'}}); let out='';
  w.onopen=()=>w.send(JSON.stringify({event:'auth',args:[j.token]}));
  w.onerror=e=>rej(new Error(e.message||'ws'));
  w.onmessage=m=>{const d=JSON.parse(m.data);
    if(d.event==='auth success') w.send(JSON.stringify({event:'send command',args:[process.argv[2]]}));
    if(d.event==='console output') out+=d.args.join('')+'\n';};
  setTimeout(()=>{w.close();res(out)},6000);});
for(const s of ['157703b5','cd1be322','16c850ff']){ let ok;
  for(let i=0;i<4&&!ok;i++) try{const o=await once(s);ok=1;console.log('==',s);console.log(o.split('\n').slice(-70).join('\n'))}catch(e){console.log(s,e.message)}
}
process.exit()
