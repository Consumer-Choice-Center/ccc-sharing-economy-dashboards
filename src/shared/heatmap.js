export const heatmapWidth=count=>Math.max(680,200+count*100);
export const HEATMAP_TOP=92;
export function heatmapEntries(rows,group){
 let y=HEATMAP_TOP,last=null;const entries=[];
 for(const city of rows){if(group==='region'&&city.region!==last){last=city.region;entries.push({group:last,y});y+=30}entries.push({city,y});y+=40}
 return {entries,height:Math.max(220,y+20)};
}
export const heatmapHeight=(rows,group)=>heatmapEntries(rows,group).height;
export function renderHeatmap(ctx,{rows,categories,indices,width,selected,group,highlight}){
 const ink='#22264e',left=180,right=20,top=HEATMAP_TOP,cellWidth=(width-left-right)/indices.length,hits=[];
 const color=ratio=>`rgb(${[255,247,239].map((v,i)=>Math.round(v+([233,92,31][i]-v)*ratio)).join(',')})`;
 function text(value,x,y,size=13,align='left',weight=400,fill=ink){ctx.fillStyle=fill;ctx.font=`${weight} ${size}px Montserrat`;ctx.textAlign=align;ctx.fillText(value,x,y)}
 text('CITY',left-12,top-16,12,'right',500);
 indices.forEach((index,j)=>{
  const cat=categories[index],x=left+j*cellWidth+cellWidth/2,words=cat.name.replaceAll('-','- ').split(' '),lines=[];let line='';ctx.font='500 13px Montserrat';
  for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width>cellWidth-10&&line){lines.push(line);line=word}else line=next}if(line)lines.push(line);
  lines.forEach((line,k)=>text(line.replaceAll('- ','-'),x,top-42-(lines.length-1-k)*17,13,'center',500));text(`max ${cat.max}`,x,top-16,11,'center');
 });
 for(const entry of heatmapEntries(rows,group).entries){
  const {city,y}=entry;
  if(entry.group){ctx.fillStyle='#f0f2f6';ctx.fillRect(8,y,width-16,27);text(entry.group,20,y+19,12,'left',700);continue}
  if(city.id===selected){ctx.fillStyle='#e7ecf4';ctx.fillRect(8,y,left-14,36)}
  text(city.city,left-12,y+25,13,'right',city.id===selected?700:400);hits.push({x:8,y,w:left-12,h:40,city,tip:`${city.city} · ${city.country}`});
  indices.forEach((index,j)=>{const cat=categories[index],value=city.scores[index],ratio=value/cat.max,x=left+j*cellWidth;
   ctx.fillStyle=highlight&&ratio===1?'#eef0f4':color(ratio);ctx.fillRect(x+1,y,cellWidth-3,36);text(String(Math.round(ratio*100)),x+(cellWidth-1)/2,y+25,16,'center',500,highlight&&ratio===1?'#687084':'#16161c');
   hits.push({x,y,w:cellWidth,h:40,city,tip:`${city.city} · ${cat.name}: ${value} / ${cat.max} points (${(ratio*100).toFixed(1)}%)`});
  });
 }
 return hits;
}
