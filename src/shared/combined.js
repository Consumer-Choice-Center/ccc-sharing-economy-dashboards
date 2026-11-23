const tabs=[...document.querySelectorAll('[role="tab"]')];
const panels=[...document.querySelectorAll('[role="tabpanel"]')];
const loaded=new Map();

function loadPanel(panel){
  if(loaded.has(panel.id))return;
  const frame=document.createElement('iframe');
  frame.title=panel.dataset.title;
  frame.dataset.loading='';
  frame.referrerPolicy='strict-origin-when-cross-origin';
  const status=panel.querySelector('[role="status"]');
  const entry={frame,resize:null,observer:null};
  loaded.set(panel.id,entry);
  frame.addEventListener('load',()=>{
    const doc=frame.contentDocument;
    const main=doc?.querySelector('main');
    if(!main||!doc.body.dataset.dashboard){
      status.replaceChildren(document.createTextNode('This dashboard could not be loaded. '));
      const link=document.createElement('a');link.href=panel.dataset.src;link.textContent='Open it directly';status.append(link);return;
    }
    // The combined shell supplies the single CCC header; all chart controls remain in the child.
    doc.documentElement.dataset.combined='true';
    doc.querySelector('.dashboard-header').hidden=true;
    doc.querySelector('.dashboard-header').style.display='none';
    const resize=()=>{
      const height=Math.ceil(main.getBoundingClientRect().bottom+frame.contentWindow.scrollY+24);
      if(Number.isFinite(height)&&height>0&&frame.style.height!==height+'px')frame.style.height=height+'px';
    };
    entry.resize=resize;
    entry.observer=new ResizeObserver(resize);entry.observer.observe(main);
    delete frame.dataset.loading;status.hidden=true;
    resize();doc.fonts.ready.then(resize);
  });
  frame.src=panel.dataset.src;
  panel.append(frame);
}

function selectTab(tab,{focus=false,updateURL=true}={}){
  for(const item of tabs){const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;}
  for(const panel of panels){const selected=panel.id===tab.getAttribute('aria-controls');panel.setAttribute('aria-hidden',String(!selected));panel.inert=!selected;}
  const panel=document.getElementById(tab.getAttribute('aria-controls'));
  loadPanel(panel);loaded.get(panel.id).resize?.();
  if(focus)tab.focus();
  if(updateURL){const url=new URL(location.href);url.hash=tab.dataset.dashboard;history.replaceState(null,'',url);}
}

for(const [index,tab] of tabs.entries()){
  tab.addEventListener('click',()=>selectTab(tab));
  tab.addEventListener('keydown',event=>{
    const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
    if(next!==null){event.preventDefault();tabs[next].focus();}
    // Enter and Space use the native button click, keeping activation explicit.
  });
}
function fromHash(){return tabs.find(tab=>tab.dataset.dashboard===location.hash.slice(1))||tabs[0];}
window.addEventListener('hashchange',()=>selectTab(fromHash(),{updateURL:false}));
selectTab(fromHash(),{updateURL:false});

// Dispatch downloads from the outer document so one embedded explorer owns the export.
window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.type!=='ccc-export-png')return;
  const source=[...loaded.values()].find(entry=>entry.frame.contentWindow===event.source);
  if(!source||source.frame.parentElement.getAttribute('aria-hidden')!=='false')return;
  const {blob,filename}=event.data;
  if(!(blob instanceof Blob)||blob.type!=='image/png'||typeof filename!=='string'||!/^ccc-sharing-economy-2026-[a-z-]+\.png$/.test(filename))return;
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
});
