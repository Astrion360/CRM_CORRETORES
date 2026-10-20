import { calculateConsortium,calculateFinancing,FINANCING_BENCHMARKS,benchmarkForProduct } from '../simulator.js';
import assert from 'node:assert/strict';
const p={term_months:100,admin_fee_pct:15,reserve_fund_pct:2,other_total_pct:0,insurance_monthly_amount:0,annual_adjustment_pct:0};
const c=calculateConsortium(p,100000);
assert.equal(c.first,1170);assert.equal(c.total,117000);assert.equal(c.last,1170);
const f0=calculateFinancing({assetValue:100000,downPayment:20000,annualRate:0,months:100,system:'PRICE'});
assert.equal(f0.first,800);assert.equal(f0.total,100000);
const sac=calculateFinancing({assetValue:100000,downPayment:0,annualRate:12,months:12,system:'SAC'});
assert.ok(sac.first>sac.last);assert.ok(sac.total>100000);
// Planos de referência cadastrados: sem reajuste, prestamista sobre o crédito integral.
const cases = [
 ['Imóveis',222300,216,21.52,2,.0003,66.69,1337.92,288990.00],
 ['Automóveis',71200,89,18.31,2,.0007,49.84,1012.32,90096.48],
 ['Pesados',247700,104,13.70,2,.00025,61.925,2817.59,293029.10],
 ['Serviços',15600,39,24.56,5,.0007,10.92,529.16,20637.24],
 ['Motos',19300,65,20.05,2,.00025,4.825,367.22,23869.27],
 ['Outros',8000,58,21.94,2,.0007,5.60,176.55,10240.00]
];
for(const [name,credit,term,fee,reserve,rate,expectedInsurance,expectedFirst,expectedTotal] of cases){
 const result=calculateConsortium({term_months:term,admin_fee_pct:fee,reserve_fund_pct:reserve,
 other_total_pct:0,insurance_monthly_amount:0,prestamista_rate_monthly:rate,annual_adjustment_pct:0},credit);
 assert.ok(Math.abs(result.prestamistaMonthlyAmount-expectedInsurance)<.000001,name+' prestamista');
 assert.ok(Math.abs(result.first-expectedFirst)<.01,name+' primeira parcela');
 assert.ok(Math.abs(result.total-expectedTotal)<.01,name+' total');
}
assert.throws(()=>calculateConsortium({...p,prestamista_rate_monthly:-.001},10000),/inválidas/);

/* Redução de 50% antes de contemplação hipotética, compensação após ela, sem perda de capital. */
const normalized={term_months:100,admin_fee_pct:15,reserve_fund_pct:2,other_total_pct:0,
  prestamista_rate_monthly:0,insurance_monthly_amount:0,annual_adjustment_pct:0};
const whole=calculateConsortium(normalized,100000);
const half=calculateConsortium(normalized,100000,{reduced50:true,contemplationMonth:50});
assert.equal(whole.first,1170);
assert.equal(half.first,585);
assert.equal(half.postContemplationFirst,1755);
assert.equal(half.deferredAmount,29250);
assert.equal(half.total,whole.total);
assert.equal(half.reduced50,true);
const insured=calculateConsortium({...normalized,prestamista_rate_monthly:.0007},100000,{reduced50:true,contemplationMonth:50});
assert.equal(insured.first,655); // 50% da parcela-base + prêmio integral
assert.equal(insured.postContemplationFirst,1825);
assert.equal(insured.total,124000);
assert.throws(()=>calculateConsortium(normalized,100000,{reduced50:true,contemplationMonth:100}),/inválidas/);
assert.throws(()=>calculateConsortium(normalized,100000,{reduced50:true,contemplationMonth:0}),/inválidas/);
// Reajuste anual hipotético: o montante adiado no exemplo é compensado integralmente.
const annually={...normalized,annual_adjustment_pct:5};
const annualNormal=calculateConsortium(annually,100000);
const annualHalf=calculateConsortium(annually,100000,{reduced50:true,contemplationMonth:36});
assert.ok(Math.abs(annualNormal.total-annualHalf.total)<.000001);
assert.ok(annualHalf.first<annualNormal.first);
const linked=calculateFinancing({assetValue:100000,months:100,monthlyRate:1.97,system:'PRICE'});
const expected=100000*.0197/(1-Math.pow(1.0197,-100));
assert.ok(Math.abs(linked.first-expected)<.0000001);
assert.ok(Math.abs(linked.total-expected*100)<.000001);
assert.equal(linked.down,0);
assert.equal(linked.monthlyRate,1.97);
assert.equal(calculateFinancing({assetValue:100000,months:100,monthlyRate:0,system:'PRICE'}).first,1000);
assert.equal(FINANCING_BENCHMARKS['Imóveis'].monthly,1.12);
assert.equal(FINANCING_BENCHMARKS['Automóveis'].monthly,1.97);
assert.equal(benchmarkForProduct({category:'Serviços'}).monthly,5.90);

console.log('Cálculos de referência do Órbita Simula: OK');
