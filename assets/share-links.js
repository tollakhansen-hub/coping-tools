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
})();
