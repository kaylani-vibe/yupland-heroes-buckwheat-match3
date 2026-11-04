import './style.css';
import './kingdom.css';
import './screen.css';
import {COLS,ROWS,MOVES,TARGET_CROWNS,CROWN,STONE,HOLE,ENTRY_COLS,EXITS,SPECIAL,colorOf,specialType,createGame,playSwap} from './engine.mjs';
import {createInventory} from './inventory.mjs';

// Keyed pieces and the remove/fall/refill sequence adapt PlayBoard.tsx from
// the developer-supplied YupMatch archive (02 Nov 2026).
const names=['гречневое зерно','колос','лист','ягоды','цветок','корона'];
const app=document.querySelector('#app');
const previewBoard=createGame().board;
let nextId=1,game=null,selected=null,pointerStart=null,ignoreClick=false,busy=false;
let pieces=makePieces(previewBoard),bagOpen=false;
const qaMode=import.meta.env.DEV&&[...new URLSearchParams(location.search).keys()].some(k=>k.startsWith('qa'));
const inventory=createInventory(localStorage,qaMode?'buckwheat-match3:qa-crowns':'buckwheat-match3:crowns');
const crownWord=n=>n%10===1&&n%100!==11?'корона':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'короны':'корон';
function newGame(){
  const next=createGame();
  if(import.meta.env.DEV){
    const pair={ 'ray-ray':[15,21], 'ray-bomb':[15,26], 'rainbow-ray':[30,15], 'rainbow-bomb':[30,25] }[new URLSearchParams(location.search).get('qaCombo')];
    if(pair){next.board[4][3]=pair[0];next.board[4][4]=pair[1];}
    if(new URLSearchParams(location.search).get('qaCrown')==='blocked'){
      next.board[4][6]=CROWN;
      next.board[5][3]=0;next.board[5][4]=0;next.board[5][5]=1;next.board[4][5]=0;
    }
  }
  if(import.meta.env.DEV&&new URLSearchParams(location.search).get('qaResult')==='two'){
    next.crowns=2;next.moves=0;next.finished=true;
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
const routeArrow='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M14 3h12v16h10L20 37 4 19h10z"/></svg>';
const routeMarkers=()=>ENTRY_COLS.map(col=>`<span class="route-marker entry-route" style="--col:${col}">${routeArrow}</span><span class="route-marker exit-route" style="--col:${col}">${routeArrow}</span>`).join('');
function cellMarkup(value,row,col){
  if(value===HOLE)return '<span class="cell hole edge-chest" aria-label="Деревянный сундук"><span class="chest" aria-hidden="true"></span></span>';
  if(value===STONE)return '<span class="cell stone" aria-label="Неподвижный камень"><span class="rock"></span></span>';
  const chosen=selected?.row===row&&selected?.col===col;
  const type=specialType(value),label=type===SPECIAL.RAINBOW?'Радуга':type?`${names[colorOf(value)]}, ${type===SPECIAL.BURST?'Вспышка':'Луч'}`:names[value];
  const entry=row===0&&ENTRY_COLS.includes(col),exit=EXITS.some(cell=>cell.row===row&&cell.col===col);
  return `<button class="cell gem ${chosen?'selected':''} ${entry?'entry':''} ${exit?'exit':''}" data-row="${row}" data-col="${col}" aria-label="${label||'пусто'}, ряд ${row+1}, столбец ${col+1}${entry?', вход короны':''}${exit?', выход короны':''}" aria-pressed="${chosen}"></button>`;
}
function render(){
  const started=!!game,finished=game?.finished,board=game?.board??previewBoard;
  const crowns=game?.crowns??0;
  app.innerHTML=`<main class="shell">
    <div class="ambience" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <header class="masthead">
      <span class="lantern-halo left" aria-hidden="true"></span><span class="lantern-halo right" aria-hidden="true"></span>
      <img class="canopy-art" src="${import.meta.env.BASE_URL}art/kingdom-header.png?v=compact-20261104" alt="" width="2172" height="724" draggable="false">
      <h1>Корона гречневого<br>королевства</h1>
    </header>
    <section class="game-panel" aria-label="Игровая партия">
      <div class="mission-row">
        <div class="mission-plaque">${icon(CROWN)}<p>Опусти <b>3 короны</b> к выходу</p></div>
        <div class="stat moves-stat"><span class="stat-label">Ходы</span><strong class="moves-count">${started?game.moves:MOVES}</strong></div>
      </div>
      <div class="journey-strip"><div class="crown-tally" aria-label="Доставлено корон: ${crowns} из 3">${icon(CROWN)}<b>${crowns}<span> / ${TARGET_CROWNS}</span></b></div><span class="status-divider" aria-hidden="true"></span><div class="grecha-tally">${icon(0)}<span>Греча <b>${game?.grecha??0}</b></span></div></div>
      <div class="board-area"><div class="board-frame">
        <img class="board-art" src="${import.meta.env.BASE_URL}art/kingdom-frame.png?v=compact-20261104" alt="" draggable="false">
        <div class="board" role="group" aria-label="Поле: меняй соседние фишки местами">${board.map((line,row)=>line.map((value,col)=>cellMarkup(value,row,col)).join('')).join('')}<div class="piece-layer" aria-hidden="true">${pieces.map(pieceMarkup).join('')}</div><div class="effect-layer" aria-hidden="true"></div></div><div class="route-layer" aria-hidden="true">${routeMarkers()}</div>
      </div></div>
    </section>
    ${!started?`<div class="overlay"><div class="dialog"><div class="dialog-crown">${icon(CROWN)}</div><span class="dialog-eyebrow">Гречневое королевство</span><h2>Верни короны</h2><p>Освобождай место под верхними стрелками.<br>Опусти три короны за ${MOVES} ходов.</p><div class="entry-price">Вход <b>100 золота</b></div><button class="primary" data-action="start">Начать партию</button><button class="bag-link" data-action="bag">Рюкзак · ${inventory.count()} ${crownWord(inventory.count())}</button></div></div>`:''}
    ${finished?`<div class="overlay"><div class="dialog"><div class="dialog-crown">${icon(CROWN)}</div><span class="dialog-eyebrow">Гречневое королевство</span><h2>Получено<br>${game.crowns} ${crownWord(game.crowns)}</h2><p>Греча: <b>${game.grecha}</b></p><button class="primary" data-action="restart">Играть ещё</button><button class="bag-link" data-action="bag">Открыть рюкзак</button></div></div>`:''}
    ${bagOpen?`<div class="overlay bag-overlay"><div class="dialog"><div class="dialog-crown">${icon(CROWN)}</div><h2>Рюкзак</h2><p class="inventory-count">${inventory.count()} ${crownWord(inventory.count())}</p><button class="primary" data-action="close-bag">Вернуться</button></div></div>`:''}
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
async function collapseTo(paths){
  const moving=paths.map(route=>{
    let p=route.from?pieceAt(route.from.row,route.from.col):null;
    if(!p){p={id:nextId++,...route.path[0],value:route.value};pieces.push(p);addPiece(p);}
    // Keep each bend around a block, merge uninterrupted vertical travel.
    const waypoints=[route.path[0]];
    for(let i=1;i<route.path.length;i++){
      const prev=route.path[i-1],here=route.path[i],next=route.path[i+1];
      if(!next||prev.col!==here.col||here.col!==next.col)waypoints.push(here);
    }
    return {p,waypoints};
  });
  await frame();
  const stages=Math.max(0,...moving.map(m=>m.waypoints.length-1));
  for(let i=1;i<=stages;i++){
    let duration=160;
    for(const {p,waypoints} of moving)if(waypoints[i]){
      const next=waypoints[i];
      duration=Math.max(duration,Math.min(390,140+Math.abs(p.row-next.row)*35));
    }
    for(const {p,waypoints} of moving)if(waypoints[i]){
      const el=nodeFor(p);if(el)el.style.transitionDuration=`${duration}ms`;
      p.row=waypoints[i].row;p.col=waypoints[i].col;
    }
    updatePositions();await wait(duration);
  }
  for(const {p} of moving){const el=nodeFor(p);if(el)el.style.removeProperty('transition-duration');}
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
    await collapseTo(step.gravityPaths);
    if(step.delivered){
      const crown=pieceAt(step.deliveredAt.row,step.deliveredAt.col);
      if(crown){nodeFor(crown)?.classList.add('delivered');effectLayer()?.insertAdjacentHTML('beforeend','<span class="crown-pop">+50 золота</span>');await wait(400);removePiece(crown);}
      await collapseTo(step.deliveryPaths);
    }
  }
  if(game.lastAnimation.shuffled){layer()?.classList.add('shuffling');await wait(230);pieces=makePieces(game.board);layer().innerHTML=pieces.map(pieceMarkup).join('');layer()?.classList.remove('shuffling');await wait(230);}
  inventory.collect(game);busy=false;render();
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
  if(action==='bag'){bagOpen=true;render();return;}
  if(action==='close-bag'){bagOpen=false;render();return;}
  if(action){game=newGame();inventory.collect(game);pieces=makePieces(game.board);selected=null;busy=false;bagOpen=false;render();return;}
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
