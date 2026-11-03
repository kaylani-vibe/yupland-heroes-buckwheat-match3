import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, makeBoard, makeMask, findRuns, findHint, gravity, playSwap, payout, CROWN, CROWN_START, STONE, HOLE, EMPTY, ROWS, COLS, EXIT, seededRandom } from './engine.mjs';

test('fixed map starts with one crown, no accidental matches, and a move',()=>{
  for (let seed=1;seed<=100;seed++) {
    const game=createGame(seed);
    assert.deepEqual(game.board.map(row=>row.map(value=>value===STONE||value===HOLE?value:null)),makeMask());
    assert.equal(game.board.flat().filter(value=>value===CROWN).length,1);
    assert.equal(findRuns(game.board).length,0);
    assert.ok(findHint(game.board));
  }
});

test('stone splits gravity while crown descends in its own column',()=>{
  const board=makeBoard(seededRandom(4));
  board[3][1]=STONE; board[4][1]=STONE;
  board[7][3]=EMPTY; board[8][3]=EMPTY;
  gravity(board,seededRandom(5));
  assert.equal(board[3][1],STONE);
  assert.equal(board[4][1],STONE);
  assert.equal(board[8][3],CROWN);
  assert.equal(board.length,ROWS);
  assert.ok(board.every(row=>row.length===COLS));
});

test('only valid swaps spend moves; results use three crown payouts',()=>{
  const game=createGame(3);
  const before=game.moves;
  assert.equal(playSwap(game,CROWN_START,{row:CROWN_START.row,col:CROWN_START.col+1}),false);
  assert.equal(game.moves,before);
  const hint=findHint(game.board);
  assert.equal(playSwap(game,...hint),true);
  assert.equal(game.moves,before-1);
  assert.ok(game.grecha>0);
  for (let crowns=0;crowns<=3;crowns++) {
    game.crowns=crowns;
    assert.equal(payout(game).net,crowns*50-100);
  }
});

test('a full random party never moves stones and ends within 25 swaps',()=>{
  for (let seed=1;seed<=50;seed++) {
    const game=createGame(seed);
    const mask=makeMask();
    while (!game.finished) {
      const hint=findHint(game.board);
      assert.ok(hint,`no move at seed ${seed}`);
      assert.ok(playSwap(game,...hint));
      for (let row=0;row<ROWS;row++) for (let col=0;col<COLS;col++) {
        if (mask[row][col]===STONE || mask[row][col]===HOLE) assert.equal(game.board[row][col],mask[row][col]);
      }
      assert.ok(game.crowns<=3);
    }
    assert.ok(game.moves>=0);
  }
});

test('the fixed opening has a proven path to all three crowns within 25 moves',()=>{
  const game=createGame();
  const path=[[9,2,9,3],[7,2,8,2],[5,5,6,5],[8,1,9,1],[7,4,8,4],[8,3,8,4],[1,2,1,3],[3,6,4,6],[4,3,4,4],[1,2,2,2],[4,2,4,3],[7,3,7,4],[9,5,9,6],[9,5,9,6]];
  for (const [r1,c1,r2,c2] of path) assert.ok(playSwap(game,{row:r1,col:c1},{row:r2,col:c2}));
  assert.equal(game.crowns,3);
  assert.equal(game.finished,true);
  assert.equal(game.moves,11);
  assert.equal(payout(game).net,50);
});
