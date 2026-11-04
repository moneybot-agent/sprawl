const G=require('./game');for(const n of [2,3,4]){const w=Array(n).fill(0),pts=[];let moves=0;
for(let i=0;i<1000;i++){const g=G.createGame(Array.from({length:n},(_,k)=>({name:'B'+k,bot:true})),i+1);let k=0;while(g.status==='playing'&&k++<5000){G.applyMove(g,g.turn,G.botMove(g,g.turn));moves++}
 w[g.winner===null?n:g.winner]=(w[g.winner===null?n:g.winner]||0)+1}console.log(n,'p wins by seat:',w.join(' '),'avg actions',moves/1000)}
