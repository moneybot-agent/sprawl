#!/usr/bin/env node
// Sample Sprawl agent. Usage: node bots/sample_bot.js <server-url> [matchCode] [name]
// With no code it creates a 2-player match and prints the code for a human to join.
const [,, BASE='http://localhost:8080', CODE, NAME='SampleBot'] = process.argv;
const call = async (p, b) => { const r = await fetch(BASE + '/api/matches' + p, b ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(b)} : {}); const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const code = CODE || (await call('', {maxPlayers: 2})).code;
  if (!CODE) console.log(`Created match ${code} — open ${BASE}/#${code} to join.`);
  const {seat, token} = await call(`/${code}/join`, {name: NAME});
  console.log(`Seated as ${seat}`);
  for (;;) {
    const s = await call(`/${code}`);
    if (s.status === 'finished') { console.log(s.log.at(-1).text); break; }
    if (s.status !== 'playing' || s.turn !== seat) { await sleep(1000); continue; }
    // Strategy: best value-per-energy claim, else raid the leader, else end turn.
    const opts = s.legalMoves.filter(m => m.action !== 'fortify' && m.action !== 'end');
    const val = m => s.board[m.y * s.size + m.x].value;
    opts.sort((a, b) => val(b) / b.cost - val(a) / a.cost || val(b) - val(a));
    const m = opts[0] || {action: 'end'};
    console.log(`R${s.round}: ${m.action}${m.x !== undefined ? ` (${m.x},${m.y})` : ''}`);
    await call(`/${code}/move`, {token, ...m});
  }
})().catch(e => { console.error(e.message); process.exit(1); });
