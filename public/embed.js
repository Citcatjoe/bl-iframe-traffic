/* Trafic aux traversées alpines — intégration :
 *   <div data-bl-traffic data-point="gothard"></div>
 *   <script src="https://host/embed.js" async></script>
 * data-point (facultatif) : gothard | san-bernardino | simplon | grand-st-bernard
 * data-src (facultatif) : URL du widget, par défaut l'origine de ce script.
 */
(function () {
  var script = document.currentScript;
  var defaultSrc = script && script.src ? new URL("/", script.src).href : "/";
  var frames = [];

  function mount(el) {
    if (el.getAttribute("data-bl-traffic-mounted")) return;
    el.setAttribute("data-bl-traffic-mounted", "1");
    var url = new URL(el.getAttribute("data-src") || defaultSrc, location.href);
    var point = el.getAttribute("data-point");
    if (point) url.searchParams.set("point", point);
    var iframe = document.createElement("iframe");
    iframe.src = url.href;
    iframe.title = "Trafic aux traversées alpines";
    iframe.loading = "lazy";
    iframe.setAttribute("scrolling", "no");
    iframe.style.cssText = "display:block;width:100%;border:0;height:" + (point ? 520 : 360) + "px;";
    el.appendChild(iframe);
    frames.push(iframe);
  }

  window.addEventListener("message", function (e) {
    var data = e.data;
    if (!data || data.type !== "bl-traffic:height" || typeof data.height !== "number") return;
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) {
        frames[i].style.height = Math.ceil(data.height) + "px";
        return;
      }
    }
  });

  function init() {
    var els = document.querySelectorAll("[data-bl-traffic]");
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
