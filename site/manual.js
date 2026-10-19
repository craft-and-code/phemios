/* Local chapter filtering only: no network, account, cookies or storage. */
const input = document.querySelector("#manual-search");
const entries = [...document.querySelectorAll("#manual-chapters [data-search]")];
const status = document.querySelector(".search-status");
const normalized = (value) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
input?.addEventListener("input", () => {
  const terms = normalized(input.value).trim().split(/\s+/).filter(Boolean);
  for (const entry of entries)
    entry.hidden = !terms.every((word) => normalized(entry.dataset.search).includes(word));
  status.textContent = terms.length
    ? `${entries.filter((entry) => !entry.hidden).length} / ${entries.length}`
    : "";
});
const compact = window.matchMedia("(max-width: 800px)");
const chapters = document.querySelector(".manual-sidebar details");
const adaptNavigation = () => {
  if (chapters) chapters.open = !compact.matches;
};
adaptNavigation();
compact.addEventListener("change", adaptNavigation);
