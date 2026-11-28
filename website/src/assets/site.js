/* MasterVLSI website: mobile menu, scroll reveal, course filter and WhatsApp enquiry forms. */
(function () {
  document.documentElement.classList.add("js");
  var WHATSAPP = "919019232425";

  // Mobile menu
  var toggle = document.querySelector("[data-menu-toggle]");
  var panel = document.getElementById("mobile-nav");
  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      var open = panel.hasAttribute("hidden");
      if (open) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("menu-open", open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hasAttribute("hidden")) toggle.click();
    });
  }

  // Scroll reveal
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  } else items.forEach(function (el) { el.classList.add("is-in"); });

  // Course filter by phase
  var group = document.querySelector('[aria-label="Filter modules by phase"]');
  if (group) {
    var list = group.parentElement.querySelector("ol");
    var on = "bg-volt text-white border-volt".split(" ");
    var off = "bg-white border-rule text-slate hover:border-volt hover:text-volt".split(" ");
    group.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var phase = btn.firstChild.textContent.trim();
        group.querySelectorAll("button").forEach(function (b) {
          var active = b === btn;
          b.setAttribute("aria-pressed", String(active));
          (active ? off : on).forEach(function (c) { b.classList.remove(c); });
          (active ? on : off).forEach(function (c) { b.classList.add(c); });
          var count = b.querySelector("span");
          if (count) { count.classList.toggle("text-white/80", active); count.classList.toggle("text-volt", !active); }
        });
        list.querySelectorAll(":scope > li").forEach(function (li) {
          var tag = li.querySelector(".tag");
          li.style.display = phase === "All" || (tag && tag.textContent.trim() === phase) ? "" : "none";
        });
      });
    });
  }

  // Enquiry forms → WhatsApp with the message pre-filled
  var LEADS = {
    demo: "I'd like to book a free demo class.",
    enquiry: "I have an enquiry about the VLSI course.",
    corporate: "We'd like to discuss a design / verification engagement.",
  };
  document.querySelectorAll("form[data-intent]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var v = function (k) { return String(d.get(k) || "").trim(); };
      var lines = [
        "Hi MasterVLSI, " + (LEADS[form.getAttribute("data-intent")] || LEADS.enquiry),
        "Name: " + v("name"),
        v("org") && "Company: " + v("org"),
        v("mode") && "Mode: " + v("mode"),
        v("status") && "Current status: " + v("status"),
        v("message") && "Message: " + v("message"),
      ].filter(Boolean);
      window.open("https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(lines.join("\n")), "_blank", "noopener,noreferrer");
      var note = form.querySelector("[data-sent]");
      if (note) note.removeAttribute("hidden");
    });
  });

  // YouTube videos: play inside the card (privacy-friendly embed); without JavaScript the link opens YouTube.
  document.querySelectorAll("a[data-yt]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var id = a.getAttribute("data-yt");
      var box = document.createElement("div");
      box.className = "vframe";
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(id) + "?autoplay=1&rel=0&playsinline=1&modestbranding=1";
      f.title = a.getAttribute("aria-label") || "YouTube video";
      f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      f.allowFullscreen = true;
      box.appendChild(f);
      a.replaceWith(box);
    });
  });

  // "Show all" for long video lists
  document.querySelectorAll("[data-more]").forEach(function (btn) {
    var list = btn.closest("section").querySelector("[data-more-list]");
    if (!list) return;
    btn.removeAttribute("hidden");
    btn.addEventListener("click", function () { list.classList.add("show-all"); btn.remove(); });
  });

  // Faster page changes: start fetching an internal page as soon as the visitor hovers or touches its link.
  var prefetched = {};
  function prefetch(e) {
    var a = e.target.closest && e.target.closest("a[href^='/']");
    if (!a || a.target === "_blank" || /\.(jpg|png|webp|pdf)/.test(a.getAttribute("href"))) return;
    var url = a.getAttribute("href").split("#")[0];
    if (!url || url === location.pathname || prefetched[url]) return;
    prefetched[url] = true;
    var l = document.createElement("link");
    l.rel = "prefetch";
    l.href = url;
    document.head.appendChild(l);
  }
  document.addEventListener("mouseover", prefetch, { passive: true });
  document.addEventListener("touchstart", prefetch, { passive: true });
})();
