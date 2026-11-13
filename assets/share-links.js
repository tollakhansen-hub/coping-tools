'use strict';
(function(){
  const status=document.getElementById('share-feedback');
  document.querySelectorAll('[data-copy-url]').forEach(button=>{
    button.addEventListener('click',async()=>{
      const url=button.getAttribute('data-copy-url');
      try{
        if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(url)}
        else{const field=document.createElement('textarea');field.value=url;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();const copied=document.execCommand('copy');field.remove();if(!copied)throw new Error('Copy unavailable')}
        status.textContent='Link copied: '+url;
      }catch(e){status.textContent='Unable to copy automatically. Select the link shown in the list instead.'}
    });
  });
  const panels=document.querySelectorAll('.share-qr-detail');
  document.querySelectorAll('.share-qr-button').forEach(button=>{
    button.addEventListener('click',()=>{
      const panel=document.getElementById(button.getAttribute('aria-controls'));
      const willOpen=panel.hidden;
      panels.forEach(p=>p.hidden=true);
      document.querySelectorAll('.share-qr-button').forEach(b=>b.setAttribute('aria-expanded','false'));
      panel.hidden=!willOpen;
      button.setAttribute('aria-expanded',String(willOpen));
    });
  });
  document.querySelectorAll('.share-download-png').forEach(button=>{
    button.addEventListener('click',async()=>{
      const slug=button.dataset.qrSlug;
      try{
        const response=await fetch('/assets/qr/'+slug+'.svg');
        if(!response.ok)throw new Error('QR file unavailable');
        const svg=await response.text();
        const blob=new Blob([svg],{type:'image/svg+xml'});
        const objectUrl=URL.createObjectURL(blob);
        try{
          const image=new Image();
          await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=objectUrl});
          const canvas=document.createElement('canvas');canvas.width=800;canvas.height=800;
          const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
          ctx.imageSmoothingEnabled=false;ctx.fillStyle='#fff';ctx.fillRect(0,0,800,800);
          ctx.drawImage(image,0,0,800,800);
          const png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG unavailable')),'image/png'));
          const pngUrl=URL.createObjectURL(png);
          const a=document.createElement('a');a.href=pngUrl;a.download=slug+'-coping-tools.png';document.body.appendChild(a);a.click();a.remove();
          setTimeout(()=>URL.revokeObjectURL(pngUrl),1000);
          status.textContent='PNG download prepared.';
        }finally{URL.revokeObjectURL(objectUrl)}
      }catch(e){status.textContent='PNG download is unavailable on this browser. Use Download SVG instead.'}
    });
  });
})();
