// Sprawl server: zero dependencies. Serves the browser client and the agent JSON API.
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
const G=require('./game');
const PORT=process.env.PORT||8080, matches=new Map();
const code=()=>{ let c; do c=crypto.randomBytes(3).toString('hex').toUpperCase(); while(matches.has(c)); return c; };
const tok=()=>crypto.randomBytes(12).toString('hex');

function view(m){
  const base={code:m.code,status:m.game?m.game.status:'lobby',maxPlayers:m.maxPlayers,
    seats:m.seats.map((s,i)=>({seat:i,name:s.name,bot:!!s.bot})),createdAt:m.createdAt};
  if(!m.game) return base;
  const g=m.game;
  return {...base,size:g.size,round:g.round,rounds:g.rounds,turn:g.turn,winner:g.winner,
    players:g.players.map((p,i)=>({...p,score:G.score(g,i)})),
    board:g.board.map(c=>({x:c.x,y:c.y,value:c.value,owner:c.owner,fort:c.fort})),
    legalMoves:G.legalMoves(g,g.turn), log:g.log};
}

function runBots(m){
  const g=m.game; let guard=0;
  while(g&&g.status==='playing'&&m.seats[g.turn].bot&&guard++<200) G.applyMove(g,g.turn,G.botMove(g,g.turn));
  m.updated=Date.now();
}
function start(m){
  if(m.game) throw new Error('already started');
  if(m.seats.length<2) throw new Error('need at least 2 players (add a bot)');
  m.game=G.createGame(m.seats); runBots(m);
}

const json=(res,st,obj)=>{res.writeHead(st,{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-headers':'content-type'});res.end(JSON.stringify(obj,null,1));};
const body=req=>new Promise(r=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e4)req.destroy();});req.on('end',()=>{try{r(d?JSON.parse(d):{})}catch{r({})}});});

async function api(req,res,parts){
  const b = req.method==='POST' ? await body(req) : {};
  if(parts.length===1 && req.method==='POST'){ // create
    const maxPlayers=Math.min(4,Math.max(2,b.maxPlayers|0||2)), c=code();
    const m={code:c,maxPlayers,seats:[],game:null,createdAt:Date.now(),updated:Date.now()};
    matches.set(c,m); return json(res,201,{code:c,maxPlayers});
  }
  if(parts.length===1) return json(res,200,{matches:[...matches.values()].filter(m=>!m.game).slice(-20).map(view)});
  const m=matches.get((parts[1]||'').toUpperCase()); if(!m) return json(res,404,{error:'no such match'});
  const act=parts[2];
  try{
    if(!act && req.method==='GET') return json(res,200,view(m));
    if(act==='join'){ if(m.game) throw new Error('match already started'); if(m.seats.length>=m.maxPlayers) throw new Error('match full');
      const t=tok(), name=String(b.name||`Player ${m.seats.length+1}`).slice(0,20);
      m.seats.push({name,token:t}); const seat=m.seats.length-1;
      if(m.seats.length===m.maxPlayers) start(m);
      return json(res,200,{seat,token:t,code:m.code}); }
    if(act==='bots'){ if(m.game) throw new Error('match already started');
      let i=1; while(m.seats.length<m.maxPlayers) m.seats.push({name:`Bot ${i++}`,bot:true}); start(m); return json(res,200,view(m)); }
    if(act==='start'){ start(m); return json(res,200,view(m)); }
    if(act==='move'){ if(!m.game) throw new Error('match not started');
      const seat=m.seats.findIndex(s=>s.token&&s.token===b.token); if(seat<0) return json(res,403,{error:'bad token'});
      G.applyMove(m.game,seat,{action:b.action,x:b.x,y:b.y}); runBots(m); return json(res,200,view(m)); }
  }catch(e){ return json(res,400,{error:e.message}); }
  json(res,404,{error:'unknown endpoint'});
}

const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.md':'text/markdown; charset=utf-8'};
http.createServer((req,res)=>{
  if(req.method==='OPTIONS') return json(res,204,{});
  const u=new URL(req.url,'http://x'), parts=u.pathname.split('/').filter(Boolean);
  if(parts[0]==='api') return api(req,res,parts.slice(1)).catch(e=>json(res,500,{error:e.message}));
  let f = u.pathname==='/'?'/index.html':u.pathname;
  const p = f==='/README.md' ? path.join(__dirname,'README.md') : path.join(__dirname,'public',path.normalize(f));
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);return res.end('not found');} res.writeHead(200,{'content-type':types[path.extname(p)]||'text/plain'}); res.end(d); });
}).listen(PORT,()=>console.log(`Sprawl on http://localhost:${PORT}`));

// sweep matches idle for 2h
setInterval(()=>{const cut=Date.now()-2*3600e3; for(const [c,m] of matches) if(m.updated<cut) matches.delete(c);},600e3).unref();
