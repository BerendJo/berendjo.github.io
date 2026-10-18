/* Berend Joosen portfolio: language toggle, scroll reveal, hero intro. */
(() => {
  "use strict";

  const COPY = {
    nl: {
      title: "Berend Joosen | Graphic design portfolio 2026",
      skip: "Naar het werk",
      brandAria: "Berend Joosen, naar boven",
      navAria: "Hoofdmenu",
      langAria: "Taal",
      themeAria: "Donkere modus",
      navWork: "Werk",
      navAbout: "Over",
      navContact: "Contact",
      portraitAlt: "Zwart-wit portret van Berend Joosen",
      kicker: "graphic design 2026",
      lede: "Graphic designer uit Breda. Albumcovers, merkidentiteit, events en web.",
      cta: "Bekijk werk",
      skipProject: "Naar de inhoud",
      brandHomeAria: "Berend Joosen, naar de homepage",
      back: "Alle projecten",
      skills: "Vaardigheden",
      next: "Volgend project",
      contactTitle: "Interesse?",
      aboutTitle: "Over mij",
      aboutLead: "Ik ben een 24-jarige graphic designer uit Breda, gedreven door een sterke creatieve passie.",
      aboutP1: "Van het bouwen met LEGO tot schilderen: ik ben sinds klein kind al aangetrokken geweest tot hobby's en projecten waarin ik volledig kon opgaan in het creatieve proces. In de loop der jaren heeft diezelfde passie zich ontwikkeld tot een liefde voor foto- en videobewerking, grafisch ontwerp en, meer recentelijk, muziekproductie en dj'en.",
      aboutP2: "Creativiteit en out-of-the-box denken vormt de kern van alles wat ik doe: geef me iets om mijn creativiteit in te stoppen en ik breng het tot leven.",
      aboutBejo: "Als dj en producer draai en maak ik muziek onder de naam BEJO.",
      notFoundTitle: "Deze pagina bestaat niet.",
      notFoundText: "De link is verouderd of er zit een typfout in. Het werk staat gelukkig nog gewoon op de homepage.",
      notFoundCta: "Terug naar de homepage",
      workTitle: "Werk",
      workLede: "Vijf projecten, van rebranding en web tot albumcovers en evenementen.",
      altJde: "Reclamezuil met een Douwe Egberts campagne langs een straat",
      kindJde: "stage",
      descJde: "E-commerce, SEO en augmented reality bij Jacobs Douwe Egberts.",
      altEdufort: "Edufort website op een iPad en telefoon",
      kindEdufort: "afstudeerstage",
      descEdufort: "Nieuwe merkidentiteit en website voor een cybersecuritybedrijf.",
      altComm: "Vier albumcovers",
      kindComm: "commissies",
      descComm: "Albumcovers en logo's voor artiesten.",
      altKrak: "Drie Krakatoa posters met een groene en oranje vulkaanentiteit",
      kindKrak: "techno evenement",
      descKrak: "Posters, socials en podiumontwerp voor een terugkerende technonacht in Breda.",
      altMezz: "Poster 25 jaar MEZZ met een Nokia 3310",
      kindMezz: "opdracht",
      descMezz: "Visuele uiting en conceptvideo's voor 25 jaar MEZZ."
    },
    en: {
      title: "Berend Joosen | Graphic design portfolio 2026",
      skip: "Skip to the work",
      brandAria: "Berend Joosen, back to top",
      navAria: "Main menu",
      langAria: "Language",
      themeAria: "Dark mode",
      navWork: "Work",
      navAbout: "About",
      navContact: "Contact",
      portraitAlt: "Black and white portrait of Berend Joosen",
      kicker: "graphic design 2026",
      lede: "Graphic designer from Breda. Album covers, brand identity, events and web.",
      cta: "See work",
      skipProject: "Skip to the content",
      brandHomeAria: "Berend Joosen, go to the homepage",
      back: "All projects",
      skills: "Skills",
      next: "Next project",
      contactTitle: "Interested?",
      aboutTitle: "About me",
      aboutLead: "I'm a 24-year-old graphic designer from Breda, driven by a strong creative passion.",
      aboutP1: "From building with LEGO to painting: since I was a kid I've been drawn to hobbies and projects where I could lose myself in the creative process. Over the years that same passion grew into a love of photo and video editing, graphic design and, more recently, music production and DJing.",
      aboutP2: "Creativity and out-of-the-box thinking are at the core of everything I do: give me something to pour my creativity into and I'll bring it to life.",
      aboutBejo: "As a DJ and producer I play and make music under the name BEJO.",
      notFoundTitle: "This page doesn't exist.",
      notFoundText: "The link is out of date or has a typo. The work is still on the homepage.",
      notFoundCta: "Back to the homepage",
      workTitle: "Work",
      workLede: "Five projects, from rebranding and web to album covers and events.",
      altJde: "Street advertising column showing a Douwe Egberts campaign",
      kindJde: "internship",
      descJde: "E-commerce, SEO and augmented reality at Jacobs Douwe Egberts.",
      altEdufort: "Edufort website on an iPad and a phone",
      kindEdufort: "graduation internship",
      descEdufort: "New brand identity and website for a cybersecurity company.",
      altComm: "Four album covers",
      kindComm: "commissions",
      descComm: "Album covers and logos for artists.",
      altKrak: "Three Krakatoa posters with a green and orange volcano entity",
      kindKrak: "techno event",
      descKrak: "Posters, socials and stage design for a recurring techno night in Breda.",
      altMezz: "25 years of MEZZ poster with a Nokia 3310",
      kindMezz: "assignment",
      descMezz: "Key visual and concept videos for 25 years of MEZZ."
    }
  };

  /* project pages ship their own copy in window.PAGE_COPY; merge it in */
  if (window.PAGE_COPY) {
    Object.keys(window.PAGE_COPY).forEach((lang) => Object.assign(COPY[lang] || (COPY[lang] = {}), window.PAGE_COPY[lang]));
  }

  const root = document.documentElement;
  const buttons = document.querySelectorAll(".lang button");

  const store = {
    get() { try { return localStorage.getItem("lang"); } catch (_) { return null; } },
    set(v) { try { localStorage.setItem("lang", v); } catch (_) { /* private mode */ } }
  };

  function setLang(lang) {
    const dict = COPY[lang];
    if (!dict) return;
    root.lang = lang;
    document.title = dict.title;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      if (dict[el.dataset.i18n] != null) el.textContent = dict[el.dataset.i18n];
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
      if (dict[el.dataset.i18nAria] != null) el.setAttribute("aria-label", dict[el.dataset.i18nAria]);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
      if (dict[el.dataset.i18nAlt] != null) el.setAttribute("alt", dict[el.dataset.i18nAlt]);
    });
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    store.set(lang);
  }

  buttons.forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));

  /* theme: stored choice wins, otherwise the OS preference (CSS handles that case on its own) */
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const themeBtn = document.querySelector(".theme-toggle");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : darkQuery.matches);
  function syncTheme() {
    if (themeBtn) themeBtn.setAttribute("aria-pressed", String(isDark()));
    if (themeMeta) themeMeta.content = isDark() ? "#120f10" : "#fff4f4";
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (_) { /* private mode */ }
      syncTheme();
    });
  }
  darkQuery.addEventListener("change", syncTheme);
  syncTheme();

  const saved = store.get();
  const initial = saved || ((navigator.language || "nl").toLowerCase().startsWith("nl") ? "nl" : "en");
  if (initial !== "nl") setLang(initial);

  /* scroll reveal: IntersectionObserver, one-shot (no scroll listeners).
     ascii-reveal.js turns each block from ASCII art into the real thing; without it (or with
     reduced motion) the block just appears. */
  const reveals = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reveal = (el) => {
    const lib = window.AsciiLib;
    if (!reduceMotion && lib && lib.revealAscii) lib.revealAscii(el).catch(() => el.classList.add("in"));
    else el.classList.add("in");
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        reveal(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* stagger index for the intro letters */
  document.querySelectorAll(".hero-big .ch").forEach((el, i) => el.style.setProperty("--i", i));
})();
