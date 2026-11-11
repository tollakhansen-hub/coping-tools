let deferredInstallPrompt=null;
const installLink=document.querySelector("[data-install-app]");
const installSeparator=document.querySelector("[data-install-separator]");
const setInstallVisible=visible=>{if(installLink)installLink.hidden=!visible;if(installSeparator)installSeparator.hidden=!visible};
const isStandalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
const trackInstallEvent=event=>{fetch("/api/install-event",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({event}),credentials:"same-origin",keepalive:true}).catch(()=>{})};
if("serviceWorker" in navigator){
  window.addEventListener("load",async()=>{
    try{await navigator.serviceWorker.register("/sw.js")}
    catch(error){console.warn("Offline access could not be enabled.",error)}
  });
}
if(installLink&&!isStandalone){
  // The link opens a browser prompt rather than navigating; expose button semantics.
  installLink.setAttribute("role","button");
  installLink.addEventListener("keydown",event=>{
    if(event.key===" "){event.preventDefault();installLink.click()}
  });
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    const instructions = document.createElement("p");
    instructions.id = "apple-install-instructions";
    instructions.textContent = "Open this page in Safari. Tap Share, then Add to Home Screen. If Open as Web App appears, turn it on, then tap Add.";
    instructions.hidden = true;
    installLink.closest("p").after(instructions);
    installLink.setAttribute("aria-controls", instructions.id);
    installLink.setAttribute("aria-expanded", "false");

    installLink.addEventListener("click", event => {
      event.preventDefault();
      instructions.hidden = !instructions.hidden;
      installLink.setAttribute("aria-expanded", String(!instructions.hidden));
    });
    setInstallVisible(true);
  } else {
    window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredInstallPrompt=event;setInstallVisible(true)});
    installLink.addEventListener("click",async event=>{event.preventDefault();if(!deferredInstallPrompt)return;trackInstallEvent("pressed");deferredInstallPrompt.prompt();const choice=await deferredInstallPrompt.userChoice;if(choice.outcome==="accepted")trackInstallEvent("accepted");deferredInstallPrompt=null;setInstallVisible(false)});
    window.addEventListener("appinstalled",()=>{trackInstallEvent("installed");deferredInstallPrompt=null;setInstallVisible(false)});
  }
}
