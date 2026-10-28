/* Optional one-line feedback. One independent answer per route per tab session. */
document.querySelectorAll("[data-tool-feedback]").forEach(section => {
  const page = section.dataset.feedbackPage;
  const question = section.querySelector(".tool-feedback-question");
  const choices = section.querySelector(".tool-feedback-options");
  const status = section.querySelector(".tool-feedback-status");
  const buttons = [...section.querySelectorAll("[data-feedback-vote]")];
  if (!page || !question || !choices || !status || buttons.length !== 2 || !window.fetch) return;

  // Page-specific key: voting here never blocks voting on another route.
  const sessionKey = "coping-feedback-v1:" + page;
  const hasVoted = () => {
    try { return sessionStorage.getItem(sessionKey) === "sent"; }
    catch { return false; }
  };
  const markVoted = () => {
    try { sessionStorage.setItem(sessionKey, "sent"); }
    catch { /* Feedback still succeeds if tab storage is unavailable. */ }
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
  if (submitted) thank();

  buttons.forEach(button => button.addEventListener("click", async () => {
    if (sending || submitted) return;
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
