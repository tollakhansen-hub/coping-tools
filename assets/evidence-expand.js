/* The text and references remain readable if JavaScript is unavailable. */
document.querySelectorAll("[data-evidence-expand]").forEach(section => {
  const lead = section.querySelector(".evidence-lead");
  const inlineRest = section.querySelector(".evidence-inline-rest");
  const extra = section.querySelector(".evidence-extra");
  const toggle = section.querySelector(".evidence-toggle");
  if (!lead || !inlineRest || !extra || !toggle) return;

  function setExpanded(expanded, keepFocus) {
    inlineRest.hidden = !expanded;
    extra.hidden = !expanded;
    toggle.hidden = false;
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "See less" : "See more";

    // Keep the control at the end of the last visible paragraph.
    const lastParagraph = expanded ? extra.querySelector(":scope > p:last-of-type") : null;
    (lastParagraph || lead).append(toggle);
    if (keepFocus) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener("click", () => {
    setExpanded(toggle.getAttribute("aria-expanded") !== "true", true);
  });
  setExpanded(false, false);
});
