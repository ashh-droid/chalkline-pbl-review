import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankStrongest,geography,availableRows, riskLevel} from '../docs/app/core.js';
import {buildReviewDetail,generateReviewActions,nextDueDate} from '../docs/app/review.js';
import {validateNarrative} from '../docs/app/narrative.js';
import {computeGrant} from '../docs/app/grant.js';
const data=(name)=>JSON.parse(readFileSync(new URL(`../docs/data/${name}`,import.meta.url)));
const [schools,grants,finance,media]=['schools.json','grants.json','finance.json','media.json'].map(data);
const f={month:'2025-09',district:'',block:'',grade:'all',subject:'all'};

test('strongest rankings exclude districts with small school populations',()=>{
 const all=geography(availableRows(schools,f),'district');
 assert.ok(all.some(x=>x.metrics.schools<10));
 assert.ok(rankStrongest(all).every(x=>x.metrics.schools>=10));
});

test('meeting pack derives named priorities, changes and synthetic action owners',()=>{
 const review=buildReviewDetail(schools,f);
 assert.equal(review.changes.length,3);
 assert.equal(review.indicatorCounts.length,3);
 assert.ok(review.priorityBlocks[0].name);
 assert.ok(review.prompts[0].includes(review.priorityBlocks[0].name));
 assert.equal(review.actions.length,3);
 assert.ok(review.actions.every(a=>a.status==='Proposed' && a.owner.includes('proposed')));
 assert.equal(nextDueDate('2025-09',7),'2025-10-07');
});

test('finance warning adds a proposed reconciliation action',()=>{
 const actions=generateReviewActions(schools,f,['Mismatch']);
 assert.equal(actions.length,4);
 assert.ok(actions.at(-1).action.includes('Reconcile'));
});

test('validator rejects invented numbers, missing citations and unknown fact IDs',()=>{
 const facts=[{id:'F1',label:'Attendance',value:'59.5% (1,37,517)',source:'CSV'},
 {id:'F2',label:'Period',value:'September 2025',source:'CSV'}];
 assert.equal(validateNarrative('Attendance was 59.5%. [F1]',facts).valid,true);
 assert.equal(validateNarrative('Attendance was 88%. [F1]',facts).valid,false);
 assert.equal(validateNarrative('Attendance was 59.5%.',facts).valid,false);
 assert.equal(validateNarrative('Attendance was 59.5%. [F1] Participation improved. ',facts).valid,false);
 assert.equal(validateNarrative('Attendance was 59.5%. [F99]',facts).valid,false);
});

test('grant report discloses final-period budget gap and month delta as facts',()=>{
 const report=computeGrant(schools,grants,finance,media,'GRANT_AA_2025','2025-09');
 assert.ok(report.facts.find(x=>x.id==='F13').value.includes('2025-09-30'));
 assert.ok(report.narrative.includes('grant period ended'));
 assert.ok(report.facts.some(x=>x.id==='F12'));
});

test('import quality summary uses same 0.1 percentage-point threshold as UI',()=>{
 const q=data('quality.json');
 const rateMismatches=finance.filter(x=>Math.abs(100*x.cumulative/x.approved-100*x.sourceRate)>0.1).length;
 assert.equal(q.financeRateMismatch,rateMismatches);
 assert.equal(q.financeRunningTotalMismatch,4);
});
