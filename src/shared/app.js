import {MIN_MAP_TILT,MAX_MAP_TILT,clampMapTilt} from './map-camera.js';
import {comparisonCities,comparisonRows,rankingRows,movementRows} from './analysis-model.js';
import {drawComparison,compareHeight,drawDistribution,distributionHeight,drawLeaderboard,rankingHeight,drawMovement,movementHeight} from './analysis-charts.js';
import {createChartTransition} from './transitions.js';
import {renderWorld} from "./map-renderer.js";
import {renderHeatmap, heatmapHeight, heatmapWidth, HEATMAP_TOP} from './heatmap.js';
import {score, selectCities, customRanks, validState, heatmapRows} from './model.js';

const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const dashboard=document.body.dataset.dashboard;
const hasScoring=['map','ranking','movement'].includes(dashboard);
function lockDashboard(){state.tab=dashboard;if(!hasScoring)state.mode='official';if(dashboard==='movement')state.mode='custom'}
const asset=name=>new URL('./assets/'+name,import.meta.url);
const colors={navy:'#22264E',orange:'#E95C1F',warm:'#FFF7EF',mist:'#E7ECF4',white:'#FFFFFF'};
const fmt=(n,d=2)=>n==null?'—':Number(n).toFixed(d), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let data,world,mapDetails,state,filtered=[],rankMap=new Map(),hits=[],chartW=800,chartH=510,hover=null,dragMode='rotate',logo=new Image(),mapArea='world',viewportReady=false;
const view={yaw:.10,tilt:50*Math.PI/180,zoom:1,panX:0,panY:0,height:90};
const canvas=$('chart');let ctx=canvas.getContext('2d');
const chartMotion=createChartTransition(canvas,$('chartWrap'));
let hasRendered=false;
const titles={map:['01 / OVERALL SCORES','Overall city scores'],ranking:['02 / CITY RANKINGS','City rankings'],categories:['03 / CATEGORY LENS','Category scores'],compare:['04 / CITY COMPARISON','City comparison'],heatmap:['05 / CITY × CATEGORY','City × category heatmap'],distribution:['06 / DISTRIBUTION','City score distributions'],movement:['07 / SCENARIOS','Ranking movement']};
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',3500)}
function scoreName(){if(state.tab==='movement')return 'Custom score / 100';return state.mode==='official'?'CCC I-Distance score':'Custom score / 100'}
function contextText(){return [state.region||'All regions',state.country||'All countries',state.search?`Search: ${state.search}`:null,`${filtered.length} of 70 cities`].filter(Boolean).join(' · ')}
function activeRank(c){if(state.tab==='movement')return customRanks(data.cities.map(c=>({...c,value:score(c,'custom',state.weights,data.categories)}))).get(c.id);return state.mode==='official'?c.rank:rankMap.get(c.id)}
function options(list,value){return list.map(([v,label])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(label)}</option>`).join('')}
function fillCountries(){const countries=[...new Set(data.cities.filter(c=>!state.region||c.region===state.region).map(c=>c.country))].sort();if(!countries.includes(state.country))state.country='';$('country').innerHTML=options([['','All countries'],...countries.map(c=>[c,c])],state.country)}
function syncInputs(){
  for(const k of ['region','mode','search'])if($(k))$(k).value=state[k];fillCountries();
  if(hasScoring)data.categories.forEach((c,i)=>{$(`weight${i}`).value=state.weights[i];$(`weightOutput${i}`).textContent=`${state.weights[i]}×`});
  if($('scoreHelp'))$('scoreHelp').textContent=state.mode==='official'?'Official I-Distance scores. Study ranks remain global.':'Weighted category points, normalized to 100. Separate from the official I-Distance index.';
}
function analysisSetup(){
  $('heatmapLegend').hidden=state.tab!=='heatmap';
  $('heatmapLegend').innerHTML=state.heatmapHighlight?'Full scores muted · orange = below maximum':'<span>0%</span><i></i><span>100%</span>';
}
function allScored(){return data.cities.map(c=>({...c,value:score(c,state.mode,state.weights,data.categories)}))}
function detailCities(){return state.tab==='compare'?comparisonCities(data,state):state.tab==='movement'?filtered.map(c=>({...c,value:score(c,'custom',state.weights,data.categories)})):filtered}
function selectedComparisonNotice(){const outside=comparisonCities(data,state).filter(c=>!filtered.some(f=>f.id===c.id));return outside.length?`Kept outside filters: ${outside.map(c=>c.city).join(', ')}.`:''}
function selectOptions(){return [...data.cities].sort((a,b)=>a.city.localeCompare(b.city)).map(c=>[c.id,c.city])}
function update(){
  lockDashboard();
  const previous=hasRendered&&state.tab!=='map'?chartMotion.capture():null;
  chartMotion.finish();$('tooltip').hidden=true;
  document.body.classList.toggle('heatmap-layout',state.tab==='heatmap');
  filtered=selectCities(data,state);rankMap=customRanks(selectCities(data,{...state,region:'',country:'',search:''}));
  if(state.tab!=='compare'&&!filtered.some(c=>c.id===state.selected))state.selected=filtered[0]?.id||'';
  const chosen=new Set();state.compare=state.compare.map(id=>{let c=data.cities.find(c=>c.id===id&&!chosen.has(id))||data.cities.find(c=>!chosen.has(c.id));if(c)chosen.add(c.id);return c?.id||''});
  if(state.heatmapSort.startsWith('category:')&&!state.heatmapCategories.includes(Number(state.heatmapSort.split(':')[1])))state.heatmapSort='score';
  syncInputs();analysisSetup();$$('.tabs button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===state.tab)));
  $('filterCount').textContent=`${filtered.length} of 70 cities in view`;
  $('viewKicker').textContent='SHARING ECONOMY INDEX / 2026';$('viewTitle').textContent=titles[state.tab][1];
  const descriptions={map:`Enhanced height scale makes score differences more visible. Exact scores on hover.`,ranking:`${scoreName()}. ${state.mode==='official'?'Study ranks remain global.':'Custom ranks are calculated across all 70 cities; ties share a rank.'}`,categories:'Category score (% of maximum).',compare:'Category score (% of maximum). Gaps are percentage points.',heatmap:'Category score (% of maximum).',distribution:'One dot per city. Equal scores are stacked.',movement:'Official I-Distance ranks vs custom-score ranks. Different scoring methods, not change over time.'};
  $('viewDescription').textContent=descriptions[state.tab];canvas.setAttribute('aria-label',state.tab==='map'?'Interactive world map of city scores. Left-drag to rotate; right-drag or Shift-drag to pan. Use arrow keys to pan, plus and minus to zoom, and Q or E to rotate. Accessible city details and data table below.':`${titles[state.tab][1]} ${descriptions[state.tab]} Exact values are available in the data table below.`);
  $('chartHint').textContent=state.tab==='map'?(dragMode==='rotate'?'Left-drag to rotate · Right-drag or Shift-drag to pan · Scroll to zoom':'Drag to pan · Select Rotate for rotation · Scroll to zoom'):'Select a value for details · Arrow keys to browse · Enter to select';
  renderControls();renderDetail();renderTable();resize();
  chartMotion.play(previous);
  if(hasRendered){
    for(const el of [...$$('#stats .stat-value'),...$$('#detail .mini-grid'),$('viewDescription')]){
      el.getAnimations().forEach(a=>a.cancel());
      if(state.tab!=='map'&&!chartMotion.reduced)el.animate([{opacity:.35},{opacity:1}],{duration:300,easing:'ease-out'});
    }
  }
  hasRendered=true;
}
function renderControls(){
  let html='';
  if(state.tab==='map')html=`<label>Map area <select id="mapArea">${options([['world','World'],['europe','Europe'],['americas','North America'],['east-coast','US East Coast'],['asia','Asia Pacific']],mapArea)}</select></label><div class="legend"><span><i style="background:#E95C1F"></i>${esc(scoreName())}</span><span>0–${state.mode==='official'?fmt(Math.max(...data.cities.map(c=>c.index)),1):100}</span></div>`;
  if(state.tab==='ranking')html=`<label>Display <select id="rankLimit">${options([[10,'Top 10 cities'],[20,'Top 20 cities'],[70,'All cities']],state.limit)}</select></label><label>Pin city <select id="pinCity">${options([['','None'],...filtered.map(c=>[c.id,c.city]).sort((a,b)=>a[1].localeCompare(b[1]))],state.pinned)}</select></label><span class="small">${filtered.length} cities</span>`;
  if(state.tab==='categories')html=`<label>Explore <select id="categorySelect">${options([[-1,'Category averages'],...data.categories.map(c=>[c.id,c.name])],state.category)}</select></label>${state.category>=0?`<label>Display <select id="rankLimit">${options([[10,'Top 10 cities'],[20,'Top 20 cities'],[70,'All cities']],state.limit)}</select></label>`:''}`;
  if(state.tab==='compare'){
    const candidates=allScored().filter(c=>filtered.some(f=>f.id===c.id)||state.compare.includes(c.id)).sort((a,b)=>a.city.localeCompare(b.city));
    const canAdd=filtered.some(c=>!state.compare.includes(c.id));
    html=state.compare.map((id,i)=>`<div class="compare-city"><label>City ${i+1} <select class="compare-select" data-slot="${i}">${options(candidates.filter(c=>c.id===id||!state.compare.includes(c.id)).map(c=>[c.id,c.city]),id)}</select></label>${state.compare.length>2?`<button class="remove-city" data-remove-city="${i}" aria-label="Remove ${esc(data.cities.find(c=>c.id===id).city)}" title="Remove city">×</button>`:''}</div>`).join('')+`<button id="addCity" class="add-city" ${canAdd?'':'disabled'}>+ Add city</button><label>Sort <select id="compareSort">${options([['gap','Largest gaps'],['category','Category order']],state.compareSort)}</select></label><label class="inline-check"><input type="checkbox" id="compareOnlyDifferences" ${state.compareOnlyDifferences?'checked':''}>Only differences</label>${!canAdd?'<span class="small">All matching cities added.</span>':''}${selectedComparisonNotice()?`<span class="selection-notice">${esc(selectedComparisonNotice())}</span>`:''}`;
  }
  if(state.tab==='distribution')html=`<label>Highlight city <select id="distributionCity">${options(detailCities().map(c=>[c.id,c.city]).sort((a,b)=>a[1].localeCompare(b[1])),state.selected)}</select></label><span class="small">${filtered.length} cities · 10 categories</span>`;
  if(state.tab==='movement')html=`<label>Show <select id="rankLimit">${options([[10,'10 cities'],[20,'20 cities'],[70,'All cities']],state.limit)}</select></label><label>Sort <select id="movementSort">${options([['change','Largest rank changes'],['score','Highest adjusted scores']],state.movementSort)}</select></label><span class="small">${state.weights.every(w=>w===1)?'Custom weights: all 1×':`Custom scenario · ${state.weights.filter(w=>w!==1).length} weights changed`}</span>`;
  const categoryPickerOpen=$('heatmapCategoryPicker')?.open;
  if(state.tab==='heatmap')html=`<label>Sort by <select id="heatmapSort">${options([['score','Overall score'],['city','City A–Z'],['country','Country A–Z'],...state.heatmapCategories.map(i=>['category:'+i,data.categories[i].name])],state.heatmapSort)}</select></label><label>Order <select id="heatmapOrder" ${['city','country'].includes(state.heatmapSort)?'disabled':''}>${options([['desc','Highest first'],['asc','Lowest first']],state.heatmapOrder)}</select></label><label>Display <select id="heatmapLimit">${options([[20,'20 cities'],[40,'40 cities'],[70,'All cities']],state.heatmapLimit)}</select></label><details id="heatmapCategoryPicker" class="heatmap-picker" ${categoryPickerOpen?'open':''}><summary>Categories (${state.heatmapCategories.length} / ${data.categories.length})</summary><div class="heatmap-choices">${data.categories.map((cat,i)=>`<label><input type="checkbox" data-heatmap-category="${i}" ${state.heatmapCategories.includes(i)?'checked':''}>${esc(cat.name)}</label>`).join('')}<button id="heatmapAll" class="text-button">Select all categories</button></div></details><label>Group <select id="heatmapGroup">${options([['none','None'],['region','Region']],state.heatmapGroup)}</select></label><label class="inline-check"><input id="heatmapHighlight" type="checkbox" ${state.heatmapHighlight?'checked':''}>Highlight differences</label><span class="small heatmap-count">${Math.min(filtered.length,state.heatmapLimit)} of ${filtered.length} cities</span>`;
  $('viewControls').innerHTML=html;
  for(const key of ['heatmapSort','heatmapOrder','heatmapLimit','heatmapGroup','movementSort','compareSort'])if($(key))$(key).onchange=e=>{state[key]=key==='heatmapLimit'?Number(e.target.value):e.target.value;update()};
  $$('[data-heatmap-category]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.heatmapCategory);state.heatmapCategories=el.checked?[...state.heatmapCategories,i].sort((a,b)=>a-b):state.heatmapCategories.filter(n=>n!==i);update()});
  if($('heatmapAll'))$('heatmapAll').onclick=()=>{state.heatmapCategories=data.categories.map((_,i)=>i);update()};
  for(const key of ['heatmapHighlight','compareOnlyDifferences'])if($(key))$(key).onchange=e=>{state[key]=e.target.checked;update()};
  if($('pinCity'))$('pinCity').onchange=e=>{state.pinned=e.target.value;update()};
  if($('distributionCity'))$('distributionCity').onchange=e=>{state.selected=e.target.value;update()};
  if($('mapArea'))$('mapArea').onchange=e=>focusMap(e.target.value);
  if($('rankLimit'))$('rankLimit').onchange=e=>{state.limit=Number(e.target.value);update()};
  if($('categorySelect'))$('categorySelect').onchange=e=>{state.category=Number(e.target.value);update()};
  if($('addCity'))$('addCity').onclick=()=>{const next=filtered.find(c=>!state.compare.includes(c.id));if(!next)return;state.compare.push(next.id);update();$$('.compare-select').at(-1)?.focus()};
  $$('[data-remove-city]').forEach(b=>b.onclick=()=>{if(state.compare.length<=2)return;const slot=Number(b.dataset.removeCity),[removed]=state.compare.splice(slot,1);if(state.selected===removed)state.selected=state.compare[0];update();$$('.compare-select')[Math.min(slot,state.compare.length-1)]?.focus()});
  $$('.compare-select').forEach(s=>s.onchange=e=>{state.compare[Number(s.dataset.slot)]=s.value;update()});
}
function renderDetail(){
  const c=detailCities().find(c=>c.id===state.selected)||detailCities()[0];
  if(!c){$('detail').innerHTML='<p>No matching cities. Clear a filter to explore the research.</p>';return}
  const rank=activeRank(c);
  $('detail').innerHTML=`<div class="detail-top"><div><p class="eyebrow">CITY DETAILS</p><h3>${esc(c.city)}</h3><p>${esc(c.country)} · ${rank?'Global '+(state.mode==='custom'||state.tab==='movement'?'custom ':'')+'rank #'+rank:'No score'} · Raw total ${c.total} / 170</p></div><div class="detail-score">${fmt(c.value)}<p>${esc(scoreName())}</p></div><label class="small">${state.tab==='map'?'Explore a city':'City'}<br><select id="citySelect">${options(detailCities().map(c=>[c.id,c.city]).sort((a,b)=>a[1].localeCompare(b[1])),c.id)}</select></label></div><div class="mini-grid">${data.categories.map((cat,i)=>`<div><span class="mini-label">${esc(cat.name)}</span><div class="mini-bar"><i style="width:${c.scores[i]/cat.max*100}%"></i></div><span class="mini-value">${c.scores[i]} / ${cat.max}</span></div>`).join('')}</div><details><summary>${state.tab==='map'?'Read the city’s research notes and sources':'Sources and notes'}</summary><div class="notes">${data.categories.map((cat,i)=>`<div class="note"><h4>${esc(cat.name)}</h4><p>${esc(c.notes[i])}</p>${c.sources[i].map((s,j)=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">Workbook source ${j+1} ↗</a>`).join('')}</div>`).join('')}</div><p class="small">Source: ${esc(data.source)} · Research row ${c.sourceRow}. Notes describe the workbook’s research, not independently updated policy advice.</p></details>`;
  $('citySelect').onchange=e=>{state.selected=e.target.value;if(state.tab==='map'){renderDetail();draw()}else update()};
}
function renderTable(){
  const tableCities=state.tab==='heatmap'?heatmapRows(filtered,state):state.tab==='compare'?comparisonCities(data,state):state.tab==='ranking'?rankingRows(filtered,state):state.tab==='movement'?movementRows(data,filtered,state):state.tab==='categories'&&state.category>=0?[...filtered].sort((a,b)=>b.scores[state.category]-a.scores[state.category]||a.city.localeCompare(b.city)).slice(0,state.limit):filtered;
  const tableCategories=state.tab==='heatmap'?state.heatmapCategories:data.categories.map((_,i)=>i);
  $('tableCount').textContent=`${tableCities.length} cities`;
  if(state.tab==='movement'){
    $('tableHead').innerHTML='<tr><th>City</th><th>Country</th><th>Official I-Distance rank</th><th>Custom rank</th><th>Rank change</th><th>Custom score / 100</th></tr>';
    $('tableBody').innerHTML=tableCities.map(c=>`<tr><td>${esc(c.city)}</td><td>${esc(c.country)}</td><td>${c.baseline}</td><td>${c.adjusted??'—'}</td><td>${c.change==null?'—':c.change>0?'Up '+c.change:c.change<0?'Down '+(-c.change):'0'}</td><td>${fmt(c.value)}</td></tr>`).join('');return;
  }
  $('tableHead').innerHTML=`<tr><th>City</th><th>Country</th><th>Global ${state.mode==='custom'?'custom ':''}rank</th><th>${esc(scoreName())}</th>${tableCategories.map(i=>`<th>${esc(data.categories[i].name)} / ${data.categories[i].max}</th>`).join('')}</tr>`;
  $('tableBody').innerHTML=tableCities.map(c=>`<tr><td><button data-city="${c.id}">${esc(c.city)}</button></td><td>${esc(c.country)}</td><td>${activeRank(c)??'—'}</td><td>${fmt(c.value)}</td>${tableCategories.map(i=>`<td>${c.scores[i]}</td>`).join('')}</tr>`).join('');
  $$('[data-city]').forEach(b=>b.onclick=()=>{state.selected=b.dataset.city;renderDetail();draw();$('cityDetails').open=true;$('detail').scrollIntoView({behavior:'smooth',block:'nearest'})});
}
function resize(){
  const oldW=chartW,oldH=chartH;
  $('chartWrap').classList.toggle('heatmap-scroll',state.tab==='heatmap');
  chartW=state.tab==='heatmap'?Math.max(heatmapWidth(state.heatmapCategories.length),$('chartWrap').clientWidth):$('chartWrap').clientWidth;
  canvas.style.width=state.tab==='heatmap'?chartW+'px':'100%';
  const overflow=state.tab==='heatmap'&&chartW>$('chartWrap').clientWidth;
  $('heatmapScrollTools').hidden=!overflow;
  $('heatmapScrollTrack').style.width=chartW+'px';
  if(['compare','distribution','movement','ranking'].includes(state.tab)){chartW=Math.max(760,$('chartWrap').clientWidth);canvas.style.width=chartW+'px'}
  $('chartWrap').classList.toggle('analysis-scroll',['compare','distribution','movement','ranking'].includes(state.tab));
  const mobile=chartW<500;
  chartH=state.tab==='ranking'||(state.tab==='categories'&&state.category>=0)?Math.max(420,Math.min(state.limit,filtered.length)*40+115):state.tab==='compare'?650:state.tab==='categories'?510:mobile?430:510;
  if(state.tab==='heatmap')chartH=Math.max(300,heatmapHeight(heatmapRows(filtered,state),state.heatmapGroup));
  if(state.tab==='compare')chartH=compareHeight(data,state);
  if(state.tab==='ranking')chartH=rankingHeight(filtered,state);
  if(state.tab==='distribution')chartH=distributionHeight(data.categories);
  if(state.tab==='movement')chartH=movementHeight(data,filtered,state);
  if(state.tab==='map'&&window.innerWidth>=1600)chartH=590;
  if(viewportReady&&chartW!==oldW){const ratio=chartW/oldW;view.panX*=ratio;view.panY=(view.panY+.09*oldH)*ratio-.09*chartH}viewportReady=true;
  const dpr=Math.max(2,Math.min(window.devicePixelRatio||1,3));canvas.width=Math.round(chartW*dpr);canvas.height=Math.round(chartH*dpr);canvas.style.height=chartH+'px';ctx.setTransform(dpr,0,0,dpr,0,0);draw();
}
function text(t,x,y,size=11,color=colors.navy,weight=400,align='left',font='Montserrat'){ctx.fillStyle=color;ctx.font=`${weight} ${size}px "${font}"`;ctx.textAlign=align;ctx.fillText(t,x,y)}
function line(x1,y1,x2,y2,color='rgba(34,38,78,.14)',width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function polygon(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.6;ctx.stroke()}}
function draw(){
  chartMotion.finish();
  if(!data)return;
  if(ctx.canvas===canvas)for(const id of ['heatmapRowLabels','heatmapColumnLabels','heatmapCorner'])$(id).hidden=true;
  hits=[];ctx.clearRect(0,0,chartW,chartH);ctx.fillStyle=colors.white;ctx.fillRect(0,0,chartW,chartH);
  const noScore=state.mode==='custom'&&state.weights.every(w=>w===0)&&['map','ranking'].includes(state.tab);
  const noCategories=state.tab==='heatmap'&&!state.heatmapCategories.length;
  const hasCities=state.tab==='compare'?comparisonCities(data,state).length>0:filtered.length>0;
  $('chartEmpty').hidden=hasCities&&!noScore&&!noCategories;
  $('chartEmpty').textContent=noCategories?'Choose at least one category to display the heatmap.':noScore?'All category weights are zero. Increase at least one weight to calculate a score.':'No cities match these filters. Try another region or clear your search.';
  if(!hasCities||noScore||noCategories)return;
  if(state.tab==='map')drawMap();else if(state.tab==='ranking')drawRanking();else if(state.tab==='categories')drawCategories();else if(state.tab==='heatmap')hits=renderHeatmap(ctx,{rows:heatmapRows(filtered,state),categories:data.categories,indices:state.heatmapCategories,width:chartW,selected:state.selected,group:state.heatmapGroup,highlight:state.heatmapHighlight});else if(state.tab==='distribution')hits=drawDistribution(ctx,{data,cities:filtered,selected:state.selected,width:chartW});else if(state.tab==='movement')hits=drawMovement(ctx,{data,cities:filtered,state,width:chartW});else drawCompare();
  if(state.tab==='heatmap'&&ctx.canvas===canvas)freezeHeatmapLabels();
}
function freezeHeatmapLabels(){
  const dpr=canvas.width/chartW;
  for(const [id,x,y,w,h]of [['heatmapRowLabels',0,0,180,chartH],['heatmapColumnLabels',0,0,chartW,HEATMAP_TOP],['heatmapCorner',0,0,180,HEATMAP_TOP]]){
    const layer=$(id);layer.width=Math.round(w*dpr);layer.height=Math.round(h*dpr);layer.style.width=w+'px';layer.style.height=h+'px';
    layer.getContext('2d').drawImage(canvas,x*dpr,y*dpr,w*dpr,h*dpr,0,0,layer.width,layer.height);layer.hidden=false;
  }
  positionHeatmapLabels();
}
function positionHeatmapLabels(){
  const {scrollLeft:x,scrollTop:y}=$('chartWrap');
  $('heatmapRowLabels').style.transform=`translateX(${x}px)`;
  $('heatmapColumnLabels').style.transform=`translateY(${y}px)`;
  $('heatmapCorner').style.transform=`translate(${x}px,${y}px)`;
}
function project(lon,lat,z=0){
  const scale=chartW/405*view.zoom,x=lon,y=-lat,co=Math.cos(view.yaw),si=Math.sin(view.yaw),rx=x*co-y*si,ry=x*si+y*co;
  // One camera pitch projects both the ground plane and its vertical columns.
  return [chartW/2+view.panX+rx*scale,chartH*.59+view.panY+ry*scale*Math.cos(view.tilt)-z*Math.sin(view.tilt)];
}
function drawMap(){
  hits=renderWorld(ctx,{world,details:mapDetails,cities:filtered,selected:state.selected,width:chartW,height:chartH,view,project,maximum:state.mode==="official"?Math.max(...data.cities.map(c=>c.index)):100,scoreLabel:scoreName(),rank:activeRank});
}
function barChart(rows,maximum,axisLabel){
  const left=chartW<500?125:185,right=65,top=46,step=40,bottom=top+rows.length*step;
  for(let i=0;i<=4;i++){const x=left+(chartW-left-right)*i/4;line(x,top-12,x,bottom,'rgba(34,38,78,.09)');text(fmt(maximum*i/4,maximum===100?0:1),x,top-21,9,colors.navy,400,'center','DM Mono')}
  rows.forEach((r,i)=>{const y=top+i*step;const label=r.label;ctx.font='500 12px Montserrat';let short=label;while(ctx.measureText(short).width>left-25)short=short.slice(0,-2)+'…';text(short,left-14,y+17,12,colors.navy,500,'right');const w=r.value/maximum*(chartW-left-right);ctx.fillStyle=colors.mist;ctx.fillRect(left,y,chartW-left-right,23);ctx.fillStyle=r.city?.id===state.selected?colors.navy:colors.orange;ctx.fillRect(left,y,Math.max(0,w),23);text(fmt(r.value,r.decimals??1),Math.min(left+w+8,chartW-42),y+16,12,colors.navy,500);hits.push({x:0,y:y-3,w:chartW,h:32,...r})});
  text(axisLabel,left,bottom+25,9,colors.navy,400,'left','DM Mono');
}
function drawRanking(){hits=drawLeaderboard(ctx,{cities:filtered,state,width:chartW,maximum:state.mode==='official'?40:100,rank:activeRank})}
function drawCategories(){
  if(state.category>=0){const i=state.category,cat=data.categories[i],rows=[...filtered].sort((a,b)=>b.scores[i]-a.scores[i]||a.city.localeCompare(b.city)).slice(0,state.limit).map(c=>({label:c.city,value:c.scores[i]/cat.max*100,city:c,tip:`${c.city}: ${c.scores[i]} / ${cat.max} points (${fmt(c.scores[i]/cat.max*100,1)}%)`}));barChart(rows,100,`${cat.name} · % of maximum`);return}
  const rows=data.categories.map((cat,i)=>{const avg=filtered.reduce((s,c)=>s+c.scores[i],0)/filtered.length;return{label:cat.name,value:avg/cat.max*100,category:i,tip:`${cat.name}: ${fmt(avg)} / ${cat.max} mean points · ${filtered.length} cities`}}).sort((a,b)=>b.value-a.value);barChart(rows,100,'Mean category points / maximum (%)');
}
function drawCompare(){hits=drawComparison(ctx,{data,state,width:chartW})}
function pick(x,y){if(chartMotion.active)return null;if(state.tab==='heatmap'&&y-$('chartWrap').scrollTop<HEATMAP_TOP)return null;if(state.tab==='heatmap'&&x-$('chartWrap').scrollLeft<180)x-=$('chartWrap').scrollLeft;return [...hits].reverse().find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)}
function showTip(hit,x,y){if(state.tab!=='map'){const wrap=$('chartWrap');x=Math.max(wrap.scrollLeft,Math.min(x,wrap.scrollLeft+wrap.clientWidth-247));y=Math.max(wrap.scrollTop+(state.tab==='heatmap'?HEATMAP_TOP:0)+48,y)}hover=hit;canvas.style.cursor=hit?'pointer':state.tab==='map'?'grab':'default';$('tooltip').hidden=!hit;if(hit){$('tooltip').textContent=hit.tip;$('tooltip').style.left=Math.min(x+12,chartW-235)+'px';$('tooltip').style.top=Math.max(0,y-48)+'px'}}
const pointers=new Map();let drag=null,pinch=null;
canvas.onpointerdown=e=>{if(state.tab!=='map'||(e.pointerType==='mouse'&&![0,2].includes(e.button)))return;canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button,moved:false};if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:view.zoom}}};
canvas.onpointermove=e=>{const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;if(drag&&state.tab==='map'){
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)drag.moved=true;
  if(pointers.size===2&&pinch){const[a,b]=[...pointers.values()];view.zoom=Math.min(32,Math.max(.6,pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance));drag.moved=true}
  else if(dragMode==='rotate'&&drag.button!==2&&!e.shiftKey){view.yaw+=dx*.005;view.tilt=clampMapTilt(view.tilt+dy*.004);$('tilt').value=view.tilt*180/Math.PI}else{view.panX+=dx;view.panY+=dy}
  drag.x=e.clientX;drag.y=e.clientY;$('tooltip').hidden=true;draw();return}showTip(pick(x,y),x,y)};
canvas.onpointerup=e=>{if(state.tab!=='map')return;const moved=drag?.moved;const rect=canvas.getBoundingClientRect();pointers.delete(e.pointerId);if(pointers.size===0){drag=null;pinch=null}else{const p=[...pointers.values()][0];drag={...p,startX:p.x,startY:p.y,moved:true};pinch=null}if(!moved&&e.button!==2)activate(pick(e.clientX-rect.left,e.clientY-rect.top))};
canvas.oncontextmenu=e=>{if(state.tab==='map')e.preventDefault()};
canvas.onpointercancel=()=>{pointers.clear();drag=null;pinch=null};canvas.onpointerleave=()=>{$('tooltip').hidden=true};
canvas.onclick=e=>{if(state.tab!=='map'){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,hit=pick(x,y);activate(hit);showTip(hit,x,y)}};
function activate(hit){if(!hit)return;if(hit.category!=null){state.category=hit.category;update()}else if(hit.city){$('cityDetails').open=true;state.selected=hit.city.id;if(state.tab==='map'){renderDetail();draw()}else update()}}
canvas.addEventListener('wheel',e=>{if(state.tab!=='map')return;e.preventDefault();view.zoom=Math.min(32,Math.max(.6,view.zoom*Math.exp(-e.deltaY*.001)));draw()},{passive:false});
let keyboardHit=-1;
canvas.onkeydown=e=>{if(state.tab!=='map'){if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();keyboardHit=Math.max(0,Math.min(hits.length-1,keyboardHit+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)));const h=hits[keyboardHit];if(h){$('chartWrap').scrollTop=Math.max(0,h.y-HEATMAP_TOP-10);$('chartWrap').scrollLeft=Math.max(0,h.x-180);showTip(h,h.x,h.y)}}else if(e.key==='Enter'){e.preventDefault();activate(hits[keyboardHit])}else if(e.key==='Escape')$('tooltip').hidden=true;return;}const actions={ArrowLeft:()=>view.panX-=30,ArrowRight:()=>view.panX+=30,ArrowUp:()=>view.panY-=30,ArrowDown:()=>view.panY+=30,'+':()=>view.zoom=Math.min(32,view.zoom*1.2),'=':()=>view.zoom=Math.min(32,view.zoom*1.2),'-':()=>view.zoom=Math.max(.6,view.zoom/1.2),q:()=>view.yaw-=.12,e:()=>view.yaw+=.12};if(actions[e.key]){e.preventDefault();actions[e.key]();draw()}};
function resetMap(redraw=true){mapArea='world';Object.assign(view,{yaw:.10,tilt:50*Math.PI/180,zoom:1,panX:0,panY:0,height:90});$('tilt').value=50;$('height').value=90;if($('mapArea'))$('mapArea').value='world';if(redraw)draw()}
function focusMap(area){
  mapArea=area;
  if(area==='world'){resetMap();return}
  const preset={europe:[15,49,5.2,.15],americas:[-98,39,2.6,-.18],'east-coast':[-76,40,18,-.26],asia:[120,27,2.5,.08]}[area];
  if(!preset)return;
  Object.assign(view,{zoom:preset[2],yaw:preset[3],tilt:50*Math.PI/180,panX:0,panY:0});
  const p=project(preset[0],preset[1]);view.panX=chartW*.5-p[0];view.panY=chartH*.66-p[1];$('tilt').value=50;draw();
}
function exportLines(c,text,x,y,maxWidth,lineHeight){let line='';for(const word of text.split(' ')){if(c.measureText(line+word+' ').width>maxWidth&&line){c.fillText(line.trim(),x,y);y+=lineHeight;line=''}line+=word+' '}if(line)c.fillText(line.trim(),x,y);return y+lineHeight}
async function exportPNG(){
  if(state.tab==='heatmap'&&!state.heatmapCategories.length){toast('Choose at least one category before exporting.');return}
  if(!filtered.length&&state.tab!=='compare'){toast('Choose at least one city before exporting.');return}
  if((state.mode==='custom'&&['map','ranking'].includes(state.tab)||state.tab==='movement')&&state.weights.every(w=>w===0)){toast('Increase at least one category weight before exporting.');return}
  const button=$('exportBtn');button.disabled=true;button.textContent='Preparing…';
  try{
    await document.fonts.ready;draw();
    const w=Math.max(1200,Math.round(chartW)),s=w/chartW,chartHeight=chartH*s,margin=48;
    const notes=[`${contextText()} · ${state.tab==='movement'?'Custom scenario / 100':scoreName()}`];
    if(state.tab==='ranking')notes.push(`Displaying ${rankingRows(filtered,state).length} cities${state.pinned?' · includes pinned city':''}. Global ranks refer to all 70 study cities.`);
    if(state.tab==='categories')notes.push(state.category<0?'Category averages: mean raw points divided by category maximum.':`${data.categories[state.category].name}: raw points divided by category maximum. Displaying top ${Math.min(state.limit,filtered.length)} cities.`);
    if(state.tab==='heatmap')notes.push(`Heatmap: ${Math.min(filtered.length,state.heatmapLimit)} of ${filtered.length} matching cities. Cells = raw category points / category maximum (%).`, `Categories: ${state.heatmapCategories.map(i=>data.categories[i].name).join(' · ')}.`, `Sort: ${state.heatmapSort.startsWith('category:')?data.categories[Number(state.heatmapSort.split(':')[1])].name:state.heatmapSort==='score'?'Overall score':state.heatmapSort==='city'?'City A–Z':'Country A–Z'}${['city','country'].includes(state.heatmapSort)?'':state.heatmapOrder==='asc'?' · lowest first':' · highest first'}. Category colours do not change with scoring weights. Group: ${state.heatmapGroup}. ${state.heatmapHighlight?'Full-score cells are muted; orange identifies scores below maximum.':'Colour scale: pale orange 0% to dark orange 100%.'}`);
    if(state.tab==='compare')notes.push(`Cities: ${comparisonCities(data,state).map(c=>c.city).join(', ')}. Geography filters do not remove selected cities.`, `Category score / maximum (%). Gaps in percentage points. ${state.compareOnlyDifferences?'Only differences shown.':'All categories shown.'}`);
    if(state.tab==='distribution')notes.push('One dot per city. Equal category scores are stacked; dot offsets do not encode additional measurements.');
    if(state.tab==='movement')notes.push('Official I-Distance ranks from the study vs custom-score ranks under current weights. These are different scoring methods, not change over time. The custom method does not recalculate I-Distance, even when all weights are 1×. Ranks refer to all 70 cities; custom ties share a rank. Lines connect the same city; displayed rows are evenly spaced.');
    if(state.mode==='custom'||state.tab==='movement')notes.push('CUSTOM SCENARIO — not the official I-Distance ranking. Score = 100 × Σ(weight × points) / Σ(weight × category maximum).',data.categories.map((cat,i)=>`${cat.name} ${state.weights[i]}×`).join(' · '));
    notes.push('Source: Sharing Economy Index 2026.xlsx · Research and RankingsFinal.');
    if(state.tab==='map')notes.push('Enhanced height scale: height is proportional to (score / scale maximum)³, with zero anchored at zero. Exact scores and ranks are unchanged. Cluster width follows the original score.', 'One cluster represents one city score. Higher scores add surrounding columns; these are illustrative, not neighbourhood measurements.','Map: Natural Earth. Approximate city centres. Unmarked places have no study data.');
    const measure=document.createElement('canvas').getContext('2d');measure.font='400 15px Montserrat';let lines=0;for(const n of notes)lines+=(exportLines(measure,n,0,0,w-2*margin,22)/22);
    const out=document.createElement('canvas');out.width=w*2;out.height=Math.ceil(185+chartHeight+lines*22+110)*2;const c=out.getContext('2d');c.scale(2,2);c.fillStyle=colors.white;c.fillRect(0,0,w,out.height/2);c.fillStyle=colors.orange;c.fillRect(0,0,w,7);
    if(logo.complete&&logo.naturalWidth)c.drawImage(logo,margin,28,140,140*logo.naturalHeight/logo.naturalWidth);
    c.fillStyle=colors.navy;c.font='400 12px "DM Mono"';c.textAlign='right';c.fillText('CCC RESEARCH / 2026',w-margin,58);c.textAlign='left';c.font='700 29px Montserrat';c.fillText('Sharing Economy Index 2026',margin,117);c.font='400 17px Montserrat';c.fillText(titles[state.tab][1],margin,148);
    if(state.tab==='heatmap'){c.font='400 12px Montserrat';c.textAlign='right';if(state.heatmapHighlight)c.fillText('Full scores muted · orange = below maximum',w-margin,148);else{c.fillText('0%',w-margin-150,148);const gradient=c.createLinearGradient(w-margin-140,0,w-margin-38,0);gradient.addColorStop(0,'#fff7ef');gradient.addColorStop(1,'#e95c1f');c.fillStyle=gradient;c.fillRect(w-margin-140,138,102,11);c.fillStyle=colors.navy;c.fillText('100%',w-margin,148)}c.textAlign='left'}
    // Render geometry directly at export resolution, preserving the current camera and chart layout.
    const liveContext=ctx;c.save();c.translate(0,175);c.scale(s,s);c.beginPath();c.rect(0,0,chartW,chartH);c.clip();ctx=c;try{draw()}finally{ctx=liveContext;c.restore()}
    let y=190+chartHeight;c.fillStyle=colors.navy;c.font='400 15px Montserrat';for(const n of notes)y=exportLines(c,n,margin,y,w-2*margin,22);
    c.fillStyle=colors.navy;c.fillRect(0,out.height/2-64,w,64);c.fillStyle=colors.white;c.font='700 15px Montserrat';c.fillText('Consumer Choice Center · CCC research',margin,out.height/2-37);c.font='400 12px "DM Mono"';c.fillText('consumerchoicecenter.org',margin,out.height/2-16);
    const blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(new Error('PNG creation failed')),'image/png'));const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`ccc-sharing-economy-2026-${state.tab}-${state.tab==='movement'?'custom':state.mode}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('PNG exported with CCC research attribution.');
  }catch(error){console.error(error);toast('Export failed. Please try again.')}finally{button.disabled=false;button.textContent='Export PNG'}
}
function bind(){
  $('region').onchange=e=>{state.region=e.target.value;fillCountries();update()};$('country').onchange=e=>{state.country=e.target.value;update()};$('search').oninput=e=>{state.search=e.target.value;update()};if($('mode'))$('mode').onchange=e=>{state.mode=e.target.value;update()};
  if(hasScoring){$('weights').innerHTML=data.categories.map((cat,i)=>`<div class="weight"><label for="weight${i}">${esc(cat.name)} <output id="weightOutput${i}">1×</output></label><input id="weight${i}" type="range" min="0" max="3" step="0.25" value="1" aria-label="${esc(cat.name)} weight"></div>`).join('');
  data.categories.forEach((cat,i)=>{$(`weight${i}`).oninput=e=>{state.weights[i]=Number(e.target.value);state.mode='custom';update()}});
  $('resetWeights').onclick=()=>{state.weights=Array(10).fill(1);update()};}$('resetAll').onclick=()=>{state=validState({},data);lockDashboard();if($('weightDetails'))$('weightDetails').open=dashboard==='movement';if(dashboard==='map')resetMap(false);update()};
  if(dashboard==='map'){$$('[data-drag]').forEach(b=>b.onclick=()=>{dragMode=b.dataset.drag;$$('[data-drag]').forEach(x=>x.classList.toggle('active',x===b));$('chartHint').textContent=dragMode==='rotate'?'Left-drag to rotate · Right-drag or Shift-drag to pan · Scroll to zoom':'Drag to pan · Select Rotate for rotation · Scroll to zoom'});$('zoomIn').onclick=()=>{view.zoom=Math.min(32,view.zoom*1.3);draw()};$('zoomOut').onclick=()=>{view.zoom=Math.max(.6,view.zoom/1.3);draw()};$('resetView').onclick=()=>resetMap();$('tilt').oninput=e=>{view.tilt=clampMapTilt(Number(e.target.value)*Math.PI/180);e.target.value=view.tilt*180/Math.PI;draw()};$('height').oninput=e=>{view.height=Number(e.target.value);draw()};}$('exportBtn').onclick=exportPNG;
  // Ignore animated height changes; only a new width requires a redraw.
  $('heatmapScroll').onscroll=()=>{if($('chartWrap').scrollLeft!==$('heatmapScroll').scrollLeft)$('chartWrap').scrollLeft=$('heatmapScroll').scrollLeft};
  $('chartWrap').onscroll=()=>{positionHeatmapLabels();if($('heatmapScroll').scrollLeft!==$('chartWrap').scrollLeft)$('heatmapScroll').scrollLeft=$('chartWrap').scrollLeft};
  new ResizeObserver(()=>{if((state.tab==='heatmap'?Math.max(heatmapWidth(state.heatmapCategories.length),$('chartWrap').clientWidth):['ranking','compare','distribution','movement'].includes(state.tab)?Math.max(760,$('chartWrap').clientWidth):$('chartWrap').clientWidth)!==chartW)resize()}).observe($('chartWrap'));
}
async function init(){
  try{const files=dashboard==='map'?['data.json','world.geojson','map-details.json']:['data.json'];
    const responses=await Promise.all(files.map(name=>fetch(asset(name))));if(responses.some(r=>!r.ok))throw Error('Dataset unavailable');
    [data,world,mapDetails]=await Promise.all(responses.map(r=>r.json()));let raw={};try{raw=JSON.parse(new URLSearchParams(location.search).get('state')||'{}')||{}}catch{}
    state=validState(raw,data);lockDashboard();if(['world','europe','americas','east-coast','asia'].includes(raw.mapArea))mapArea=raw.mapArea;
    if(dashboard==='map'&&raw.view&&typeof raw.view==='object'){for(const [key,min,max]of[['yaw',-100,100],['tilt',MIN_MAP_TILT,MAX_MAP_TILT],['zoom',.6,32],['panX',-5000,5000],['panY',-5000,5000],['height',30,160]])if(Number.isFinite(raw.view[key]))view[key]=Math.min(max,Math.max(min,raw.view[key]));$('tilt').value=view.tilt*180/Math.PI;$('height').value=view.height}
    if(dashboard==='map'){$('height').value=view.height;$('tilt').value=view.tilt*180/Math.PI;}
    $('region').innerHTML=options([['','All regions'],...[...new Set(data.cities.map(c=>c.region))].sort().map(r=>[r,r])],state.region);logo.src=asset('logo.svg').href;bind();await document.fonts.ready;update();
  }catch(error){console.error(error);$('chartEmpty').hidden=false;$('chartEmpty').textContent='The research data could not be loaded. Reload the page to try again.';$('filterCount').textContent='Data unavailable';$('exportBtn').disabled=true}
}
init();
