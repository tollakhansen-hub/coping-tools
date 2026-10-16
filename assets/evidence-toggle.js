/* Progressive enhancement: without JavaScript, the complete evidence stays visible. */
document.querySelectorAll("[data-evidence-disclosure]").forEach(section => {
  const more = section.querySelector("[data-evidence-show]");
  const less = section.querySelector("[data-evidence-hide]");
  const expanded = section.querySelector("[data-evidence-extra]");
  if (!more || !less || !expanded) return;

  expanded.hidden = true;
  more.hidden = false;
  less.hidden = false;

  more.addEventListener("click", () => {
    expanded.hidden = false;
    more.hidden = true;
    more.setAttribute("aria-expanded", "true");
    const firstParagraph = expanded.querySelector("p");
    if (firstParagraph) {
      firstParagraph.setAttribute("tabindex", "-1");
      firstParagraph.focus({ preventScroll: true });
    }
  });

  less.addEventListener("click", () => {
    expanded.hidden = true;
    more.hidden = false;
    more.setAttribute("aria-expanded", "false");
    more.focus({ preventScroll: true });
  });
});
