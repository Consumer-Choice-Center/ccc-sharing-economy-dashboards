export function score(city, mode, weights, categories) {
  if (mode === 'official') return city.index;
  const denominator = categories.reduce((sum, c, i) => sum + c.max * weights[i], 0);
  return denominator > 0 ? 100 * city.scores.reduce((sum, v, i) => sum + v * weights[i], 0) / denominator : null;
}
export function selectCities(data, state) {
  const q = state.search.toLocaleLowerCase().trim();
  return data.cities.filter(c => (!state.region || c.region === state.region) && (!state.country || c.country === state.country) && (!q || `${c.city} ${c.country}`.toLocaleLowerCase().includes(q))).map(c => ({...c, value:score(c, state.mode, state.weights, data.categories)})).sort((a,b) => (b.value ?? -1) - (a.value ?? -1) || a.city.localeCompare(b.city));
}
export function customRanks(cities) {
  return new Map(cities.map(c => [c.id, c.value == null ? null : 1 + cities.filter(other => other.value != null && other.value > c.value + 1e-9).length]));
}
export function validState(raw, data) {
  const ids = new Set(data.cities.map(c=>c.id));
  let compare=Array.isArray(raw.compare)?[...new Set(raw.compare.filter(id=>ids.has(id)))]:['kyiv','nashville'];
  // Preserve the visible selection in embeds from the former two/three-city control.
  if([2,3].includes(raw.compareCount))compare=compare.slice(0,raw.compareCount);
  for(const id of ['kyiv','nashville',...ids])if(compare.length<2&&ids.has(id)&&!compare.includes(id))compare.push(id);
  return {
    tab:['map','ranking','categories','compare','heatmap','distribution','movement'].includes(raw.tab)?raw.tab:'map',
    mode:raw.mode==='custom'?'custom':'official',
    region:[...new Set(data.cities.map(c=>c.region))].includes(raw.region)?raw.region:'',
    country:[...new Set(data.cities.map(c=>c.country))].includes(raw.country)?raw.country:'',
    search:typeof raw.search==='string'?raw.search.slice(0,100):'',
    weights:Array.isArray(raw.weights)&&raw.weights.length===10?raw.weights.map(v=>Number.isFinite(v)?Math.min(3,Math.max(0,v)):1):Array(10).fill(1),
    selected:ids.has(raw.selected)?raw.selected:'kyiv',
    compare,
    compareOnlyDifferences:raw.compareOnlyDifferences===true,
    compareSort:raw.compareSort==='category'?'category':'gap',
    pinned:ids.has(raw.pinned)?raw.pinned:'',
    movementSort:raw.movementSort==='score'?'score':'change',
    heatmapGroup:raw.heatmapGroup==='region'?'region':'none',
    heatmapHighlight:raw.heatmapHighlight===true,
    limit:[10,20,70].includes(raw.limit)?raw.limit:10,
    heatmapCategories:Array.isArray(raw.heatmapCategories)?[...new Set(raw.heatmapCategories.filter(i=>Number.isInteger(i)&&i>=0&&i<data.categories.length))].sort((a,b)=>a-b):data.categories.map((_,i)=>i),
    heatmapSort:['score','city','country',...data.categories.map((_,i)=>'category:'+i)].includes(raw.heatmapSort)?raw.heatmapSort:'score',
    heatmapOrder:raw.heatmapOrder==='asc'?'asc':'desc',
    heatmapLimit:[20,40,70].includes(raw.heatmapLimit)?raw.heatmapLimit:20,
    category:Number.isInteger(raw.category)&&raw.category>=0&&raw.category<10?raw.category:-1
  };
}

// Category visibility never changes scores or their denominators.
export function heatmapRows(cities,state) {
  const rows=[...cities],direction=state.heatmapOrder==='asc'?1:-1;
  const category=state.heatmapSort.startsWith('category:')?Number(state.heatmapSort.split(':')[1]):null;
  rows.sort((a,b)=>{
    if(state.heatmapSort==='city')return a.city.localeCompare(b.city);
    if(state.heatmapSort==='country')return a.country.localeCompare(b.country)||a.city.localeCompare(b.city);
    const av=category===null?a.value:a.scores[category],bv=category===null?b.value:b.scores[category];
    if(av==null||bv==null)return av==null&&bv==null?a.city.localeCompare(b.city):av==null?1:-1;
    return direction*(av-bv)||a.city.localeCompare(b.city);
  });
  const selected=rows.slice(0,state.heatmapLimit);
  return state.heatmapGroup==='region'?selected.sort((a,b)=>a.region.localeCompare(b.region)):selected;
}
