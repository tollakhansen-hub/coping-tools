let deferredInstallPrompt=null;
const installLink=document.querySelector("[data-install-app]");
const isStandalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
const trackInstallEvent=event=>{fetch("/api/install-event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event}),credentials:"same-origin",keepalive:true}).catch(()=>{})};
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js"))}
if(installLink&&!isStandalone){
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;installLink.hidden=false});
  installLink.addEventListener("click",async event=>{event.preventDefault();if(!deferredInstallPrompt)return;trackInstallEvent("pressed");deferredInstallPrompt.prompt();const choice=await deferredInstallPrompt.userChoice;if(choice.outcome==="accepted")trackInstallEvent("accepted");deferredInstallPrompt=null;installLink.hidden=true});
  window.addEventListener("appinstalled",()=>{trackInstallEvent("installed");deferredInstallPrompt=null;installLink.hidden=true});
}
