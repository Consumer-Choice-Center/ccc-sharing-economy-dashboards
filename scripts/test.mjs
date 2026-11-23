import assert from 'node:assert/strict';
import fs from 'node:fs';
import {score,selectCities,customRanks,validState} from '../src/shared/model.js';
const d=JSON.parse(fs.readFileSync(new URL('../src/shared/assets/data.json',import.meta.url)));
const base=validState({},d);
assert.equal(d.cities.length,70);assert.equal(new Set(d.cities.map(c=>c.country)).size,52);
for(const c of d.cities){
  assert.equal(score(c,'official',base.weights,d.categories),c.index);
  assert.equal(c.scores.reduce((s,v)=>s+v,0),c.total);
  assert.ok(Math.abs(score(c,'custom',base.weights,d.categories)-c.total/170*100)<1e-10);
  assert.equal(score(c,'custom',Array(10).fill(0),d.categories),null);
  for(let i=0;i<10;i++){let w=Array(10).fill(0);w[i]=1;assert.ok(Math.abs(score(c,'custom',w,d.categories)-c.scores[i]/d.categories[i].max*100)<1e-10)}
  assert.equal(c.scores.length,10);assert.equal(c.coordinates.length,2);assert.ok(c.coordinates.every(Number.isFinite));
}
const official=selectCities(d,base);assert.equal(official[0].city,'Kyiv');assert.equal(official[0].index,39.97186747);
const europe=selectCities(d,{...base,region:'Europe'});assert.ok(europe.length>0&&europe.length<70);assert.ok(europe.every(c=>c.region==='Europe'&&c.value===c.index));
const us=selectCities(d,{...base,country:'USA'});assert.equal(us.length,10);
assert.equal(selectCities(d,{...base,search:'KyIv'})[0].city,'Kyiv');assert.equal(selectCities(d,{...base,search:'no such city'}).length,0);
const custom=selectCities(d,{...base,mode:'custom'});assert.notEqual(custom[0].id,official[0].id);
assert.equal(customRanks([{id:'a',value:10},{id:'b',value:10},{id:'c',value:9}]).get('c'),3);
assert.equal(customRanks([{id:'a',value:null}]).get('a'),null);
const parsed=validState({tab:'invalid',mode:'fake',weights:[-1,4,NaN,1,1,1,1,1,1,1]},d);assert.equal(parsed.tab,'map');assert.equal(parsed.mode,'official');assert.deepEqual(parsed.weights.slice(0,3),[0,3,1]);
const world=JSON.parse(fs.readFileSync(new URL('../src/shared/assets/world.geojson',import.meta.url)));assert.ok(world.features.length>150);
console.log('Passed: 70 city totals and index values; 700 category-only scenarios; zero-weight handling; region/country/search filters; global ties; state validation; world geometry.');

const {heatmapRows}=await import('../src/shared/model.js');
const heat=validState({tab:'heatmap',heatmapCategories:[0,3,3,99,-1,'2'],heatmapLimit:70,heatmapSort:'category:0',heatmapOrder:'asc'},d);
assert.equal(heat.tab,'heatmap');assert.deepEqual(heat.heatmapCategories,[0,3]);
const byRide=heatmapRows(official,heat);
assert.equal(byRide.length,70);assert.ok(byRide.every((c,i)=>i===0||c.scores[0]>=byRide[i-1].scores[0]));
assert.deepEqual(heatmapRows(official,{...heat,heatmapSort:'score',heatmapOrder:'desc',heatmapLimit:20}).map(c=>c.id),official.slice(0,20).map(c=>c.id));
assert.equal(heatmapRows(official,{...heat,heatmapSort:'city'})[0].city,'Amsterdam');
assert.deepEqual(validState({heatmapCategories:[]},d).heatmapCategories,[]);
assert.equal(validState({heatmapSort:'category:900',heatmapLimit:1},d).heatmapSort,'score');
assert.equal(validState({heatmapSort:'category:900',heatmapLimit:1},d).heatmapLimit,20);
const zeroCities=selectCities(d,{...base,mode:'custom',weights:Array(10).fill(0)});
assert.equal(heatmapRows(zeroCities,{...heat,heatmapSort:'score'})[0].city,'Amsterdam');
for(const c of byRide)assert.deepEqual(c.scores,d.cities.find(original=>original.id===c.id).scores);
console.log('Passed: heatmap state, category validation, score/category/name sorting, display limits, zero-weight scenarios, and original points preserved.');

const {comparisonCities,comparisonRows,rankingRows,movementRows,scoreBuckets}=await import('../src/shared/analysis-model.js');
const compared={...base,region:'Asia',compareOnlyDifferences:true};
assert.deepEqual(comparisonCities(d,compared).map(c=>c.city),['Kyiv','Nashville']);
assert.equal(comparisonRows(d,compared).length,4);
assert.ok(comparisonRows(d,compared).every(r=>r.gap>0));
assert.equal(comparisonCities(d,{...base,compare:['kyiv','nashville','tallinn']}).length,3);
const pinned=rankingRows(official,{...base,pinned:'tbilisi'});
assert.equal(pinned.length,11);assert.equal(pinned.at(-1).id,'tbilisi');
assert.equal(rankingRows(official,{...base,pinned:'kyiv'}).length,10);
const grouped=heatmapRows(official,{...base,heatmapGroup:'region'});
assert.deepEqual(grouped.map(c=>c.id).sort(),official.slice(0,20).map(c=>c.id).sort());
assert.ok(grouped.every((c,i)=>i===0||c.region.localeCompare(grouped[i-1].region)>=0));
const initial=movementRows(d,official,{...base,limit:70});
assert.equal(initial.length,70);
for(const c of initial){assert.equal(c.baseline,d.cities.find(original=>original.id===c.id).rank);assert.equal(c.change,c.baseline-c.adjusted)}
for(const [city,rank] of [['Kyiv',1],['Nashville',2],['Buenos Aires',4]])assert.equal(initial.find(c=>c.city===city).baseline,rank);
assert.ok(initial.some(c=>c.change!==0)); // Weighted raw points are a distinct method even at 1×.

const weighted={...base,weights:[3,0,0,0,0,0,0,0,0,0],limit:70};
const moved=movementRows(d,official,weighted);
assert.ok(moved.some(c=>c.change!==0));
for(const c of moved)assert.equal(c.baseline,d.cities.find(original=>original.id===c.id).rank);
const bestRide=Math.max(...d.cities.map(c=>c.scores[0]));
assert.ok(moved.filter(c=>c.scores[0]===bestRide).every(c=>c.adjusted===1));
assert.deepEqual(movementRows(d,us,weighted).map(c=>[c.id,c.adjusted]),moved.filter(c=>c.country==='USA').map(c=>[c.id,c.adjusted]));
assert.ok(movementRows(d,official,{...base,weights:Array(10).fill(0)}).every(c=>c.adjusted===null&&c.value===null&&c.change===null));
for(let i=0;i<10;i++)assert.equal(scoreBuckets(official,d.categories[i],i).reduce((n,b)=>n+b.cities.length,0),70);
const delivery=scoreBuckets(official,d.categories[4],4);
assert.equal(delivery.find(b=>b.value===0).cities.length,38);assert.equal(delivery.find(b=>b.value===100).cities.length,32);
assert.equal(validState({tab:'movement',heatmapGroup:'region',heatmapHighlight:true,compareCount:3},d).tab,'movement');
console.log('Passed: comparison selection persistence and gaps; pins; heatmap grouping; 700 distribution dots; baseline/adjusted global ranks, ties and zero weights.');

const {drawComparison,drawDistribution,drawLeaderboard,drawMovement}=await import('../src/shared/analysis-charts.js');
const {renderHeatmap}=await import('../src/shared/heatmap.js');
const context=new Proxy({measureText:t=>({width:String(t).length*7})},{get(target,key){return key in target?target[key]:(...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),`${String(key)} has non-finite coordinate`)}}});
for(const width of [760,1200]){
 const compareHits=drawComparison(context,{data:d,state:base,width});assert.equal(compareHits.length,20);
 assert.equal(drawDistribution(context,{data:d,cities:official,selected:base.selected,width}).length,700);
 assert.equal(drawLeaderboard(context,{cities:official,state:base,width,maximum:40,rank:c=>c.rank}).length,10);
 assert.equal(drawMovement(context,{data:d,cities:official,state:base,width}).length,20);
 assert.equal(renderHeatmap(context,{rows:grouped,categories:d.categories,indices:base.heatmapCategories,width:1200,selected:base.selected,group:'region',highlight:true}).length,220);
}
console.log('Passed: non-map chart rendering produces finite geometry and expected selectable marks.');

const legacy=validState({compare:['kyiv','nashville','tallinn'],compareCount:2},d);
assert.deepEqual(legacy.compare,['kyiv','nashville']);
assert.deepEqual(validState({compare:['kyiv','kyiv','invalid']},d).compare,['kyiv','nashville']);
const many=validState({compare:d.cities.map(c=>c.id)},d);
assert.equal(comparisonCities(d,many).length,70);
assert.equal(comparisonCities(d,validState(JSON.parse(JSON.stringify(many)),d)).length,70);
for(const count of [4,8,70]){
 const scenario={...base,compare:d.cities.slice(0,count).map(c=>c.id)};
 const marks=drawComparison(context,{data:d,state:scenario,width:760});
 assert.equal(marks.length,count*10);
 const {compareHeight}=await import('../src/shared/analysis-charts.js');
 const height=compareHeight(d,scenario);
 assert.ok(marks.every(mark=>mark.y>=0&&mark.y+mark.h<=height));
}
console.log('Passed: variable comparison selections, legacy embeds, duplicate prevention, saved selections, and 4/8/70-city chart layouts.');

const {mapHeightRatio}=await import('../src/shared/map-renderer.js');
assert.equal(mapHeightRatio(0,40),0);assert.equal(mapHeightRatio(40,40),1);
assert.equal(mapHeightRatio(20,40),.125);assert.equal(mapHeightRatio(20,0),0);
assert.ok(mapHeightRatio(39,40)-mapHeightRatio(38,40)>1/40);
for(let i=1;i<=40;i++)assert.ok(mapHeightRatio(i,40)>mapHeightRatio(i-1,40));
console.log('Passed: enhanced map height scale is monotone, zero-anchored and amplifies high-score differences.');

const {MIN_MAP_TILT,MAX_MAP_TILT,DEFAULT_MAP_TILT,clampMapTilt}=await import('../src/shared/map-camera.js');
assert.equal(clampMapTilt(0),MIN_MAP_TILT);
assert.equal(clampMapTilt(-Infinity),DEFAULT_MAP_TILT);
assert.equal(clampMapTilt(-100),MIN_MAP_TILT);
assert.equal(clampMapTilt(100),MAX_MAP_TILT);
assert.equal(clampMapTilt(DEFAULT_MAP_TILT),DEFAULT_MAP_TILT);
assert.equal(clampMapTilt(NaN),DEFAULT_MAP_TILT);
for(let i=-100;i<=100;i++){const t=clampMapTilt(i*Math.PI/180);assert.ok(t>=MIN_MAP_TILT&&t<=MAX_MAP_TILT)}
console.log('Passed: official I-Distance movement baselines and 35–65 degree map tilt bounds.');
