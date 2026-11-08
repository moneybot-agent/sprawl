// Pure game logic for "Sprawl" — shared by server and built-in bots.
const SIZE = 7, ROUNDS = 10, INCOME = 3, BANK_MAX = 9, RAID_EXTRA = 2, FORTIFY_COST = 2;
const COLORS = ['#ff5c7a', '#4fc3f7', '#ffd54f', '#81c784'];
const STARTS = {2:[[0,0],[SIZE-1,SIZE-1]],3:[[0,0],[SIZE-1,0],[3,SIZE-1]],4:[[0,0],[SIZE-1,0],[SIZE-1,SIZE-1],[0,SIZE-1]]};

function rng(seed){ let s = seed>>>0 || 1; return () => (s = (s*1664525+1013904223)>>>0) / 2**32; }

function newBoard(seed){
  const r = rng(seed), cells = [];
  // 4-fold symmetric values so no seat is advantaged
  for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) cells.push({x,y,value:0,owner:null,fort:false});
  const at=(x,y)=>cells[y*SIZE+x];
  for (let y=0;y<=3;y++) for (let x=0;x<=3;x++){
    const d = Math.abs(x-3)+Math.abs(y-3);
    let v = d<=1 ? 3 : (r()<0.3 ? 3 : r()<0.55 ? 2 : 1);
    if (x+y<=1) v = 1;
    for (const [a,b] of [[x,y],[SIZE-1-x,y],[x,SIZE-1-y],[SIZE-1-x,SIZE-1-y]]) at(a,b).value = v;
  }
  at(3,3).value = 5; // the crown
  return cells;
}

function createGame(seats, seed=Date.now()){
  const board = newBoard(seed);
  const players = seats.map((p,i)=>({seat:i,name:p.name,bot:!!p.bot,color:COLORS[i],energy:0}));
  players.forEach((p,i)=>{ const [x,y]=STARTS[players.length][i]; board[y*SIZE+x].owner=i; });
  const g = {size:SIZE,rounds:ROUNDS,round:1,turn:0,board,players,log:[],status:'playing',winner:null,actedThisTurn:[]};
  players[0].energy = INCOME;
  g.log.push({round:1,seat:null,text:`Match started with ${players.length} players.`});
  return g;
}

const cell=(g,x,y)=> (x>=0&&y>=0&&x<g.size&&y<g.size) ? g.board[y*g.size+x] : null;
const neighbors=(g,c)=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>cell(g,c.x+dx,c.y+dy)).filter(Boolean);
const touches=(g,c,seat)=>neighbors(g,c).some(n=>n.owner===seat);

function score(g,seat){ return g.board.filter(c=>c.owner===seat).reduce((s,c)=>s+c.value,0); }

function legalMoves(g, seat){
  if (g.status!=='playing' || g.turn!==seat) return [];
  const e = g.players[seat].energy, moves=[{action:'end'}];
  for (const c of g.board){
    if (c.owner===null && touches(g,c,seat) && c.value<=e) moves.push({action:'claim',x:c.x,y:c.y,cost:c.value});
    else if (c.owner!==null && c.owner!==seat && !c.fort && touches(g,c,seat) && c.value+RAID_EXTRA<=e)
      moves.push({action:'raid',x:c.x,y:c.y,cost:c.value+RAID_EXTRA});
    else if (c.owner===seat && !c.fort && e>=FORTIFY_COST) moves.push({action:'fortify',x:c.x,y:c.y,cost:FORTIFY_COST});
  }
  return moves;
}

function applyMove(g, seat, m){
  if (g.status!=='playing') throw new Error('match is over');
  if (g.turn!==seat) throw new Error('not your turn');
  const p = g.players[seat], log = t => g.log.push({round:g.round,seat,text:`${p.name} ${t}`});
  if (m.action==='end'){ log(`ends turn (banking ${p.energy}).`); return endTurn(g); }
  const c = cell(g, m.x|0, m.y|0);
  if (!c) throw new Error('no such cell');
  const legal = legalMoves(g,seat).find(l=>l.action===m.action && l.x===c.x && l.y===c.y);
  if (!legal) throw new Error(`illegal ${m.action} at ${m.x},${m.y}`);
  p.energy -= legal.cost;
  if (m.action==='claim'){ c.owner=seat; log(`claims (${c.x},${c.y}) worth ${c.value}.`); }
  else if (m.action==='raid'){ const v=g.players[c.owner].name; c.owner=seat; log(`raids ${v}'s (${c.x},${c.y}) worth ${c.value}!`); }
  else if (m.action==='fortify'){ c.fort=true; log(`fortifies (${c.x},${c.y}).`); }
  if (legalMoves(g,seat).length===1 && p.energy===0) return endTurn(g);
}

function endTurn(g){
  const n = g.players.length;
  // first player rotates each round so no seat always moves first or last
  g.turnsThisRound = (g.turnsThisRound||0)+1;
  if (g.turnsThisRound>=n){
    g.turnsThisRound=0; g.round++;
    if (g.round>g.rounds || g.board.every(c=>c.owner!==null)) return finish(g);
    g.turn = (g.round-1)%n;
  } else g.turn = (g.turn+1)%n;
  const p = g.players[g.turn];
  // forts last one full round: they expire at the start of the owner's turn
  g.board.forEach(c=>{ if(c.owner===g.turn) c.fort=false; });
  const crown = g.board[3*g.size+3].owner===g.turn ? 1 : 0; // holding the crown pays +1 income
  p.energy = Math.min(BANK_MAX, p.energy+INCOME+crown);
}

function finish(g){
  g.status='finished';
  const scores = g.players.map((p,i)=>({seat:i,score:score(g,i),cells:g.board.filter(c=>c.owner===i).length}));
  const crownOwner=g.board[3*g.size+3].owner;
  scores.forEach(s=>{s.energy=g.players[s.seat].energy; s.crown=s.seat===crownOwner?1:0;});
  scores.sort((a,b)=>b.score-a.score || b.crown-a.crown || b.cells-a.cells || b.energy-a.energy);
  const s0=scores[0],s1=scores[1]; g.winner = (s1 && s0.score===s1.score && s0.crown===s1.crown && s0.cells===s1.cells && s0.energy===s1.energy) ? null : s0.seat;
  g.log.push({round:g.rounds,seat:null,text: g.winner===null ? 'Match ends in a draw.' : `${g.players[g.winner].name} wins with ${scores[0].score} points!`});
}

// Basic greedy bot with a dash of randomness: values crown/high cells, raids leaders, fortifies when rich.
function botMove(g, seat, rand=Math.random){
  const moves = legalMoves(g,seat); const e=g.players[seat].energy;
  const lead = g.players.map((_,i)=>score(g,i));
  const crownC=cell(g,3,3), crownNear=crownC.owner!==seat && touches(g,crownC,seat) && !crownC.fort;
  let best={action:'end'}, bestS = e>=6 ? -1 : (crownNear && e<(crownC.owner===null?5:7) ? 1.6 : 0.4); // banking is sometimes right
  const crownCost = crownC.owner===null?5:7;
  if (crownNear && e<crownCost && rand()<0.85) return {action:'end'}; // save up for the crown
  for (const m of moves){
    if (m.action==='end') continue;
    const c = cell(g,m.x,m.y); let s;
    if (m.action==='claim') s = (c.value===5?1.5:0) + c.value/m.cost + c.value*0.3 + neighbors(g,c).filter(n=>n.owner===null).length*0.1 - (Math.abs(c.x-3)+Math.abs(c.y-3))*0.12;
    else if (m.action==='raid') s = (c.value===5?1.2:0) + (c.value*2)/m.cost + (lead[c.owner]>=Math.max(...lead)?0.5:0);
    else { const threatened = neighbors(g,c).some(n=>n.owner!==null&&n.owner!==seat); s = threatened ? c.value*0.35 : -1; }
    s += rand()*0.8;
    if (s>bestS){ bestS=s; best=m; }
  }
  return best;
}

module.exports = {createGame, applyMove, legalMoves, botMove, score, SIZE, ROUNDS};
