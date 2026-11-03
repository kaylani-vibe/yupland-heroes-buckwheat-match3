// Match scanning, adjacent swapping, seed selection and column gravity adapted
// from neo423/gem-blocks (MIT), commit 04bce8327830244798acf93976be86b4b1dfb890.
// Crown, obstacles, irregular board, payout and move rules are new to this prototype.
export const ROWS = 10;
export const COLS = 8;
export const MOVES = 25;
export const ENTRY_GOLD = 100;
export const CROWN_GOLD = 50;
export const TARGET_CROWNS = 3;
export const EMPTY = -1;
export const STONE = -2;
export const HOLE = -3;
export const CROWN = 5;
export const GEM_COUNT = 5;
export const EXIT = { row: 9, col: 3 };
export const CROWN_START = { row: 6, col: 3 };

const HOLES = [[0,0],[0,7],[1,0],[8,7],[9,0],[9,7]];
const STONES = [[3,1],[4,1],[5,6],[6,6]];

export function seededRandom(initialSeed) {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

export function makeMask() {
  const mask = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (const [r,c] of HOLES) mask[r][c] = HOLE;
  for (const [r,c] of STONES) mask[r][c] = STONE;
  return mask;
}

export function findRuns(board) {
  const runs = [];
  for (let row = 0; row < ROWS; row++) {
    let col = 0;
    while (col < COLS) {
      const value = board[row][col];
      if (value < 0 || value >= GEM_COUNT) { col++; continue; }
      const start = col;
      while (col < COLS && board[row][col] === value) col++;
      if (col - start >= 3) runs.push({ value, length: col-start, cells: Array.from({length:col-start},(_,i)=>({row,col:start+i})) });
    }
  }
  for (let col = 0; col < COLS; col++) {
    let row = 0;
    while (row < ROWS) {
      const value = board[row][col];
      if (value < 0 || value >= GEM_COUNT) { row++; continue; }
      const start = row;
      while (row < ROWS && board[row][col] === value) row++;
      if (row-start >= 3) runs.push({ value, length:row-start, cells:Array.from({length:row-start},(_,i)=>({row:start+i,col})) });
    }
  }
  return runs;
}

export function adjacent(a,b) { return Math.abs(a.row-b.row)+Math.abs(a.col-b.col) === 1; }
export function inside(a) { return a.row>=0 && a.row<ROWS && a.col>=0 && a.col<COLS; }
export function swap(board,a,b) { [board[a.row][a.col],board[b.row][b.col]]=[board[b.row][b.col],board[a.row][a.col]]; }
export function canSwap(board,a,b) {
  if (!inside(a) || !inside(b) || !adjacent(a,b)) return false;
  if (board[a.row][a.col] < 0 || board[a.row][a.col] >= GEM_COUNT || board[b.row][b.col] < 0 || board[b.row][b.col] >= GEM_COUNT) return false;
  swap(board,a,b);
  const valid = findRuns(board).some(run => run.cells.some(cell =>
    (cell.row===a.row && cell.col===a.col) || (cell.row===b.row && cell.col===b.col)));
  swap(board,a,b);
  return valid;
}
export function findHint(board) {
  for (let row=0;row<ROWS;row++) for (let col=0;col<COLS;col++) {
    const a={row,col};
    for (const b of [{row,col:col+1},{row:row+1,col}]) if (canSwap(board,a,b)) return [a,b];
  }
  return null;
}

function fillWithoutMatches(board,random) {
  for (let row=0;row<ROWS;row++) for (let col=0;col<COLS;col++) {
    if (board[row][col] === HOLE || board[row][col] === STONE || board[row][col] === CROWN) continue;
    const candidates=[0,1,2,3,4];
    for (let i=candidates.length-1;i>0;i--) {
      const j=Math.floor(random()*(i+1));
      [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
    }
    board[row][col]=candidates.find(value =>
      !(col>=2 && board[row][col-1]===value && board[row][col-2]===value) &&
      !(row>=2 && board[row-1][col]===value && board[row-2][col]===value)) ?? candidates[0];
  }
}

export function makeBoard(random=seededRandom(20261103),crown=true) {
  for (let attempt=0;attempt<1000;attempt++) {
    const board=makeMask().map(row=>row.map(value=>value ?? EMPTY));
    if (crown) board[CROWN_START.row][CROWN_START.col]=CROWN;
    fillWithoutMatches(board,random);
    if (!findRuns(board).length && findHint(board)) return board;
  }
  throw new Error('Не удалось создать поле с доступным ходом');
}

export function gravity(board,random) {
  for (let col=0;col<COLS;col++) {
    let bottom=ROWS-1;
    while (bottom>=0) {
      if (board[bottom][col]===STONE || board[bottom][col]===HOLE) { bottom--; continue; }
      let top=bottom;
      while (top>0 && board[top-1][col]!==STONE && board[top-1][col]!==HOLE) top--;
      const pieces=[];
      for (let row=top;row<=bottom;row++) if (board[row][col]!==EMPTY) pieces.push(board[row][col]);
      let cursor=bottom;
      for (let i=pieces.length-1;i>=0;i--) board[cursor--][col]=pieces[i];
      while (cursor>=top) board[cursor--][col]=Math.floor(random()*GEM_COUNT);
      bottom=top-1;
    }
  }
}

export function createGame(seed=2) {
  const random=seededRandom(seed);
  return {board:makeBoard(random),random,moves:MOVES,crowns:0,grecha:0,chain:0,finished:false,lastGain:0};
}

function resolve(game) {
  let chain=0, gain=0;
  while (chain<40) {
    const runs=findRuns(game.board);
    if (!runs.length) break;
    chain++;
    const cells=new Set();
    for (const run of runs) for (const cell of run.cells) cells.add(`${cell.row},${cell.col}`);
    gain += cells.size + runs.reduce((n,run)=>n+(run.length>=5?5:run.length===4?2:0),0) + (chain>1?chain*2:0);
    for (const key of cells) {
      const [row,col]=key.split(',').map(Number);
      game.board[row][col]=EMPTY;
    }
    gravity(game.board,game.random);
    if (game.board[EXIT.row][EXIT.col]===CROWN) {
      game.crowns++;
      game.board[EXIT.row][EXIT.col]=EMPTY;
      gravity(game.board,game.random);
    }
  }
  // One new crown per completed cascade; no surprise multiple deliveries in a single swap.
  if (game.crowns<TARGET_CROWNS && !game.board.some(row=>row.includes(CROWN))) {
    game.board[CROWN_START.row][CROWN_START.col]=CROWN;
  }
  game.grecha+=gain;
  game.lastGain=gain;
  game.chain=chain;
  if (game.crowns===TARGET_CROWNS || game.moves===0) game.finished=true;
  if (!game.finished && !findHint(game.board)) {
    const crown=game.board.flatMap((row,r)=>row.map((value,c)=>value===CROWN?{row:r,col:c}:null)).find(Boolean);
    const fresh=makeBoard(game.random,false);
    if (crown) fresh[crown.row][crown.col]=CROWN;
    game.board=fresh;
  }
}

export function playSwap(game,a,b) {
  if (game.finished || !canSwap(game.board,a,b)) return false;
  swap(game.board,a,b);
  game.moves--;
  resolve(game);
  return true;
}

export function payout(game) {
  const returned=game.crowns*CROWN_GOLD;
  return { entry:ENTRY_GOLD, returned, net:returned-ENTRY_GOLD, grecha:game.grecha };
}
