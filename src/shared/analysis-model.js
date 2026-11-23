import {score, customRanks} from './model.js?v=tilt-ranks-1';
export function comparisonCities(data,state){
  return state.compare.map(id=>data.cities.find(c=>c.id===id)).filter(Boolean).map(c=>({...c,value:score(c,state.mode,state.weights,data.categories)}));
}
export function comparisonRows(data,state){
  const cities=comparisonCities(data,state);
  const rows=data.categories.map((cat,i)=>{const values=cities.map(c=>c.scores[i]/cat.max*100);return {cat,index:i,values,gap:Math.max(...values)-Math.min(...values)}}).filter(r=>!state.compareOnlyDifferences||r.gap>1e-9);
  if(state.compareSort==='gap')rows.sort((a,b)=>b.gap-a.gap||a.index-b.index);
  return rows;
}
export function rankingRows(cities,state){
  const rows=cities.filter(c=>c.value!=null).slice(0,state.limit),pinned=cities.find(c=>c.id===state.pinned&&c.value!=null);
  if(pinned&&!rows.some(c=>c.id===pinned.id))rows.push(pinned);
  return rows;
}
export function movementRows(data,cities,state){
  const before=new Map(data.cities.map(c=>[c.id,c.rank]));
  const adjusted=data.cities.map(c=>({...c,value:score(c,'custom',state.weights,data.categories)}));
  const after=customRanks(adjusted),values=new Map(adjusted.map(c=>[c.id,c.value]));
  return cities.map(c=>({...c,baseline:before.get(c.id),adjusted:after.get(c.id),value:values.get(c.id),change:after.get(c.id)==null?null:before.get(c.id)-after.get(c.id)}))
    .sort((a,b)=>(state.movementSort==='change'?Math.abs(b.change??0)-Math.abs(a.change??0):0)||(a.adjusted??Infinity)-(b.adjusted??Infinity)||a.city.localeCompare(b.city)).slice(0,state.limit);
}
export function scoreBuckets(cities,category,index){
  const groups=new Map();
  for(const c of cities){const pct=c.scores[index]/category.max*100;if(!groups.has(pct))groups.set(pct,[]);groups.get(pct).push(c)}
  return [...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([value,cities])=>({value,cities:[...cities].sort((a,b)=>a.city.localeCompare(b.city))}));
}
