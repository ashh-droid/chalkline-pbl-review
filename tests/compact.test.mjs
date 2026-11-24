import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL('../docs/data/'+name,import.meta.url),'utf8'));
test('compact schools preserve every indicator input from full source',()=>{
  const full=read('schools.json'), packed=read('schools-lite.json');
  assert.equal(packed.rows.length,full.length);
  for(let i=0;i<full.length;i++){
    const row=packed.rows[i], source=full[i];
    assert.equal(packed.months[row[0]],source.month);
    assert.equal(packed.blocks[row[1]],source.block);
    assert.equal(Boolean(row[2]&1),source.conducted);
    assert.equal(Boolean(row[2]&2),source.evidence);
    for(let grade=0;grade<3;grade++){
      const c=source.classes.find(x=>x.grade===grade+6);
      assert.deepEqual(row.slice(3+grade*3,6+grade*3),[c.enrolled,c.science,c.math]);
    }
  }
});
