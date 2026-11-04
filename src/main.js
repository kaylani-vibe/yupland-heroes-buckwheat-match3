import './style.css';
import './kingdom.css';
import {COLS,ROWS,MOVES,TARGET_CROWNS,CROWN,CROWN_START,STONE,HOLE,EXIT,SPECIAL,colorOf,specialType,createGame,playSwap,payout} from './engine.mjs';

// Keyed pieces and the remove/fall/refill sequence adapt PlayBoard.tsx from
// the developer-supplied YupMatch archive (02 Nov 2026).
const names=['гречневое зерно','колос','лист','ягоды','цветок','корона'];
const app=document.querySelector('#app');
const previewBoard=createGame().board;
let nextId=1,game=null,selected=null,pointerStart=null,ignoreClick=false,busy=false;
let pieces=makePieces(previewBoard);
function newGame(){
  const next=createGame();
  if(import.meta.env.DEV){
    const pair={ 'ray-ray':[15,21], 'ray-bomb':[15,26], 'rainbow-ray':[30,15], 'rainbow-bomb':[30,25] }[new URLSearchParams(location.search).get('qaCombo')];
    if(pair){next.board[4][3]=pair[0];next.board[4][4]=pair[1];}
  }
  return next;
}
function makePieces(board){return board.flatMap((line,row)=>line.flatMap((value,col)=>value>=0?[{id:nextId++,row,col,value}]:[]));}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const icon=kind=>`<span class="icon icon-${kind}" aria-hidden="true"></span>`;
const specialGlyph={1:'↔',2:'↕',3:'✸',4:'★'};
const pieceInner=p=>{const type=specialType(p.value),kind=type?colorOf(p.value):p.value;return `${type===SPECIAL.RAINBOW?'<span class="rainbow-art" aria-hidden="true">✦</span>':icon(kind)}${type?`<b class="power-mark">${specialGlyph[type]}</b>`:''}`;};
const pieceMarkup=p=>`<span class="piece ${p.value===CROWN?'royal':''} ${specialType(p.value)?'powered':''}" data-id="${p.id}" style="transform:translate(${p.col*100}%,${p.row*100}%)">${pieceInner(p)}</span>`;
function cellMarkup(value,row,col){
  if(value===HOLE)return '<span class="cell hole" aria-hidden="true"></span>';
  if(value===STONE)return '<span class="cell stone" aria-label="Неподвижный камень"><span class="rock"></span></span>';
  const chosen=selected?.row===row&&selected?.col===col;
  const type=specialType(value),label=type===SPECIAL.RAINBOW?'Радуга':type?`${names[colorOf(value)]}, ${type===SPECIAL.BURST?'Вспышка':'Луч'}`:names[value];
  return `<button class="cell gem ${chosen?'selected':''} ${row===EXIT.row&&col===EXIT.col?'exit':''}" data-row="${row}" data-col="${col}" aria-label="${label||'пусто'}, ряд ${row+1}, столбец ${col+1}" aria-pressed="${chosen}">${row===EXIT.row&&col===EXIT.col?'<span class="exit-marker" aria-hidden="true">↓</span>':''}</button>`;
}
function render(){
  const started=!!game,finished=game?.finished,result=finished?payout(game):null,board=game?.board??previewBoard;
  const crowns=game?.crowns??0;
  app.innerHTML=`<main class="shell">
    <div class="ambience" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <header class="masthead">
      <span class="lantern-halo left" aria-hidden="true"></span><span class="lantern-halo right" aria-hidden="true"></span>
      <img class="canopy-art" src="/art/kingdom-header.png" alt="" width="1768" height="870" draggable="false">
      <span class="brand">Yupland Heroes</span>
      <h1>Корона гречневого<br>королевства</h1>
    </header>
    <section class="game-panel" aria-label="Игровая партия">
      <div class="mission-row">
        <div class="mission-plaque">${icon(CROWN)}<div><span class="mission-eyebrow">Задание королевства</span><p>Опусти <b>3 короны</b> к выходу</p></div></div>
        <div class="stat moves-stat"><span class="stat-label">Ходы</span><strong class="moves-count">${started?game.moves:MOVES}</strong><span class="laurel" aria-hidden="true">❧</span></div>
      </div>
      <div class="journey-strip"><div class="crown-tally" aria-label="Доставлено корон: ${crowns} из 3">${Array.from({length:3},(_,i)=>`<span class="crown-slot ${i<crowns?'collected':''}">${icon(CROWN)}</span>`).join('')}<b>${crowns}<span> / ${TARGET_CROWNS}</span></b></div><div class="grecha-tally">${icon(0)}<span>Греча <b>${game?.grecha??0}</b></span></div></div>
      <div class="board-frame">
        <img class="board-art" src="/art/kingdom-frame.png" alt="" draggable="false">
        <div class="board" role="group" aria-label="Поле: меняй соседние фишки местами">${board.map((line,row)=>line.map((value,col)=>cellMarkup(value,row,col)).join('')).join('')}<div class="piece-layer" aria-hidden="true">${pieces.map(pieceMarkup).join('')}</div><div class="effect-layer" aria-hidden="true"></div></div>
      </div>
      <div class="exit-scene"><span class="exit-trail" aria-hidden="true"></span><img src="/art/exit-portal.png" alt="" class="exit-portal" draggable="false"><span class="exit-label">Выход короны</span></div>
      <p class="hint" role="status">${!started?'Собирай ряды, освобождай путь коронам':finished?'Партия завершена':game.lastGain?`+${game.lastGain} гречи${game.chain>1?` · каскад ×${game.chain}`:''}`:'Соединяй одинаковые фишки и смешивай бонусы'}</p>
      <div class="rule"><span>Вход <b>100 золота</b></span><span>За корону <b>50 золота</b></span></div>
    </section>
    <p class="footnote">Три короны: 150 золота · две: 100 · одна: 50</p>
    ${!started?`<div class="overlay"><div class="dialog"><div class="dialog-crown">${icon(CROWN)}</div><span class="dialog-eyebrow">Гречневое королевство</span><h2>Верни короны</h2><p>Освободи путь трём коронам<br>за ${MOVES} ходов.</p><div class="entry-price">Вход <b>100 золота</b><span>Каждая корона принесёт 50 золота</span></div><button class="primary" data-action="start">Начать партию</button></div></div>`:''}
    ${finished?`<div class="overlay"><div class="dialog"><div class="dialog-crown">${icon(CROWN)}</div><span class="dialog-eyebrow">Гречневое королевство</span><h2>${game.crowns===3?'Все короны<br>доставлены!':'Ходы закончились'}</h2><p>Короны: <b>${game.crowns} / 3</b><br>Возврат: <b>${result.returned} золота</b><br>Итог: <b class="${result.net>=0?'positive':'negative'}">${result.net>0?'+':''}${result.net} золота</b><br>Греча: <b>${result.grecha}</b></p><button class="primary" data-action="restart">Играть ещё</button></div></div>`:''}
  </main>`;
}
const layer=()=>app.querySelector('.piece-layer');
const effectLayer=()=>app.querySelector('.effect-layer');
const nodeFor=p=>p?layer()?.querySelector(`[data-id="${p.id}"]`):null;
function updatePositions(){for(const p of pieces){const el=nodeFor(p);if(el)el.style.transform=`translate(${p.col*100}%,${p.row*100}%)`;}}
function addPiece(p){layer()?.insertAdjacentHTML('beforeend',pieceMarkup(p));}
function removePiece(p){nodeFor(p)?.remove();pieces=pieces.filter(q=>q.id!==p.id);}
const pieceAt=(row,col)=>pieces.find(p=>p.row===row&&p.col===col);
function flash(cells,wave,runs,effects=[],consumed=[]){
  const fx=effectLayer();if(!fx)return;
  fx.innerHTML=cells.map(([row,col])=>`<i class="impact" style="--x:${col};--y:${row}"></i>`).join('');
  for(const [row,col] of cells){if(consumed.includes(`${row},${col}`))continue;const type=specialType(pieceAt(row,col)?.value);if(type===SPECIAL.RAY_H||type===SPECIAL.RAY_V)fx.insertAdjacentHTML('beforeend',`<i class="match-beam ${type===SPECIAL.RAY_H?'horizontal':'vertical'}" style="--x:${type===SPECIAL.RAY_H?0:col};--y:${type===SPECIAL.RAY_H?row:0};--span:${type===SPECIAL.RAY_H?COLS:ROWS}"></i>`);if(type===SPECIAL.BURST||type===SPECIAL.RAINBOW)fx.insertAdjacentHTML('beforeend',`<i class="power-burst" style="--x:${col};--y:${row}"></i>`);}
  for(const effect of effects)fx.insertAdjacentHTML('beforeend',`<i class="match-beam ${effect.type==='h'?'horizontal':'vertical'}" style="--x:${effect.col};--y:${effect.row};--span:${effect.type==='h'?COLS:ROWS}"></i>`);
  for(const run of runs)if(run.length>=4){const first=run.cells[0],last=run.cells.at(-1);fx.insertAdjacentHTML('beforeend',`<i class="match-beam ${first.row===last.row?'horizontal':'vertical'}" style="--x:${first.col};--y:${first.row};--span:${run.length}"></i>`);}
  if(wave>1)fx.insertAdjacentHTML('beforeend',`<span class="combo-pop">Каскад ×${wave}</span>`);
  setTimeout(()=>{if(fx.isConnected)fx.innerHTML='';},600);
}
async function collapseTo(target){
  const entrants=[];
  for(let col=0;col<COLS;col++){
    let bottom=ROWS-1;
    while(bottom>=0){
      if(target[bottom][col]===HOLE||target[bottom][col]===STONE){bottom--;continue;}
      let top=bottom;while(top>0&&target[top-1][col]!==HOLE&&target[top-1][col]!==STONE)top--;
      const kept=pieces.filter(p=>!p.entering&&p.col===col&&p.row>=top&&p.row<=bottom).sort((a,b)=>b.row-a.row);
      const rows=Array.from({length:bottom-top+1},(_,k)=>bottom-k);
      kept.forEach((p,k)=>{p.row=rows[k];});
      for(let k=kept.length;k<rows.length;k++){
        const row=rows[k],p={id:nextId++,row:top-1-(k-kept.length),col,value:target[row][col],entering:true};
        pieces.push(p);addPiece(p);entrants.push([p,row]);
      }
      bottom=top-1;
    }
  }
  await frame();
  for(const [p,row] of entrants){p.row=row;p.entering=false;}
  updatePositions();await wait(390);
}
async function animateSwap(a,b){
  const p=pieceAt(a.row,a.col),q=pieceAt(b.row,b.col);if(!p||!q)return;
  [p.row,q.row]=[q.row,p.row];[p.col,q.col]=[q.col,p.col];updatePositions();await wait(190);
}
async function performSwap(a,b){
  if(!game||game.finished||busy)return;
  busy=true;selected=null;
  const valid=playSwap(game,a,b);
  await animateSwap(a,b);
  if(!valid){await animateSwap(a,b);busy=false;render();return;}
  for(const step of game.lastAnimation.steps){
    for(const change of step.transformed??[]){const p=pieceAt(change.row,change.col);if(p){p.value=change.value;const el=nodeFor(p);if(el){el.classList.add('powered','transforming');el.innerHTML=pieceInner(p);}}}
    if(step.transformed?.length){await wait(320);for(const p of pieces)nodeFor(p)?.classList.remove('transforming');}
    for(const created of step.created){const p=pieceAt(created.row,created.col);if(p){p.value=created.value;const el=nodeFor(p);if(el){el.classList.add('powered');el.innerHTML=pieceInner(p);}}}
    flash(step.cleared,step.wave,step.runs,step.effects,step.consumed);
    for(const [row,col] of step.cleared)nodeFor(pieceAt(row,col))?.classList.add('dying');
    await wait(230);
    for(const [row,col] of step.cleared){const p=pieceAt(row,col);if(p)removePiece(p);}
    await collapseTo(step.afterGravity);
    if(step.delivered){
      const crown=pieceAt(EXIT.row,EXIT.col);
      if(crown){nodeFor(crown)?.classList.add('delivered');effectLayer()?.insertAdjacentHTML('beforeend','<span class="crown-pop">+50 золота</span>');await wait(400);removePiece(crown);}
      await collapseTo(step.afterDelivery);
    }
  }
  if(game.lastAnimation.spawned){
    const {row,col}=CROWN_START,replaced=pieceAt(row,col);if(replaced)removePiece(replaced);
    const crown={id:nextId++,row:-1,col,value:CROWN};pieces.push(crown);addPiece(crown);
    await frame();crown.row=row;updatePositions();await wait(420);
  }
  if(game.lastAnimation.shuffled){layer()?.classList.add('shuffling');await wait(230);pieces=makePieces(game.board);layer().innerHTML=pieces.map(pieceMarkup).join('');layer()?.classList.remove('shuffling');await wait(230);}
  busy=false;render();
}
function choose(row,col){
  if(!game||game.finished||busy)return;
  const target={row,col};
  if(!selected){selected=target;render();return;}
  if(selected.row===row&&selected.col===col){selected=null;render();return;}
  const a=selected;
  if(Math.abs(a.row-row)+Math.abs(a.col-col)!==1){selected=target;render();return;}
  void performSwap(a,target);
}
app.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action){game=newGame();pieces=makePieces(game.board);selected=null;busy=false;render();return;}
  if(ignoreClick){ignoreClick=false;return;}
  const cell=event.target.closest('.gem');if(cell)choose(Number(cell.dataset.row),Number(cell.dataset.col));
});
app.addEventListener('pointerdown',event=>{const cell=event.target.closest('.gem');pointerStart=cell?{row:Number(cell.dataset.row),col:Number(cell.dataset.col),x:event.clientX,y:event.clientY}:null;});
app.addEventListener('pointerup',event=>{
  if(!pointerStart||!game||game.finished||busy)return;
  const origin=pointerStart;pointerStart=null;const dx=event.clientX-origin.x,dy=event.clientY-origin.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
  const to=Math.abs(dx)>Math.abs(dy)?{row:origin.row,col:origin.col+Math.sign(dx)}:{row:origin.row+Math.sign(dy),col:origin.col};
  ignoreClick=true;setTimeout(()=>{ignoreClick=false;},0);void performSwap(origin,to);
});
render();
