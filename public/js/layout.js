
(function () {
  "use strict";

  const SA = (window.SA = window.SA || {});
  const cfg = SA.config;

  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9S14.6 18.3 12 21c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z"/>',
    "map-pin":
      '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    users:
      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2a5 5 0 0 1 4.5 4.8"/>',
    "user-check":
      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 11.5l2 2 3.5-3.5"/>',
    laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
    "moon-off": '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/><path d="M3 3l18 18"/>',
    bus: '<rect x="4" y="3" width="16" height="14" rx="2.5"/><path d="M4 11h16M8 21v-4M16 21v-4"/><path d="M8.5 14h.01M15.5 14h.01"/>',
    shield:
      '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6L12 3z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
    phone:
      '<path d="M5 4h3.5l1.8 4.5-2.3 1.5a11 11 0 0 0 6 6l1.5-2.3L20 15.5V19a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M4 20h16"/>',
    refresh:
      '<path d="M20 11a8 8 0 0 0-14-4.5L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4.5L20 15M20 20v-5h-5"/>',
    rocket:
      '<path d="M12 3c3.5 1.5 6 5 6 9l-2.5 3h-7L6 12c0-4 2.5-7.5 6-9z"/><circle cx="12" cy="10" r="1.6"/><path d="M8.5 15 6 19l4-1.5M15.5 15l2.5 4-4-1.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  };

  SA.icon = function (name, extraClass) {
    const cls = "icon" + (extraClass ? " " + extraClass : "");
    return (
      '<svg class="' + cls + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>'
    );
  };

  function injectSprite() {
    const symbols = Object.keys(ICONS)
      .map(function (name) {
        return '<symbol id="i-' + name + '" viewBox="0 0 24 24">' + ICONS[name] + "</symbol>";
      })
      .join("");
    const sprite =
      '<svg xmlns="http://www.w3.org/2000/svg" class="icon-sprite" aria-hidden="true" focusable="false">' +
      symbols +
      "</svg>";
    document.body.insertAdjacentHTML("afterbegin", sprite);
  }

  const NAV_ITEMS = [
    { id: "home", label: "Home", href: "index.html" },
    { id: "event", label: "The Event", href: "event.html" },
    { id: "about", label: "About", href: "about.html" },
    { id: "help", label: "Help", href: "help.html" },
  ];

  function renderHeader() {
    const host = document.querySelector("[data-site-header]");
    if (!host) return;

    const page = document.body.getAttribute("data-page");
    const links = NAV_ITEMS.map(function (item) {
      const current = item.id === page ? ' aria-current="page"' : "";
      return '<li><a class="site-nav__link" href="' + item.href + '"' + current + ">" + item.label + "</a></li>";
    }).join("");

    const registerCurrent = page === "register" ? ' aria-current="page"' : "";

    host.innerHTML =
      '<div class="site-header__inner container">' +
      '<a class="brand" href="index.html" aria-label="Space Apps Jordan 2026, home">' +
      '<img class="brand__mark" src="assets/icons/Space_Apps_logo_IRBID.jpg" alt="" width="36" height="36">' +
      '<span class="brand__text"><strong>Space Apps Jordan</strong><span>IRBID, Jordan 2026</span></span>' +
      "</a>" +
      '<nav class="site-nav" id="site-nav" aria-label="Primary">' +
      '<ul class="site-nav__list">' +
      links +
      "</ul>" +
      '<a class="btn btn--primary btn--sm site-nav__cta" href="register.html"' +
      registerCurrent +
      ">Register</a>" +
      "</nav>" +
      '<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Open menu">' +
      '<span class="nav-toggle__bars" aria-hidden="true"></span>' +
      "</button>" +
      "</div>";
  }

  const FOOTER_LINKS = [
    ["Home", "index.html"],
    ["About", "about.html"],
    ["The Event", "event.html"],
    ["Locations", "event.html#locations"],
    ["Challenges", "event.html#challenges"],
    ["Registration", "register.html"],
    ["FAQ", "help.html#faq"],
    ["Contact", "help.html#contact"],
  ];

  function externalLink(label, href) {
    return (
      '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + label +
      SA.icon("external", "icon--xs") + '<span class="sr-only"> (opens in a new tab)</span></a>'
    );
  }

  function renderFooter() {
    const host = document.querySelector("[data-site-footer]");
    if (!host) return;

    const siteLinks = FOOTER_LINKS.map(function (l) {
      return '<li><a href="' + l[1] + '">' + l[0] + "</a></li>";
    }).join("");

    host.innerHTML =
      '<div class="container">' +
      '<div class="footer__grid">' +
      '<div class="footer__brand">' +
      '<a class="brand" href="index.html" aria-label="Space Apps Jordan 2026, home">' +
      '<img class="brand__mark" src="assets/icons/Space_Apps_logo_IRBID.jpg" alt="" width="36" height="36" loading="lazy">' +
      '<span class="brand__text"><strong>Space Apps Jordan</strong><span>Jordan site</span></span></a>' +
      '<p class="footer__title">NASA Space Apps Challenge<br>IRBID, Jordan 2026</p>' +
      '<p class="footer__org"><span>Local organizer</span>Organized by <strong>MENA ORG</strong></p>' +
      "</div>" +
      '<nav class="footer__col" aria-labelledby="footer-site">' +
      '<h2 class="footer__heading" id="footer-site">Explore</h2>' +
      '<ul class="footer__list footer__list--two">' + siteLinks + "</ul></nav>" +
      '<nav class="footer__col" aria-labelledby="footer-official">' +
      '<h2 class="footer__heading" id="footer-official">Official Space Apps</h2>' +
      '<ul class="footer__list">' +
      "<li>" + externalLink("Global website", cfg.links.global) + "</li>" +
      "<li>" + externalLink("Participant terms", cfg.links.participantTerms) + "</li>" +
      "<li>" + externalLink("Resources", cfg.links.resources) + "</li>" +
      "</ul></nav>" +
      '<div class="footer__col">' +
      '<h2 class="footer__heading" id="footer-contact">Contact</h2>' +
      '<ul class="footer__list" aria-labelledby="footer-contact">' +
      '<li><a href="mailto:' + cfg.contact.email + '">' + cfg.contact.email + "</a></li>" +
      '<li><a href="' + cfg.contact.phoneHref + '">' + cfg.contact.phone + "</a></li>" +
      "</ul></div>" +
      "</div>" +
      '<div class="footer__bottom">' +
      '<p class="footer__legal">Independent local-event website operated by MENA ORG. Registering here does not replace registration on the official platform at spaceappschallenge.org, which is required to take part.</p>' +
      '<div class="footer__meta">' +
      "<p>&copy; 2026 NASA Space Apps Challenge, IRBID</p>" +
      '<ul class="footer__legal-links">' +
      "<li>" + externalLink("Privacy", cfg.links.privacy) + "</li>" +
      "<li>" + externalLink("Terms", cfg.links.terms) + "</li>" +
      "</ul>" +
      '<a class="footer__top" href="#top">Back to top</a>' +
      "</div></div></div>";
  }

  injectSprite();
  renderHeader();
  renderFooter();
})();
