(function () {
  try {
    const saved = window.localStorage.getItem("theme");
    const isDark = saved !== "light";
    document.documentElement.classList.toggle("dark", isDark);
  } catch {
    document.documentElement.classList.add("dark");
  }
})();
