import assert from 'node:assert/strict';
import {calculate} from '../site/calculator.mjs';
const base={ingredients:18,hours:3,rate:15,extras:6,price:65,feePercent:3,feeFixed:.3,margin:25};
const r=calculate(base);
assert.equal(r.cost,69);assert.equal(r.fees,2.25);assert.equal(r.surplus,-6.25);assert.equal(r.target,96.25);assert.equal(r.floor,71.45);
const target=calculate({...base,price:r.target});assert.ok(target.actualMargin>=25-1e-9);
const zeroFee=calculate({...base,ingredients:60,hours:0,extras:0,feePercent:0,feeFixed:0,price:80});assert.equal(zeroFee.target,80);assert.equal(zeroFee.actualMargin,25);assert.equal(zeroFee.actualRate,null);
assert.throws(()=>calculate({...base,margin:97}),RangeError);assert.throws(()=>calculate({...base,hours:-1}),RangeError);assert.throws(()=>calculate({...base,price:NaN}),RangeError);assert.throws(()=>calculate({...base,ingredients:Infinity}),RangeError);
const zero=calculate(Object.fromEntries(Object.keys(base).map(k=>[k,0])));assert.equal(zero.target,0);assert.equal(zero.floor,0);assert.equal(zero.surplus,0);assert.equal(zero.actualMargin,null);
for(const margin of [0,5,25,49.5])for(const fee of [0,3,9.7]){
  const q=calculate({...base,margin,feePercent:fee});
  const p=calculate({...base,margin,feePercent:fee,price:q.target});
  assert.ok(p.actualMargin>=margin-1e-7);
}
console.log('PASS: baseline, margin/markup, zero inputs, invalid entries, and 12 target-margin rounding combinations.');
