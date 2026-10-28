/* Optional one-line feedback. One independent answer per route per browser profile when local storage is available. */
document.querySelectorAll("[data-tool-feedback]").forEach(section => {
  const page = section.dataset.feedbackPage;
  const question = section.querySelector(".tool-feedback-question");
  const choices = section.querySelector(".tool-feedback-options");
  const status = section.querySelector(".tool-feedback-status");
  const buttons = [...section.querySelectorAll("[data-feedback-vote]")];
  if (!page || !question || !choices || !status || buttons.length !== 2 || !window.fetch) return;

  // One device-local "answered" flag per route. No identifiers or choices are stored.
  // Keep the existing key so current tab votes migrate to persistent storage.
  const sessionKey = "coping-feedback-v1:" + page;
  const hasVoted = () => {
    try { if (localStorage.getItem(sessionKey) === "sent") return true; }
    catch { /* Browser may disallow persistent storage. */ }
    try { return sessionStorage.getItem(sessionKey) === "sent"; }
    catch { return false; }
  };
  const markVoted = () => {
    try { localStorage.setItem(sessionKey, "sent"); }
    catch { /* A private/restricted browser may not retain the flag. */ }
    try { sessionStorage.setItem(sessionKey, "sent"); }
    catch { /* A successful response still receives thanks. */ }
  };

  let sending = false;
  let submitted = hasVoted();
  const thank = () => {
    question.textContent = "Was this page useful?";
    choices.hidden = true;
    status.textContent = "Thank you";
    status.classList.remove("feedback-sr-only");
    status.hidden = false;
  };

  section.hidden = false;
  if (submitted) {
    markVoted(); // Promote a previously submitted tab-only vote into local storage.
    thank();
  }

  // Keep already-open tabs consistent when another tab successfully submits.
  window.addEventListener("storage", event => {
    if (event.key === sessionKey && event.newValue === "sent") {
      submitted = true;
      thank();
    }
  });

  buttons.forEach(button => button.addEventListener("click", async () => {
    if (sending || submitted) return;
    if (hasVoted()) {
      submitted = true;
      markVoted();
      thank();
      return;
    }
    question.textContent = "Was this page useful?";
    status.hidden = true;
    sending = true;
    buttons.forEach(b => { b.disabled = true; });
    try {
      const response = await fetch("/api/tool-feedback", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, answer: button.dataset.feedbackVote })
      });
      if (!response.ok) throw new Error("Feedback unavailable");
      submitted = true;
      markVoted();
      thank();
    } catch {
      question.textContent = "Not sent. Try again?";
      // Explain the failure clearly without making the controls a second line.
      status.textContent = "Feedback could not be sent. Please try again.";
      status.classList.add("feedback-sr-only");
      status.hidden = false;
    } finally {
      sending = false;
      if (!submitted) buttons.forEach(b => { b.disabled = false; });
    }
  }));
});
