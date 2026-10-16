import test from 'node:test';
import assert from 'node:assert/strict';
import './local-replica/dist/pearson.js';
const {pearson,analyze}=globalThis.PearsonAnalysis;
const close=(a,b,tolerance=1e-12)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);

test('known n=3 case has exact two-sided p=2/3',()=>{
  const v=pearson([1,2,3],[1,3,2]);close(v.r,.5);close(v.p,2/3);
  assert.equal(v.decision,'Fail to reject H0');
});
test('n=4 null distribution is uniform, p=1-|r|',()=>{
  const v=pearson([1,2,3,4],[1,3,2,4]);close(v.r,.8);close(v.p,.2);
});
test('perfect positive and negative relationships reject',()=>{
  for(const sign of [1,-1]){
    const v=pearson([1,2,3,4],[1,2,3,4].map(x=>sign*x));
    close(v.r,sign);close(v.p,0);assert.equal(v.decision,'Reject H0');
  }
});
test('zero correlation fails to reject; small and constant samples are undefined',()=>{
  const v=pearson([-1,0,1],[1,-2,1]);close(v.r,0);close(v.p,1);
  assert.equal(v.decision,'Fail to reject H0');
  for(const [x,y] of [[[],[]],[[1,2],[2,3]],[[1,1,1],[1,2,3]]]){
    assert.equal(pearson(x,y).p,null);
  }
});
test('invalid numeric input is rejected',()=>{
  assert.throws(()=>pearson([1,2,3],[1,2]));
  assert.throws(()=>pearson([1,NaN,3],[1,2,3]));
  assert.throws(()=>analyze([Array(22).fill(5)]));
});
test('primary score weights all 14 social items equally and preserves respondent pairing',()=>{
  const rows=[
    [...Array(4).fill(1),...Array(5).fill(2),...Array(5).fill(3),...Array(8).fill(2)],
    [...Array(4).fill(4),...Array(5).fill(1),...Array(5).fill(2),...Array(8).fill(4)],
    [...Array(4).fill(2),...Array(5).fill(4),...Array(5).fill(1),...Array(8).fill(1)],
    Array(22).fill(3),
  ];
  const results=analyze(rows);
  close(results[0].r,pearson([29/14,31/14,33/14,3],[2,4,1,3]).r);
  assert.equal(results[0].role,'Primary hypothesis');
  assert.equal(results.length,4);
});
test('large sample beta calculation converges and remains bounded',()=>{
  const x=Array.from({length:10000},(_,i)=>Math.sin(i));
  const y=x.map((v,i)=>.01*v+Math.cos(i*7));
  const result=pearson(x,y);
  assert.ok(result.p>0 && result.p<1);
});
