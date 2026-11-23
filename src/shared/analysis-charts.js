import {comparisonCities,comparisonRows,movementRows,rankingRows,scoreBuckets} from './analysis-model.js?v=tilt-ranks-1';
const navy='#22264e',orange='#e95c1f',gray='#788298';
function painter(ctx){return {
 text(t,x,y,size=13,align='left',weight=400,color=navy){ctx.font=`${weight} ${size}px Montserrat`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(t,x,y)},
 line(x,y,xx,yy,color='#e4e7ed',w=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.strokeStyle=color;ctx.lineWidth=w;ctx.stroke()},
 dot(x,y,r,color,shape=0){ctx.fillStyle=color;ctx.beginPath();if(shape===1){ctx.rect(x-r,y-r,r*2,r*2)}else if(shape===2){ctx.moveTo(x,y-r-1);ctx.lineTo(x+r+1,y+r);ctx.lineTo(x-r-1,y+r);ctx.closePath()}else ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
}}
function comparisonLayout(data,state){
 const cities=comparisonCities(data,state),rows=comparisonRows(data,state),numbered=cities.length>3,gap=numbered?18:11;
 const legendHeight=Math.ceil(cities.length/3)*48,axisY=legendHeight+19;
 let bottom=axisY+10;
 const layout=rows.map(r=>{const counts=new Map();r.values.forEach(v=>counts.set(v,(counts.get(v)||0)+1));const height=Math.max(48,(Math.max(...counts.values())-1)*gap+30),y=bottom+height/2;bottom+=height;return {...r,counts,y}});
 return {cities,rows:layout,numbered,gap,axisY,bottom,height:Math.max(260,bottom+42)};
}
export const compareHeight=(data,state)=>comparisonLayout(data,state).height;
export function drawComparison(ctx,{data,state,width}){
 const p=painter(ctx),{cities,rows,numbered,gap,axisY,bottom,height}=comparisonLayout(data,state),hits=[],palette=[orange,navy,gray],left=195,right=105,plot=width-left-right;
 function marker(j,x,y){if(numbered){p.dot(x,y,8,j%2?navy:orange);p.text(j+1,x,y+3,9,'center',700,'#fff')}else p.dot(x,y,5,palette[j],j)}
 cities.forEach((c,j)=>{const columns=Math.min(3,cities.length),x=20+(j%columns)*(width-40)/columns,y=Math.floor(j/columns)*48;marker(j,x+5,y+19);p.text(c.city,x+19,y+24,14,'left',700);p.text(`${c.value==null?'—':c.value.toFixed(2)} ${state.mode==='official'?'index':'/ 100'}`,x+19,y+44,11)});
 [0,25,50,75,100].forEach(v=>{const x=left+plot*v/100;p.line(x,axisY+10,x,bottom);p.text(v+'%',x,axisY,11,'center')});
 p.text(cities.length===2?'Gap':'Spread',width-22,axisY,11,'right',500);
 if(!rows.length)p.text('No category differences between the selected cities.',20,axisY+57,14);
 rows.forEach(r=>{
  const y=r.y,lo=Math.min(...r.values),hi=Math.max(...r.values);
  p.text(r.cat.name,left-16,y+4,12,'right');p.line(left+plot*lo/100,y,left+plot*hi/100,y,'#afb5c3',3);
  const seen=new Map();cities.forEach((c,j)=>{const v=r.values[j],n=seen.get(v)||0;seen.set(v,n+1);const dy=(n-(r.counts.get(v)-1)/2)*gap,x=left+plot*v/100;
   marker(j,x,y+dy);hits.push({x:x-9,y:y+dy-9,w:18,h:18,city:c,tip:`${c.city} · ${r.cat.name}: ${c.scores[r.index]} / ${r.cat.max} (${v.toFixed(1)}%)`});
  });
  p.text(r.gap.toFixed(1)+' pp',width-22,y+4,12,'right',r.gap?700:400);
 });
 p.text('pp = percentage points',20,height-14,11);
 return hits;
}
export const distributionHeight=categories=>70+categories.length*112;
export function drawDistribution(ctx,{data,cities,selected,width}){
 const p=painter(ctx),left=190,right=34,plot=width-left-right,hits=[];
 [0,25,50,75,100].forEach(v=>{const x=left+plot*v/100;p.text(v+'%',x,23,11,'center');p.line(x,36,x,distributionHeight(data.categories)-30)});
 data.categories.forEach((cat,i)=>{
  const y=85+i*112;p.text(cat.name,left-18,y-2,12,'right',500);
  const mean=cities.reduce((s,c)=>s+c.scores[i]/cat.max*100,0)/cities.length;p.text(`Mean ${mean.toFixed(1)}%`,left-18,y+17,11,'right',400,gray);
  p.line(left,y+32,width-right,y+32,'#e7e9ef');
  for(const bucket of scoreBuckets(cities,cat,i)){
   const size=6,gap=9,maxRows=8,cols=Math.ceil(bucket.cities.length/maxRows),rows=Math.min(maxRows,bucket.cities.length);
   bucket.cities.forEach((c,k)=>{const col=Math.floor(k/maxRows),row=k%maxRows,anchor=Math.max(left+(cols-1)*gap/2,Math.min(width-right-(cols-1)*gap/2,left+plot*bucket.value/100)),x=anchor+(col-(cols-1)/2)*gap,yy=y+24-row*gap;
    p.dot(x,yy,c.id===selected?4.4:3,c.id===selected?navy:orange);
    hits.push({x:x-4,y:yy-4,w:8,h:8,city:c,tip:`${c.city} · ${cat.name}: ${c.scores[i]} / ${cat.max} (${bucket.value.toFixed(1)}%)`});
   });
  }
 });
 p.text('One dot = one city · Dots are stacked to separate equal scores',20,distributionHeight(data.categories)-9,11);
 return hits;
}
export const rankingHeight=(cities,state)=>90+rankingRows(cities,state).length*51;
export function drawLeaderboard(ctx,{cities,state,width,maximum,rank}){
 const p=painter(ctx),rows=rankingRows(cities,state),left=230,right=72,plot=width-left-right,hits=[];
 [0,.25,.5,.75,1].forEach(v=>{const x=left+plot*v;p.text((maximum*v).toFixed(0),x,23,11,'center');p.line(x,35,x,rankingHeight(cities,state)-30)});
 rows.forEach((c,i)=>{const y=48+i*51,pinned=c.id===state.pinned;
  if(pinned){ctx.fillStyle='#fff1e5';ctx.fillRect(10,y-5,width-20,46)}
  p.text('#'+rank(c),20,y+17,13,'left',700);p.text(c.city,67,y+12,13,'left',700);p.text(c.country+(pinned?' · pinned':''),67,y+29,11,'left',400,gray);
  const w=c.value/maximum*plot;ctx.fillStyle=c.id===state.selected?navy:orange;ctx.fillRect(left,y+2,w,25);p.text(c.value.toFixed(2),left+w+10,y+20,13,'left',500);
  hits.push({x:10,y:y-4,w:width-20,h:46,city:c,tip:`#${rank(c)} · ${c.city}, ${c.country} · ${c.value.toFixed(2)}`});
 });return hits;
}
export const movementHeight=(data,cities,state)=>100+movementRows(data,cities,state).length*38;
export function drawMovement(ctx,{data,cities,state,width}){
 const p=painter(ctx),rows=movementRows(data,cities,state),hits=[];
 if(rows.every(c=>c.adjusted==null)){p.text('Set at least one weight above zero.',24,80,15);return hits}
 const before=[...rows].sort((a,b)=>a.baseline-b.baseline||a.city.localeCompare(b.city)),after=[...rows].sort((a,b)=>a.adjusted-b.adjusted||a.city.localeCompare(b.city));
 const left=Math.min(260,width*.36),right=width-left,top=66;
 p.text('Official I-Distance ranks',20,25,13,'left',700);p.text('Custom-score ranks',width-20,25,13,'right',700);
 p.text('Global ranks · selected cities spaced evenly',20,movementHeight(data,cities,state)-10,11);
 for(const c of rows){const y1=top+before.indexOf(c)*38,y2=top+after.indexOf(c)*38,highlight=c.id===state.selected,color=highlight?navy:c.change?orange:'#c2c7d0';p.line(left,y1,right,y2,color,highlight?3:1.5);p.dot(left,y1,4,color);p.dot(right,y2,4,color);
  p.text(`${c.city}  #${c.baseline}`,left-12,y1+4,12,'right',highlight?700:400);
  p.text(`#${c.adjusted}  ${c.city}`,right+12,y2+4,12,'left',highlight?700:400);
  const tip=`${c.city}: official #${c.baseline} → custom #${c.adjusted} · ${c.change>0?'up '+c.change:c.change<0?'down '+(-c.change):'unchanged'} · ${c.value.toFixed(2)} / 100`;
  hits.push({x:0,y:y1-12,w:left+8,h:26,city:c,tip},{x:right-8,y:y2-12,w:width-right+8,h:26,city:c,tip});
 }
 return hits;
}
