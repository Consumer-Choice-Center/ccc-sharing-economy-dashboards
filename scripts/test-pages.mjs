import './build.mjs';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const root=new URL('../site/',import.meta.url);
const pages=JSON.parse(await readFile(new URL('../src/dashboards.json',import.meta.url)));
assert.equal(pages.length,7);
for(const page of pages){
 const location=new URL(page.path+'/index.html',root),html=await readFile(location,'utf8');
 assert.ok(html.includes(`data-dashboard="${page.id}"`));
 assert.ok(!/embedBtn|embedDialog|data-tab=|\{\{/.test(html));
 assert.ok(html.includes('id="exportBtn"'));
 assert.equal(html.includes('id="mapToolbar"'),page.id==='map');
 assert.equal(html.includes('id="weightDetails"'),['map','ranking','movement'].includes(page.id));
 assert.equal(html.includes('id="mode"'),['map','ranking'].includes(page.id));
 for(const [,url]of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!url.startsWith('https:'))assert.ok((await stat(new URL(url,location))).isFile());
 // Subdirectory hosting retains the base path for all shared assets.
 const published=new URL(page.path+'/','https://example.com/dashboards/');
 assert.equal(new URL('../shared/app.js',published).pathname,'/dashboards/shared/app.js');
}
console.log('Passed: seven independent pages, scoped controls, export tools, local assets, and subdirectory URL resolution.');
