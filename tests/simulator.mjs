import { calculateConsortium,calculateFinancing } from '../simulator.js';
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
console.log('Cálculos de referência do Órbita Simula: OK');
