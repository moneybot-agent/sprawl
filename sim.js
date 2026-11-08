const G=require('./game');for(const n of [2,3,4]){const w=Array(n+1).fill(0);let moves=0,crown=0;
for(let i=0;i<1000;i++){const g=G.createGame(Array.from({length:n},(_,k)=>({name:'B'+k,bot:true})),i+1);let k=0;while(g.status==='playing'&&k++<5000){G.applyMove(g,g.turn,G.botMove(g,g.turn));moves++}
 if(g.board[3*7+3].owner!==null)crown++; w[g.winner===null?n:g.winner]++}console.log(n+'p wins by seat:',w.slice(0,n).join(' '),'draws',w[n],'crown taken',crown/10+'%','avg actions',moves/1000)}
