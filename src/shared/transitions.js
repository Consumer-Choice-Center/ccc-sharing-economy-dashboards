// Snapshot transitions keep expensive map geometry out of the animation loop.
// The live canvas always contains final, export-ready data underneath the fade.
export function createChartTransition(canvas, wrapper) {
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const timing={duration:380,easing:'cubic-bezier(.22,.61,.36,1)',fill:'both'};
  let overlay=null,fade=null,layout=null;
  function finish(){
    fade?.cancel();layout?.cancel();overlay?.remove();
    overlay=fade=layout=null;
    wrapper.removeAttribute('data-transitioning');
  }
  function capture(){
    if(preference.matches||!canvas.width||!canvas.clientWidth)return null;
    const width=canvas.clientWidth,height=wrapper.getBoundingClientRect().height;
    if(!height)return null;
    const dpr=canvas.width/width,snapshot=document.createElement('canvas');
    snapshot.width=canvas.width;snapshot.height=Math.ceil(height*dpr);
    const c=snapshot.getContext('2d');c.scale(dpr,dpr);
    c.fillStyle='#fff';c.fillRect(0,0,width,height);
    c.drawImage(canvas,0,-wrapper.scrollTop,width,canvas.getBoundingClientRect().height);
    // When interrupted, start from the visible blend instead of the old target.
    if(overlay){c.globalAlpha=Number(getComputedStyle(overlay).opacity);c.drawImage(overlay,0,0,width,Number.parseFloat(overlay.style.height));}
    return {snapshot,width,height};
  }
  function play(previous){
    finish();
    if(!previous||preference.matches)return;
    const height=wrapper.getBoundingClientRect().height;
    overlay=previous.snapshot;
    overlay.className='chart-transition';overlay.setAttribute('aria-hidden','true');
    Object.assign(overlay.style,{position:'absolute',top:wrapper.scrollTop+'px',left:'0',width:previous.width+'px',height:previous.height+'px',pointerEvents:'none',zIndex:'2'});
    wrapper.append(overlay);wrapper.setAttribute('data-transitioning','true');
    const activeOverlay=overlay;
    layout=wrapper.animate([{height:previous.height+'px'},{height:height+'px'}],timing);
    fade=overlay.animate([{opacity:1},{opacity:0}],timing);
    fade.finished.then(()=>{if(overlay===activeOverlay)finish();}).catch(()=>{});
  }
  preference.addEventListener('change',()=>{if(preference.matches)finish();});
  return {capture,play,finish,get active(){return overlay!==null;},get reduced(){return preference.matches;}};
}
