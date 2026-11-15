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
})();
