import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),out=new URL('site/',root);
const read=name=>readFile(new URL('src/'+name,root),'utf8');
const [template,scoring,mapTools,config]=await Promise.all(['dashboard.html','scoring.html','map-tools.html','dashboards.json'].map(read));
const dashboards=JSON.parse(config);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp(new URL('src/shared/',root),new URL('shared/',out),{recursive:true});
const custom='<p>Custom score = 100 × Σ(weight × category points) ÷ Σ(weight × category maximum). All weights start at 1×. Category maxima range from 10 to 40. This exploratory score does not recalculate I-Distance. Zero weights exclude categories; all-zero weights produce no score. Custom ranks are global, with ties sharing a rank.</p>';
for(const d of dashboards){
 const hasScoring=['map','ranking','movement'].includes(d.id);
 let controls=hasScoring?scoring:'';
 if(d.id==='movement')controls=controls.replace(/<label for="mode">[\s\S]*?<details id="weightDetails">/,'<details id="weightDetails" open>');
 if(d.id==='ranking')controls=controls.replace(/([\s\S]*?)(<details id="weightDetails"><summary>[\s\S]*?<\/summary>)/,'$2$1');
 const vars={TITLE:d.title,DESCRIPTION:d.description,DASHBOARD:d.id,CLASSES:d.id==='map'?'':'analysis-view'+(!hasScoring?' no-custom':''),SCORING:controls,MAP_TOOLS:d.id==='map'?mapTools:'',METHOD:(hasScoring?custom:'')+(d.id==='movement'?'<p>Ranking movement compares two scoring methods, not changes over time. The initial ranks come from the study’s final I-Distance ranking.</p>':'')+(d.id==='map'?'<p>Column height uses an enhanced cubic scale to reveal differences; exact values are available on hover. City coordinates are approximate. Unmarked locations have no study data. Map boundaries: <a href="https://www.naturalearthdata.com/about/terms-of-use/">Natural Earth</a>, public domain, for orientation.</p>':'')};
 await mkdir(new URL(d.path+'/',out),{recursive:true});
 await writeFile(new URL(d.path+'/index.html',out),template.replace(/\{\{(\w+)\}\}/g,(_,key)=>vars[key]));
}
await writeFile(new URL('index.html',out),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sharing Economy Index 2026 · CCC dashboards</title><link rel="stylesheet" href="shared/style.css"></head><body><header class="dashboard-header"><img src="shared/assets/logo.svg" alt="Consumer Choice Center" width="150"><span>RESEARCH / 2026</span></header><main class="directory"><p class="eyebrow">SHARING ECONOMY INDEX 2026</p><h1>Research dashboards</h1><div class="dashboard-directory">${dashboards.map(d=>`<a href="${d.path}/"><h2>${d.title}</h2><p>${d.description}</p></a>`).join('')}</div><p class="small">Consumer Choice Center · 70 cities · 10 categories</p></main></body></html>`);
console.log(`Built ${dashboards.length} standalone dashboards in ${fileURLToPath(out)}`);
