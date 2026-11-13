(() => {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("lang");
  if (requested === "en" || requested === "es") {
    try { localStorage.setItem("coping-tools-language", requested); }
    catch { try { sessionStorage.setItem("coping-tools-language", requested); } catch {} }
    params.delete("lang");
    const query = params.toString();
    history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash);
  }
})();
