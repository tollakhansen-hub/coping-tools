let deferredInstallPrompt=null;
const installLink=document.querySelector("[data-install-app]");
const installSeparator=document.querySelector("[data-install-separator]");
const setInstallVisible=visible=>{if(installLink)installLink.hidden=!visible;if(installSeparator)installSeparator.hidden=!visible};
const isStandalone=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const trackInstallEvent=event=>Promise.resolve({ok:false});
async function reportAppleFirstOpen() {
  const key = "coping-tools-apple-first-open";
  try {
    if (localStorage.getItem(key) === "sent") return;
    const response = await trackInstallEvent("appleFirstOpen");
    if (response?.ok) localStorage.setItem(key, "sent");
  } catch {
    // Storage can be unavailable. Leave the app usable.
  }
}

if (isAppleMobile && isStandalone) {
  const report = () => {
    if (navigator.locks) {
      navigator.locks.request("coping-tools-apple-first-open", reportAppleFirstOpen).catch(() => {});
    } else {
      void reportAppleFirstOpen();
    }
  };
  report();
  window.addEventListener("online", report);
}

if("serviceWorker" in navigator){
  window.addEventListener("load",async()=>{
    try{await navigator.serviceWorker.register("/es-review/sw.js")}
    catch(error){console.warn("Offline access could not be enabled.",error)}
  });
}
function manualInstallInstructions(userAgent) {
  const isSpanish = document.documentElement.lang === "es";
  if (isAppleMobile) {
    return isSpanish
      ? "Abre esta página en Safari. Pulsa Compartir y, después, Añadir a pantalla de inicio. Si aparece la opción «Abrir como app web», actívala y pulsa Añadir."
      : "Open this page in Safari. Tap Share, then Add to Home Screen. If Open as Web App appears, turn it on, then tap Add.";
  }
  if (/Macintosh/.test(userAgent) && /Safari\//.test(userAgent) &&
      !/Chrome\/|Chromium\/|Edg\/|OPR\//.test(userAgent) &&
      Number(userAgent.match(/Version\/(\d+)/)?.[1]) >= 17) {
    return isSpanish
      ? "En Safari para macOS Sonoma o posterior, abre el menú Archivo y elige «Añadir al Dock» si aparece. Pulsa Añadir."
      : "In Safari on macOS Sonoma or later, open the File menu and choose Add to Dock if available. Click Add.";
  }
  if (/Android/.test(userAgent) && /Firefox\//.test(userAgent)) {
    return isSpanish
      ? "En Firefox, abre el menú de tres puntos y pulsa Instalar si aparece. Sigue los pasos para añadir la página a la pantalla de inicio."
      : "In Firefox, open the three-dot menu and tap Install if available. Follow the Add to Home Screen steps.";
  }
  if (/Windows/.test(userAgent) && Number(userAgent.match(/Firefox\/(\d+)/)?.[1]) >= 143) {
    return isSpanish
      ? "En Firefox, pulsa el botón de aplicaciones web de la barra de direcciones, si aparece."
      : "In Firefox, click the web apps button in the address bar if it is available.";
  }
  return "";
}

if(installLink&&!isStandalone){
  installLink.setAttribute("role","button");
  installLink.addEventListener("keydown",event=>{
    if(event.key===" "){event.preventDefault();installLink.click()}
  });
  const manualInstructions = manualInstallInstructions(navigator.userAgent);
  if (manualInstructions) {
    const instructions = document.createElement("p");
    instructions.id = "app-install-instructions";
    instructions.textContent = manualInstructions;
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
