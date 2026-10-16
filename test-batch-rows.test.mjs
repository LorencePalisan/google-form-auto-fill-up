import test from 'node:test';
import assert from 'node:assert/strict';
import {selectTestBatch,testBatchStatus} from './test-batch-rows.mjs';

test('status separates remaining paired rows from extra unused emails',()=>{
  assert.deepEqual(testBatchStatus([{},{}],['a@test.test',' A@TEST.TEST ','b@test.test','c@test.test'],new Set(['a@test.test'])),
    {sourceRows:2,remainingPairedRows:1,unpairedUnusedEmails:1});
});

test('resume keeps the original source-to-email pairing',()=>{
  const source=[{id:1},{id:2},{id:3}];
  const result=selectTestBatch(source,['a@test.test','b@test.test','c@test.test'],new Set(['a@test.test']),2);
  assert.deepEqual(result.map(r=>r.answers.id),[2,3]);
});
test('a request exceeding source rows fails instead of cycling',()=>{
  assert.throws(()=>selectTestBatch([{id:1}],['a@test.test','b@test.test'],new Set(),2),/exhausted/);
});
test('legacy history beyond the source never starts another cycle',()=>{
  assert.throws(()=>selectTestBatch([{id:1}],['a@test.test','b@test.test'],new Set(['a@test.test']),1),/exhausted/);
});
test('duplicate emails do not consume additional source rows',()=>{
  const result=selectTestBatch([{id:1},{id:2}],['a@test.test',' A@TEST.TEST ','b@test.test'],new Set(),2);
  assert.deepEqual(result.map(r=>r.answers.id),[1,2]);
});
test('short email supply and invalid limits fail before a partial batch is returned',()=>{
  assert.throws(()=>selectTestBatch([{}],['a@test.test'],new Set(),2),/Only 1/);
  assert.throws(()=>selectTestBatch([{}],['a@test.test'],new Set(),0),/positive/);
});
