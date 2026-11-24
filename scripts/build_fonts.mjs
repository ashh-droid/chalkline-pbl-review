import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const dir = 'docs/fonts';
mkdirSync(dir,{recursive:true});
const fonts=[
 ['newsreader','newsreader-latin-wght-normal.woff2'],
 ['atkinson-hyperlegible-next','atkinson-hyperlegible-next-latin-wght-normal.woff2'],
 ['atkinson-hyperlegible-mono','atkinson-hyperlegible-mono-latin-wght-normal.woff2'],
];
for(const [family,file] of fonts){
 const source=join('node_modules','@fontsource-variable',family,'files',file);
 if(!existsSync(source))throw new Error('Missing font asset: '+source);
 copyFileSync(source,join(dir,file));
 const license = join('node_modules','@fontsource-variable',family,'LICENSE');
 if(!existsSync(license))throw new Error('Missing SIL OFL notice: '+license);
 copyFileSync(license,join(dir,'LICENSE-'+family+'.txt'));
 console.log('Bundled '+file);
}
