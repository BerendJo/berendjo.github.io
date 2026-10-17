/* Berend Joosen portfolio: language toggle + hero pointer parallax. */
(() => {
  "use strict";

  const COPY = {
    nl: {
      title: "Berend Joosen | Graphic design portfolio 2026",
      skip: "Naar het werk",
      brandAria: "Berend Joosen, naar boven",
      navAria: "Hoofdmenu",
      langAria: "Taal",
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

  const saved = store.get();
  const initial = saved || ((navigator.language || "nl").toLowerCase().startsWith("nl") ? "nl" : "en");
  if (initial !== "nl") setLang(initial);

  /* scroll reveal: IntersectionObserver, one-shot (no scroll listeners) */
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  /* stagger index for the intro letters */
  document.querySelectorAll(".hero-big .ch").forEach((el, i) => el.style.setProperty("--i", i));

  /* hero parallax: pointer only, transform via CSS vars, eased in rAF */
  const hero = document.querySelector(".hero");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (hero && fine.matches && !calm.matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;

    const tick = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      hero.style.setProperty("--px", cx.toFixed(3));
      hero.style.setProperty("--py", cy.toFixed(3));
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(tick) : 0;
    };

    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(tick);
    });
    hero.addEventListener("pointerleave", () => {
      tx = ty = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }
})();
