import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,playSwap,canSwap,CROWN,ROWS,COLS,MOVES,SPECIAL,specialType,colorOf} from './engine.mjs';

const value=(type,color=0)=>10+type*5+color;
const key=(row,col)=>`${row},${col}`;
const a={row:4,col:3},b={row:4,col:4};

for(const left of [SPECIAL.RAY_H,SPECIAL.RAY_V])for(const right of [SPECIAL.RAY_H,SPECIAL.RAY_V]){
  test(`rays ${left}+${right} fire a cross without needing a match`,()=>{
    const g=createGame();g.board[a.row][a.col]=value(left,0);g.board[b.row][b.col]=value(right,1);
    const before=g.board.map(r=>[...r]);
    assert.ok(canSwap(g.board,a,b));assert.deepEqual(g.board,before);
    assert.ok(playSwap(g,a,b));assert.equal(g.moves,MOVES-1);
    const step=g.lastAnimation.steps[0],actual=new Set(step.cleared.map(([r,c])=>key(r,c)));
    for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){
      const expected=before[row][col]>=0&&before[row][col]!==CROWN&&(row===b.row||col===b.col);
      assert.equal(actual.has(key(row,col)),expected,`cell ${row},${col}`);
    }
    assert.equal(step.effects.length,2);
  });
}

for(const [left,right] of [[SPECIAL.RAY_H,SPECIAL.BURST],[SPECIAL.BURST,SPECIAL.RAY_V]]){
  test(`ray and bomb ${left}+${right} clear three rows and three columns`,()=>{
    const g=createGame();g.board[a.row][a.col]=value(left,0);g.board[b.row][b.col]=value(right,1);
    const before=g.board.map(r=>[...r]);assert.ok(playSwap(g,a,b));
    const step=g.lastAnimation.steps[0],actual=new Set(step.cleared.map(([r,c])=>key(r,c)));
    for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){
      const expected=before[row][col]>=0&&before[row][col]!==CROWN&&(Math.abs(row-b.row)<=1||Math.abs(col-b.col)<=1);
      assert.equal(actual.has(key(row,col)),expected,`cell ${row},${col}`);
    }
    assert.equal(step.effects.length,6);
  });
}

for(const type of [SPECIAL.RAY_H,SPECIAL.RAY_V,SPECIAL.BURST])for(const reverse of [false,true]){
  test(`rainbow converts and immediately detonates color 0 as ${type}, reverse ${reverse}`,()=>{
    const g=createGame();g.board[a.row][a.col]=value(reverse?type:SPECIAL.RAINBOW,0);g.board[b.row][b.col]=value(reverse?SPECIAL.RAINBOW:type,0);
    g.board[6][3]=CROWN;
    const expected=g.board.flat().filter(v=>colorOf(v)===0).length;
    assert.ok(playSwap(g,a,b));
    const step=g.lastAnimation.steps[0],removed=new Set(step.cleared.map(([r,c])=>key(r,c)));
    assert.equal(step.transformed.length,expected);
    for(const change of step.transformed){assert.equal(specialType(change.value),type);assert.equal(colorOf(change.value),0);assert.ok(removed.has(key(change.row,change.col)));}
    assert.equal(g.moves,MOVES-1);
    assert.ok(!step.cleared.some(([r,c])=>r===6&&c===3),'crown is preserved');
    assert.equal(g.board[3][1],-2);assert.equal(g.board[5][6],-2);
  });
}

test('wide cross is clipped at the board edge and never creates invalid cells',()=>{
  const g=createGame(),from={row:2,col:0},to={row:3,col:0};
  g.board[2][0]=value(SPECIAL.BURST);g.board[3][0]=value(SPECIAL.RAY_H,1);
  assert.ok(playSwap(g,from,to));
  assert.ok(g.lastAnimation.steps[0].cleared.every(([r,c])=>r>=0&&r<ROWS&&c>=0&&c<COLS));
  assert.equal(g.lastAnimation.steps[0].effects.length,5);
});
