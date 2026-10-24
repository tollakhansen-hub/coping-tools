/* One small, optional feedback action per route. No browser identifiers or storage. */
document.querySelectorAll("[data-tool-feedback]").forEach(section => {
  const page = section.dataset.feedbackPage;
  const question = section.querySelector(".tool-feedback-question");
  const choices = section.querySelector(".tool-feedback-options");
  const status = section.querySelector(".tool-feedback-status");
  const buttons = [...section.querySelectorAll("[data-feedback-vote]")];
  if (!page || !question || !choices || !status || buttons.length !== 2 || !window.fetch) return;
  let sending = false;
  let submitted = false;
  section.hidden = false;

  buttons.forEach(button => button.addEventListener("click", async () => {
    if (sending || submitted) return;
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
      choices.hidden = true;
      status.textContent = "Thank you";
      status.hidden = false;
      question.textContent = "Was this useful?";
    } catch {
      question.textContent = "Try again?";
      // Announce the error without adding a second visual line.
      status.textContent = "Feedback could not be sent. Please try again.";
      status.hidden = false;
      status.classList.add("feedback-sr-only");
    } finally {
      sending = false;
      if (!submitted) buttons.forEach(b => { b.disabled = false; });
    }
  }));
});
