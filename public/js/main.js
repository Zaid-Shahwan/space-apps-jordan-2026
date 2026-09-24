/* ==========================================================================
   main.js
   Site-wide UI behaviour that is not specific to the registration form:
     - Navigation (mobile menu, scroll state)
     - Launch countdown
     - Reveal-on-scroll
     - Motion preferences for the SVG orbit
     - EN / AR language switch (without page reload)
   Form logic lives in storage.js, validation.js, form.js and submission.js.
   ========================================================================== */
(function () {
  "use strict";

  const SA = (window.SA = window.SA || {});
  const cfg = SA.config;

  const prefersReducedMotion = function () {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  const Language = {
    STORAGE_KEY: "space_apps_language",
    dict: {
      en: {
        nav_home: "Home",
        nav_event: "The Event",
        nav_about: "About",
        nav_help: "Help",
        nav_register: "Register",
        footer_explore: "Explore",
        footer_official: "Official Space Apps",
        footer_contact: "Contact",
        footer_locations: "Locations",
        footer_challenges: "Challenges",
        footer_registration: "Registration",
        footer_faq: "FAQ",
        footer_local_organizer: "Local organizer",
        footer_organized_by: "Organized by",
        footer_legal: "Independent local-event website operated by MENA ORG. Registering here does not replace registration on the official platform at spaceappschallenge.org, which is required to take part.",
        footer_back_top: "Back to top",
        home_local_event: "Local event / Jordan",
        home_title_1: "The Next",
        home_title_2: "Frontier",
        home_lead: "One global challenge: in person in IRBID, or online from anywhere in the world.",
        home_text: "NASA Space Apps Challenge comes to IRBID, Jordan on 14–15 November 2026. Explore NASA's open data, build a solution with your team and present it to the judges.",
        home_place: "IRBID, Jordan / 2026",
        home_register_now: "Register now",
        home_explore_event: "Explore the event",
        home_days: "days",
        home_hours: "hours",
        home_minutes: "min",
        home_headline: "The largest global hackathon, now in Jordan",
        home_intro_1: "NASA Space Apps Challenge is the largest annual global hackathon, bringing together a worldwide community of innovators to use NASA's data and Space Agency Partner data to address real-world challenges on Earth and in space.",
        home_intro_2: "MENA ORG is hosting the NASA Space Apps Challenge Local Event in IRBID, Jordan in 2026.",
        home_about_link: "About the event and organizer",
        home_choose: "Choose how to take part",
        home_choose_lead: "Join in person in IRBID, Jordan, or online from anywhere in the world.",
        home_in_person: "In person",
        home_online: "Online",
        home_location: "Location",
        home_participation: "Participation",
        home_register_in_person: "Register in person",
        home_register_online: "Register online",
        home_event_flow: "What happens at the hackathon",
        home_event_flow_sub: "Two days, six stages, from open data to a finished project.",
        home_event_cta: "The Next Frontier is ahead.",
        home_event_cta_text: "Register your team for 14–15 November 2026.",
        home_register_2026: "Register for 2026",
        event_page_badge: "14–15 November 2026",
        event_page_title: "NASA Space Apps Challenge 2026",
        event_page_lead: "A two-day innovation experience in IRBID, Jordan, and online.",
        event_participants: "Participants will",
        event_details: "Event details",
        event_date: "Date",
        event_location: "Location",
        event_duration: "Duration",
        event_who: "Who can participate?",
        event_who_lead: "Bring your skills, ideas and curiosity, and collaborate with others to create innovative solutions.",
        event_flow_title: "What happens at the hackathon?",
        event_choose: "Choose how to take part",
        event_choose_lead: "In person in IRBID, Jordan, or online from anywhere in the world. Pick the option that suits your team, then register.",
        event_challenges: "2026 challenges",
        event_challenges_text: "Challenge statements are written and released by NASA for every Space Apps edition. When the 2026 statements are published, they will appear here for the IRBID local event.",
        event_follow: "Follow the official 2026 announcements",
        about_badge: "Local event / Jordan",
        about_title: "About NASA Space Apps Challenge",
        about_lead: "The largest annual global hackathon, bringing a worldwide community of innovators together around NASA's data.",
        about_jordan: "NASA Space Apps in Jordan",
        about_org: "Organized by MENA ORG",
        about_role: "Our role",
        about_founder: "Meet the founder",
        about_join: "Ready to join?",
        about_join_text: "Register your team for NASA Space Apps IRBID 2026.",
        help_badge: "Participant information",
        help_title: "Help",
        help_lead: "Answers to common questions, and how to reach the organizers.",
        help_faq: "Frequently asked questions",
        help_contact: "Contact us",
        help_local_organizer: "Local organizer",
        help_admin: "Admins only",
        register_badge: "Local event / Jordan",
        register_title_1: "Register",
        register_title_2: "Now",
        register_lead: "We're excited to have you on board for NASA Space Apps IRBID 2026.",
        register_text: "One team lead can submit a team of one to six. Take part in person in IRBID, Jordan, or online from anywhere in the world. The local form has six short steps, and your answers stay saved on this device until you submit them.",
        register_begin: "Before you begin",
        register_notes: "Participation notes",
        register_step_2: "This form is Step 2 of the official registration process.",
        register_global_site: "Open the global site",
        register_official_first: "Official registration first",
        register_in_person_irbid: "In person: IRBID",
        register_online_worldwide: "Online: worldwide",
        register_no_stay: "No overnight stay",
        register_transportation: "Transportation may be available",
        register_under_18: "Participants under 18",
        register_how: "How registration works",
        register_how_lead: "Two stages. You need both to take part.",
        register_stage_1: "Register on the official site",
        register_stage_1_text: "Every participant creates a profile and registers on spaceappschallenge.org. This is required for everyone and is not replaced by this form.",
        register_stage_2: "Register your team here",
        register_stage_2_text: "One team lead completes the six short steps below for a team of one to six, including themselves.",
        register_ready: "Have this ready",
        register_team: "Team registration",
        register_required: "Fields marked * are required. Your progress is saved on this device as you type.",
        countdown_before: "Until the event begins on 14 November",
        countdown_live: "The event is under way",
        countdown_after: "The 2026 event has finished",
        countdown_sr_before: "{days} days, {hours} hours and {minutes} minutes until the event begins on 14 November 2026.",
        countdown_sr_live: "The event is under way.",
        countdown_sr_after: "The 2026 event has finished.",
        admin_badge: "Organizers only",
        admin_title: "Team registrations",
        admin_lead: "Sign in to see the registered teams.",
        admin_sign_in: "Admin sign in",
        admin_email: "Email",
        admin_password: "Password",
        admin_sign_in_button: "Sign in",
        admin_refresh: "Refresh",
        admin_logout: "Logout",
        admin_registered_teams: "Registered teams",
        admin_participants: "Participants",
        admin_in_person_teams: "In-person teams (IRBID)",
        admin_online_teams: "Online teams",
        admin_search_placeholder: "Search by team name, member name, email or team ID",
      },
      ar: {
        nav_home: "الرئيسية",
        nav_event: "الحدث",
        nav_about: "من نحن",
        nav_help: "المساعدة",
        nav_register: "تسجيل",
        footer_explore: "استكشف",
        footer_official: "مسابقة ناسا",
        footer_contact: "تواصل",
        footer_locations: "المواقع",
        footer_challenges: "التحديات",
        footer_registration: "التسجيل",
        footer_faq: "الأسئلة الشائعة",
        footer_local_organizer: "المنظم المحلي",
        footer_organized_by: "تنظمها",
        footer_legal: "موقع فعالية محلية مستقل تديره MENA ORG. لا replacesي التسجيل هنا التسجيل الرسمي على منصة spaceappschallenge.org، وهو مطلوب للمشاركة.",
        footer_back_top: "عودة إلى الأعلى",
        home_local_event: "فعالية محلية / الأردن",
        home_title_1: "الحدود",
        home_title_2: "الآتية",
        home_lead: "تحدٍ عالمي واحد: حضور شخصي في اربد أو عبر الإنترنت من أي مكان في العالم.",
        home_text: "تصل مسابقة ناسا سبيس أبيبس إلى اربد في الأردن في 14–15 نوفمبر 2026. استكشف بيانات ناسا المفتوحة، وابنِ حلًا مع فريقك وقدمَه إلى الحكام.",
        home_place: "إربد، الأردن / 2026",
        home_register_now: "سجل الآن",
        home_explore_event: "استكشف الفعالية",
        home_days: "أيام",
        home_hours: "ساعات",
        home_minutes: "د",
        home_headline: "أكبر هاكاثون عالمي الآن في الأردن",
        home_intro_1: "مسابقة ناسا سبيس أبيبس هي أكبر هاكاثون عالمي سنوي، حيث يجتمع مجتمع عالمي من المبدعين لاستخدام بيانات ناسا وبيانات شركاء وكالة الفضاء لمعالجة تحديات حقيقية على الأرض وفي الفضاء.",
        home_intro_2: "تنظم MENA ORG فعالية ناسا سبيس أبيبس المحلية في إربد، الأردن في عام 2026.",
        home_about_link: "عن الفعالية والمنظم",
        home_choose: "اختر طريقة المشاركة",
        home_choose_lead: "انضم حضورياً في إربد، الأردن، أو عبر الإنترنت من أي مكان في العالم.",
        home_in_person: "حضورياً",
        home_online: "أونلاين",
        home_location: "الموقع",
        home_participation: "نوع المشاركة",
        home_register_in_person: "سجل حضورياً",
        home_register_online: "سجل عبر الإنترنت",
        home_event_flow: "ماذا يحدث في الهاكاثون؟",
        home_event_flow_sub: "يومان، ست مراحل، من البيانات المفتوحة إلى مشروع نهائي.",
        home_event_cta: "الحدود القادمة بين يديك.",
        home_event_cta_text: "سجل فريقك لـ 14–15 نوفمبر 2026.",
        home_register_2026: "سجل لعام 2026",
        event_page_badge: "14–15 نوفمبر 2026",
        event_page_title: "مسابقة ناسا سبيس أبيبس 2026",
        event_page_lead: "تجربة ابتكار لمدة يومين في إربد، الأردن، وعبر الإنترنت.",
        event_participants: "سيقوم المشاركون بـ",
        event_details: "تفاصيل الفعالية",
        event_date: "التاريخ",
        event_location: "الموقع",
        event_duration: "المدة",
        event_who: "من يمكنه المشاركة؟",
        event_who_lead: "مرر مهاراتك وأفكارك وفضولك، وعمل مع الآخرين لإنشاء حلول مبتكرة.",
        event_flow_title: "ماذا يحدث في الهاكاثون؟",
        event_choose: "اختر طريقة المشاركة",
        event_choose_lead: "حضورياً في إربد، الأردن، أو عبر الإنترنت من أي مكان في العالم. اختر الخيار الذي يناسب فريقك ثم سجل.",
        event_challenges: "تحديات 2026",
        event_challenges_text: "بيانات التحديات تُكتب وتُطلق من قِبل ناسا لكل نسخة من مسابقة سبيس أبيبس. عندما تُنشر بيانات 2026، ستظهر هنا لفعالية إربد المحلية.",
        event_follow: "تابع إعلانات 2026 الرسمية",
        about_badge: "فعالية محلية / الأردن",
        about_title: "حول مسابقة ناسا سبيس أبيبس",
        about_lead: "أكبر هاكاثون عالمي سنوي، يجمع مجتمع عالمي من المبدعين حول بيانات ناسا.",
        about_jordan: "ناسا سبيس أبيبس في الأردن",
        about_org: "تنظمها MENA ORG",
        about_role: "دورنا",
        about_founder: "تعرف على المؤسس",
        about_join: "هل أنت مستعد للانضمام؟",
        about_join_text: "سجل فريقك لمسابقـة ناسا سبيس أبيبس إربد 2026.",
        help_badge: "معلومات المشاركين",
        help_title: "المساعدة",
        help_lead: "إجابات عن الأسئلة الشائعة، وكيفية التواصل مع المنظمين.",
        help_faq: "الأسئلة الشائعة",
        help_contact: "تواصل معنا",
        help_local_organizer: "المنظم المحلي",
        help_admin: "للمشرفين فقط",
        register_badge: "فعالية محلية / الأردن",
        register_title_1: "سجل",
        register_title_2: "الآن",
        register_lead: "نحن متحمسون لوجودك معنا في NASA Space Apps IRBID 2026.",
        register_text: "يمكن لقائد الفريق تقديم فريق من شخص واحد إلى ستة أشخاص. شارك حضورياً في إربد أو عبر الإنترنت من أي مكان في العالم. النموذج المحلي يتكون من ست خطوات قصيرة، وتُحفظ إجاباتك على هذا الجهاز حتى تُرسل.",
        register_begin: "قبل البدء",
        register_notes: "ملاحظات المشاركة",
        register_step_2: "هذا النموذج هو الخطوة الثانية من عملية التسجيل الرسمية.",
        register_global_site: "افتح الموقع العالمي",
        register_official_first: "التسجيل الرسمي أولاً",
        register_in_person_irbid: "حضورياً: إربد",
        register_online_worldwide: "عبر الإنترنت: عالمي",
        register_no_stay: "لا إقامات ليلية",
        register_transportation: "قد تكون هناك خدمات نقل",
        register_under_18: "المشاركون تحت 18",
        register_how: "كيف يعمل التسجيل",
        register_how_lead: "مرحلتان. تحتاج إلى كليهما للمشاركة.",
        register_stage_1: "سجل في الموقع الرسمي",
        register_stage_1_text: "يُنشئ كل مشارك ملفه الشخصي ويسجل في spaceappschallenge.org. هذا مطلوب للجميع ولا يحل محل هذا النموذج.",
        register_stage_2: "سجل فريقك هنا",
        register_stage_2_text: "يُكمل قائد الفريق الخطوات الست القصيرة أدناه لفريق من شخص واحد إلى ستة أشخاص، بما في ذلك نفسه.",
        register_ready: "جهّز هذه المعلومات",
        register_team: "تسجيل الفريق",
        register_required: "الحقول الموسومة بـ * مطلوبة. يتم حفظ تقدمك على هذا الجهاز أثناء الكتابة.",
        countdown_before: "حتى يبدأ الحدث في 14 نوفمبر",
        countdown_live: "الحدث قيد التنفيذ",
        countdown_after: "انتهت فعالية 2026",
        countdown_sr_before: "{days} أيام، {hours} ساعات و{minutes} دقائق حتى يبدأ الحدث في 14 نوفمبر 2026.",
        countdown_sr_live: "الحدث قيد التنفيذ.",
        countdown_sr_after: "انتهت فعالية 2026.",
        admin_badge: "للمشرفين فقط",
        admin_title: "تسجيلات الفرق",
        admin_lead: "سجل الدخول لرؤية الفرق المسجلة.",
        admin_sign_in: "دخول المشرف",
        admin_email: "البريد الإلكتروني",
        admin_password: "كلمة المرور",
        admin_sign_in_button: "تسجيل الدخول",
        admin_refresh: "تحديث",
        admin_logout: "تسجيل الخروج",
        admin_registered_teams: "الفرق المسجلة",
        admin_participants: "المشاركون",
        admin_in_person_teams: "الفرق الحضورية (إربد)",
        admin_online_teams: "الفرق عبر الإنترنت",
        admin_search_placeholder: "ابحث باسم الفريق أو اسم العضو أو البريد الإلكتروني أو معرف الفريق",
      },
    },

    getCurrent: function () {
      try {
        const saved = window.localStorage.getItem(this.STORAGE_KEY);
        return saved === "ar" ? "ar" : "en";
      } catch (error) {
        return "en";
      }
    },

    translate: function (key, params) {
      const lang = this.getCurrent();
      const locale = this.dict[lang] || this.dict.en;
      const raw = locale[key] || this.dict.en[key] || key;
      if (!params) return raw;
      return raw.replace(/\{(\w+)\}/g, function (_, name) {
        return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : "{" + name + "}";
      });
    },

    apply: function () {
      const lang = this.getCurrent();
      const locale = this.dict[lang] || this.dict.en;
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
      document.body.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
      document.body.classList.toggle("rtl", lang === "ar");

      document.querySelectorAll("[data-i18n]").forEach(function (el) {
        const key = el.getAttribute("data-i18n");
        const text = locale[key] || this.dict.en[key];
        if (!text) return;

        const svgTextChild = Array.prototype.find.call(el.childNodes, function (node) {
          return node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0;
        });

        if (svgTextChild) {
          svgTextChild.textContent = text;
          return;
        }

        const span = el.querySelector("span[data-i18n-label]") || el.querySelector("span");
        if (span && span.parentElement === el) {
          span.textContent = text;
          return;
        }

        el.textContent = text;
      }, this);

      const trigger = document.querySelector(".lang-switch__trigger .lang-switch__label");
      if (trigger) trigger.textContent = lang.toUpperCase();

      document.querySelectorAll(".lang-switch__option").forEach(function (option) {
        const selected = option.getAttribute("data-lang") === lang;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-checked", String(selected));
      });
    },

    bind: function () {
      const root = document.querySelector(".lang-switch");
      if (!root) return;

      const trigger = root.querySelector(".lang-switch__trigger");
      const options = Array.prototype.slice.call(root.querySelectorAll(".lang-switch__option"));

      if (trigger) {
        trigger.addEventListener("click", function (event) {
          event.stopPropagation();
          root.classList.toggle("is-open");
          trigger.setAttribute("aria-expanded", String(root.classList.contains("is-open")));
        });
      }

      options.forEach(function (option) {
        option.addEventListener("click", function () {
          const next = option.getAttribute("data-lang");
          try {
            window.localStorage.setItem(this.STORAGE_KEY, next);
          } catch (error) {
            // Ignore storage failures silently.
          }
          root.classList.remove("is-open");
          if (trigger) trigger.setAttribute("aria-expanded", "false");
          this.apply();
          if (typeof SA.ui !== "undefined" && SA.ui.updateTexts) SA.ui.updateTexts();
        }.bind(this));
      }, this);

      document.addEventListener("click", function (event) {
        if (!root.contains(event.target)) {
          root.classList.remove("is-open");
          if (trigger) trigger.setAttribute("aria-expanded", "false");
        }
      });
    },

    init: function () {
      this.apply();
      this.bind();
    },
  };

  /* ---------------------------------------------------------------------
     Navigation
     --------------------------------------------------------------------- */
  const Nav = {
    init: function () {
      this.header = document.querySelector(".site-header");
      this.toggle = document.querySelector(".nav-toggle");
      this.panel = document.getElementById("site-nav");
      if (!this.header) return;

      this.updateScrollState();
      window.addEventListener("scroll", this.updateScrollState.bind(this), { passive: true });

      if (!this.toggle || !this.panel) return;

      this.toggle.addEventListener("click", this.handleToggle.bind(this));

      this.panel.addEventListener("click", (event) => {
        if (event.target.closest("a")) this.close();
      });

      document.addEventListener("click", (event) => {
        if (this.isOpen() && !this.header.contains(event.target)) this.close();
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.isOpen()) {
          this.close();
          this.toggle.focus();
        }
      });

      const desktop = window.matchMedia("(min-width: 900px)");
      const onChange = (event) => {
        if (event.matches) this.close();
      };
      if (desktop.addEventListener) desktop.addEventListener("change", onChange);
    },

    isOpen: function () {
      return this.toggle.getAttribute("aria-expanded") === "true";
    },

    handleToggle: function () {
      if (this.isOpen()) this.close();
      else this.open();
    },

    open: function () {
      this.toggle.setAttribute("aria-expanded", "true");
      this.toggle.setAttribute("aria-label", "Close menu");
      this.header.classList.add("is-menu-open");
    },

    close: function () {
      this.toggle.setAttribute("aria-expanded", "false");
      this.toggle.setAttribute("aria-label", "Open menu");
      this.header.classList.remove("is-menu-open");
    },

    updateScrollState: function () {
      this.header.classList.toggle("is-scrolled", window.scrollY > 8);
    },
  };

  /* ---------------------------------------------------------------------
     Countdown to the event start
     Markup: [data-countdown] containing [data-cd="days|hours|minutes"],
     an optional [data-cd-label] and an optional [data-cd-sr].
     --------------------------------------------------------------------- */
  const Countdown = {
    init: function () {
      this.roots = Array.prototype.slice.call(document.querySelectorAll("[data-countdown]"));
      if (!this.roots.length) return;
      this.start = new Date(cfg.eventStart).getTime();
      this.end = new Date(cfg.eventEnd).getTime();
      this.tick();
      window.setInterval(this.tick.bind(this), 30000);
    },

    tick: function () {
      const now = Date.now();
      let state = "before";
      let diff = this.start - now;
      if (now >= this.end) state = "after";
      else if (now >= this.start) state = "live";

      const days = Math.max(0, Math.floor(diff / 86400000));
      const hours = Math.max(0, Math.floor((diff % 86400000) / 3600000));
      const minutes = Math.max(0, Math.floor((diff % 3600000) / 60000));

      this.roots.forEach(function (root) {
        root.setAttribute("data-state", state);
        const set = function (key, value) {
          const el = root.querySelector('[data-cd="' + key + '"]');
          if (el) el.textContent = String(value).padStart(2, "0");
        };
        set("days", days);
        set("hours", hours);
        set("minutes", minutes);

        const label = root.querySelector("[data-cd-label]");
        const sr = root.querySelector("[data-cd-sr]");
        if (state === "before") {
          if (label) label.textContent = Language.translate("countdown_before");
          if (sr) sr.textContent = Language.translate("countdown_sr_before", { days: days, hours: hours, minutes: minutes });
        } else if (state === "live") {
          if (label) label.textContent = Language.translate("countdown_live");
          if (sr) sr.textContent = Language.translate("countdown_sr_live");
        } else {
          if (label) label.textContent = Language.translate("countdown_after");
          if (sr) sr.textContent = Language.translate("countdown_sr_after");
        }
      });
    },
  };

  /* ---------------------------------------------------------------------
     Reveal on scroll (CSS handles the animation; JS only toggles a class)
     --------------------------------------------------------------------- */
  const Reveal = {
    init: function () {
      const items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
      if (!items.length) return;

      if (!("IntersectionObserver" in window) || prefersReducedMotion()) {
        items.forEach(function (el) {
          el.classList.add("is-visible");
        });
        return;
      }

      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      items.forEach(function (el) {
        observer.observe(el);
      });
    },
  };

  /* ---------------------------------------------------------------------
     Orbit illustration: pause the SMIL satellite motion for users who
     prefer reduced motion.
     --------------------------------------------------------------------- */
  const Orbit = {
    init: function () {
      if (!prefersReducedMotion()) return;
      document.querySelectorAll("svg.orbit").forEach(function (svg) {
        if (typeof svg.pauseAnimations === "function") svg.pauseAnimations();
      });
    },
  };

  Nav.init();
  Language.init();
  Countdown.init();
  Reveal.init();
  Orbit.init();

  SA.ui = { prefersReducedMotion: prefersReducedMotion };
  SA.i18n = Language;
})();
