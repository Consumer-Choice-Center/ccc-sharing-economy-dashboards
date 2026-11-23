// Each city uses a score-scaled cluster of columns. These surrounding columns
// are a visual encoding of one city score, not neighbourhood measurements.
// Fixed across filters: zero remains zero and equal scores retain equal peaks.
export const mapHeightRatio=(value,maximum)=>maximum>0?Math.pow(Math.max(0,Math.min(1,value/maximum)),3):0;
export function renderWorld(ctx, {world, details, cities, selected, width, height, view, project, maximum, scoreLabel, rank}) {
  const ocean='#ffffff',land='#fff7ef',ink='#22264e',orange='#e95c1f';
  const clusterSpacing=1.5,columnHalfWidth=.23;
  const hits=[];
  ctx.lineJoin='round';ctx.lineCap='round';ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.fillStyle=ocean;ctx.fillRect(0,0,width,height);
  function label(value,x,y,size=10,color=ink,align='left',weight=400){ctx.font=`${weight} ${size}px Montserrat`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(value,x,y)}
  function geometry(g){
    const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
    const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:[];
    ctx.beginPath();
    for(const rings of polygons)for(const ring of rings){ring.forEach(([lon,lat],i)=>{const p=project(lon,lat);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath()}
    for(const line of lines)line.forEach(([lon,lat],i)=>{const p=project(lon,lat);i?ctx.lineTo(...p):ctx.moveTo(...p)});
  }
  function face(points,color){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=color;ctx.fill()}
  function tint(strength){const rgb=[233,92,31].map(v=>Math.round(255+(v-255)*strength));return `rgb(${rgb.join(',')})`}
  function column(lon,lat,radius,z,strength){
    const d=radius/(width/405*view.zoom);
    const corners=[[-d,-d],[d,-d],[d,d],[-d,d]];
    const bottom=corners.map(([dx,dy])=>project(lon+dx,lat+dy,0));
    const top=corners.map(([dx,dy])=>project(lon+dx,lat+dy,z));
    const edges=corners.map((_,i)=>({i,j:(i+1)%4,depth:(bottom[i][1]+bottom[(i+1)%4][1])/2})).sort((a,b)=>a.depth-b.depth);
    for(const {i,j} of edges)face([bottom[i],bottom[j],top[j],top[i]],tint(strength*(i%2?.81:1)));
    face(top,tint(strength*.72));
  }
  // A neutral, lightly shaded land surface leaves the score layer dominant.
  for(const f of world.features){geometry(f.geometry);ctx.fillStyle=land;ctx.fill('evenodd');ctx.strokeStyle='rgba(34,38,78,.17)';ctx.lineWidth=.42;ctx.stroke()}
  if(view.zoom>1.4){
    for(const g of details.boundaries){geometry(g);ctx.strokeStyle='rgba(34,38,78,.12)';ctx.lineWidth=.35;ctx.stroke()}
    for(const g of details.rivers){geometry(g);ctx.strokeStyle='rgba(111,120,155,.25)';ctx.lineWidth=.48;ctx.stroke()}
  }
  if(view.zoom>2.5)for(const g of details.urban||[]){geometry(g);ctx.fillStyle='rgba(205,183,159,.20)';ctx.fill('evenodd')}
  for(const g of details.lakes){geometry(g);ctx.fillStyle=ocean;ctx.fill('evenodd');ctx.strokeStyle='rgba(34,38,78,.11)';ctx.lineWidth=.3;ctx.stroke()}
  const annotations=[['NORTH AMERICA',-110,45],['SOUTH AMERICA',-66,-28],['EUROPE',4,66],['AFRICA',17,4],['ASIA',100,55],['OCEANIA',136,-35]];
  if(view.zoom<1.5)for(const [name,lon,lat] of annotations){const [x,y]=project(lon,lat);label(name,x,y,8,'rgba(34,38,78,.34)','center')}
  const points=cities.filter(c=>c.value!=null).map(c=>({c,base:project(...c.coordinates)})).sort((a,b)=>a.base[1]-b.base[1]);
  const columns=[];
  for(const {c,base:[x,y]} of points){
    const magnitude=c.value/maximum;
    const peakHeight=mapHeightRatio(c.value,maximum)*view.height*Math.pow(view.zoom,.30);
    const [,top]=project(...c.coordinates,peakHeight);
    const h=y-top,cellSize=.82*Math.pow(view.zoom,.48),radius=2+7*magnitude;
    const footprint=cellSize*clusterSpacing*radius*1.5;
    if(x+footprint<0||x-footprint>width||y+footprint<0||top-footprint>height)continue;
    if(c.value===0){ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.strokeStyle=orange;ctx.lineWidth=.8;ctx.stroke();hits.push({x:x-7,y:y-7,w:14,h:14,city:c,tip:`${c.city} · 0.00 ${scoreLabel} · Global rank ${rank(c)??'—'}`});continue}
    // Higher scores add complete outer rings. A smooth radial falloff controls
    // both height and orange saturation; the central column retains the score.
    const step=cellSize*clusterSpacing/(width/405*view.zoom),outer=Math.ceil(radius);
    for(let gx=-outer;gx<=outer;gx++)for(let gy=-outer;gy<=outer;gy++){
      const distance=Math.hypot(gx,gy),r=distance/radius;if(r>1)continue;
      // A narrow central peak sits on a broad, low shoulder. This separates
      // neighbouring tops while retaining the wider score-scaled footprint.
      const rim=.9*Math.exp(-11)+.1*Math.exp(-2.2);
      const falloff=(.9*Math.exp(-11*r*r)+.1*Math.exp(-2.2*r*r)-rim)/(1-rim);
      // Stable height variation breaks identical rings without changing the score peak.
      // Using the city coordinates keeps the same pattern across redraws and exports.
      const seed=Math.sin(gx*127.1+gy*311.7+c.coordinates[0]*17.3+c.coordinates[1]*43.1)*43758.5453;
      const variation=1+((seed-Math.floor(seed))*2-1)*.32*Math.min(1,distance/2);
      const profile=distance===0?1:Math.min(.98,Math.max(.008,falloff*variation));
      const z=peakHeight*profile,strength=.10+.90*Math.pow(Math.max(0,1-r),.85);
      const lon=c.coordinates[0]+gx*step,lat=c.coordinates[1]+gy*step;
      columns.push({lon,lat,radius:cellSize*columnHalfWidth,z,strength,depth:project(lon,lat)[1]});
    }
    hits.push({x:x-Math.max(7,footprint),y:top-5,w:Math.max(14,footprint*2),h:h+footprint,city:c,tip:`${c.city} · ${c.value.toFixed(2)} ${scoreLabel} · Global rank ${rank(c)??'—'}`});
  }
  columns.sort((a,b)=>a.depth-b.depth);
  for(const item of columns)column(item.lon,item.lat,item.radius,item.z,item.strength);
  // Name labels sit on the map beside the base, as in the supplied reference.
  const boxes=[];
  const candidates=points.filter(p=>p.c.id===selected||cities.indexOf(p.c)<4||view.zoom>2.2).sort((a,b)=>(b.c.id===selected)-(a.c.id===selected)||b.c.value-a.c.value);
  for(const {c,base:[x,y]} of candidates){
    const fontSize=view.zoom>2?11:9;ctx.font=`500 ${fontSize}px Montserrat`;const w=ctx.measureText(c.city).width+10;
    const xx=x-w/2,yy=y+7+(.82*Math.pow(view.zoom,.48)*clusterSpacing*(2+7*c.value/maximum))*.65;
    if(xx<8||xx+w>width-8||yy<65||yy>height-45)continue;
    if(boxes.some(b=>xx<b.x+b.w&&xx+w>b.x&&yy<b.y+20&&yy+20>b.y))continue;
    ctx.font=`500 ${fontSize}px Montserrat`;ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.96)';ctx.strokeText(c.city,x,yy+fontSize);ctx.fillStyle='rgba(34,38,78,.78)';ctx.fillText(c.city,x,yy+fontSize);boxes.push({x:xx,y:yy,w});
  }
  ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(14,12,Math.min(260,width-28),45);
  label('WORLD / SHARING ECONOMY',22,29,9);label(`${cities.length} study cities · ${scoreLabel}`,22,46,9,'rgba(34,38,78,.65)');
  const keyX=width-43,keyY=height-43;ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(keyX-37,keyY-77,72,108);
  for(let i=-4;i<=4;i++){const f=.9*Math.exp(-.48*i*i)+.1*Math.exp(-.10*i*i),h=60*f;ctx.fillStyle=tint(.15+.85*f);ctx.fillRect(keyX+i*4-.65,keyY-h,1.3,h)}
  label('0',keyX-9,keyY+2,8,ink,'right');label(maximum.toFixed(0),keyX-9,keyY-56,8,ink,'right');label('HEIGHT',keyX,height-22,7,ink,'center');label('enhanced',keyX,height-11,6,ink,'center');
  ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(15,height-31,Math.min(355,width-110),22);label('Natural Earth · Illustrative clusters of city scores',22,height-17,8,'rgba(34,38,78,.55)');
  return hits;
}
