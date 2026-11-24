/** Reproducible compact browser dataset. Full source remains available for audits. */
import { readFileSync, writeFileSync } from 'node:fs';
const source = JSON.parse(readFileSync(new URL('../docs/data/schools.json', import.meta.url), 'utf8'));
const months = ['2025-07', '2025-08', '2025-09'];
const blocks = [...new Set(source.map(row => row.block))]
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const indices = new Map(blocks.map((block, i) => [block, i]));
const rows = source.map(row => {
  const grades = [6, 7, 8].flatMap(grade => {
    const c = row.classes.find(entry => entry.grade === grade);
    if (!c) throw new Error('Missing grade '+grade+' for '+row.block);
    return [c.enrolled, c.science, c.math];
  });
  const month = months.indexOf(row.month);
  if (month < 0 || !row.block.startsWith(row.district + ' - Block ')) {
    throw new Error('Unexpected source geography: '+row.block);
  }
  return [month, indices.get(row.block), Number(row.conducted) | (Number(row.evidence) << 1), ...grades];
});
const serialized = JSON.stringify({ months, blocks, rows });
writeFileSync(new URL('../docs/data/schools-lite.json', import.meta.url), serialized);
console.log('Compact school data: '+Buffer.byteLength(serialized)+' bytes; '+rows.length+' records.');
