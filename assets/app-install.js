let deferredInstallPrompt=null;
const installLink=document.querySelector("[data-install-app]");
const isStandalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js"))}
if(installLink&&!isStandalone){
  window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;installLink.hidden=false});
  installLink.addEventListener("click",async event=>{event.preventDefault();if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;installLink.hidden=true});
  window.addEventListener("appinstalled",()=>{deferredInstallPrompt=null;installLink.hidden=true});
}
