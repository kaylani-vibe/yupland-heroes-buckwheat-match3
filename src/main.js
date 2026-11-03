import './style.css';
import { COLS, ROWS, MOVES, TARGET_CROWNS, CROWN, STONE, HOLE, EXIT, createGame, playSwap, payout } from './engine.mjs';

const names=['гречневое зерно','колос','лист','ягоды','цветок','корона'];
const app=document.querySelector('#app');
let game=null;
let selected=null;
let pointerStart=null;
let ignoreClick=false;

function icon(kind,extra='') { return `<span class="icon icon-${kind} ${extra}" aria-hidden="true"></span>`; }
function cellMarkup(value,row,col) {
  if (value===HOLE) return `<span class="cell hole" aria-hidden="true"></span>`;
  if (value===STONE) return `<span class="cell stone" aria-label="Неподвижный камень"><span class="rock"></span></span>`;
  const chosen=selected?.row===row && selected?.col===col;
  const name=names[value] || 'пусто';
  return `<button class="cell gem ${chosen?'selected':''} ${value===CROWN?'crown':''} ${row===EXIT.row&&col===EXIT.col?'exit':''}" data-row="${row}" data-col="${col}" aria-label="${name}, ряд ${row+1}, столбец ${col+1}" aria-pressed="${chosen}">${icon(value)}${row===EXIT.row&&col===EXIT.col?'<span class="exit-marker" aria-hidden="true">↓</span>':''}</button>`;
}
function render() {
  const started=!!game;
  const finished=game?.finished;
  const result=finished?payout(game):null;
  app.innerHTML=`<main class="shell">
    <header class="masthead"><span class="brand">Yupland Heroes</span><h1>Корона гречневого королевства</h1><p>Опусти три короны к выходу за ${MOVES} ходов</p></header>
    <section class="game-panel" aria-label="Игровая партия">
      <div class="stats">
        <div class="stat"><span class="stat-label">Короны</span><strong>${started?game.crowns:0}<span class="muted"> / ${TARGET_CROWNS}</span></strong></div>
        <div class="stat"><span class="stat-label">Ходы</span><strong>${started?game.moves:MOVES}</strong></div>
        <div class="stat"><span class="stat-label">Греча</span><strong>${started?game.grecha:0}</strong></div>
      </div>
      <div class="board-frame"><div class="board" role="group" aria-label="Поле: меняй соседние фишки местами">${(game?.board ?? createGame().board).map((line,row)=>line.map((value,col)=>cellMarkup(value,row,col)).join('')).join('')}</div><div class="exit-label">↓ Выход короны</div></div>
      <div class="rule"><span>Вход <b>100 золота</b></span><span>За корону <b>50 золота</b></span></div>
      <p class="hint" role="status">${!started?'Совмещай по три одинаковых фишки. Корона падает вместе с ними.':finished?'Партия завершена.':game.lastGain?`+${game.lastGain} гречи${game.chain>1?` · комбо ×${game.chain}`:''}`:'Коснись двух соседних фишек или проведи по ним.'}</p>
    </section>
    <p class="footnote">${started?'Три короны: 150 золота · две: 100 · одна: 50':'Победа зависит от доставленных корон. Греча копится за комбинации.'}</p>
    ${!started?`<div class="overlay"><div class="dialog"><div class="dialog-crown">${icon(5)}</div><h2>Доставь короны</h2><p>Три короны за ${MOVES} ходов. Каждая принесёт 50 золота при входе за 100.</p><button class="primary" data-action="start">Начать партию</button></div></div>`:''}
    ${finished?`<div class="overlay"><div class="dialog"><div class="dialog-crown">${icon(5)}</div><h2>${game.crowns===3?'Все короны доставлены!':'Ходы закончились'}</h2><p>Короны: <b>${game.crowns} / 3</b><br>Возврат: <b>${result.returned} золота</b><br>Итог: <b class="${result.net>=0?'positive':'negative'}">${result.net>0?'+':''}${result.net} золота</b><br>Греча: <b>${result.grecha}</b></p><button class="primary" data-action="restart">Играть ещё</button></div></div>`:''}
  </main>`;
}

function choose(row,col) {
  if (!game || game.finished) return;
  const target={row,col};
  if (!selected) { selected=target; render(); return; }
  if (selected.row===row && selected.col===col) { selected=null; render(); return; }
  const wasPlayed=playSwap(game,selected,target);
  selected=wasPlayed?null:target;
  render();
}
app.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if (action) { game=createGame(); selected=null; render(); return; }
  if (ignoreClick) { ignoreClick=false; return; }
  const cell=event.target.closest('.gem');
  if (cell) choose(Number(cell.dataset.row),Number(cell.dataset.col));
});
app.addEventListener('pointerdown',event=>{
  const cell=event.target.closest('.gem');
  pointerStart=cell?{row:Number(cell.dataset.row),col:Number(cell.dataset.col),x:event.clientX,y:event.clientY}:null;
});
app.addEventListener('pointerup',event=>{
  if (!pointerStart || !game || game.finished) return;
  const origin=pointerStart; pointerStart=null;
  const dx=event.clientX-origin.x,dy=event.clientY-origin.y;
  if (Math.max(Math.abs(dx),Math.abs(dy))<18) return;
  const to=Math.abs(dx)>Math.abs(dy)?{row:origin.row,col:origin.col+Math.sign(dx)}:{row:origin.row+Math.sign(dy),col:origin.col};
  playSwap(game,origin,to);
  selected=null; ignoreClick=true; render();
  setTimeout(()=>{ ignoreClick=false; },0);
});
render();
