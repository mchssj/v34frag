// Mismo criterio que ThemeProvider: "system" sigue al sistema operativo.
;(function () {
  var theme = "system"
  try {
    theme = localStorage.getItem("csstv-theme") || "system"
  } catch (e) {}
  var dark =
    theme === "dark" ||
    (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.add(dark ? "dark" : "light")
})()
