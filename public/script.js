(function () {
  'use strict';

  // ====== CONFIG — fallback defaults, used until /api/content loads (or if a
  // field was never set in the admin panel). Everything here is also editable
  // by the client from Impostazioni contatti / Disponibilità in the admin panel. ======
  var WHATSAPP_NUMBER = '393519563921';
  var WHATSAPP_MESSAGE = 'Ciao Michela! Vorrei chiederti informazioni per il mio gatto.';
  var ROVER_URL = 'https://www.rover.com/members/michela-u-passeggiate-giochi-e-tanto-amore/?pet_type=cat&service_type=drop-in&location=Napoli%2C+Campania&location_type=city';
  // Formspree (or similar) form endpoint. Leave empty to disable real submission (shows a friendly message instead).
  var CONTACT_FORM_ENDPOINT = '';
  // =================================================

  // Icons available for admin-added services (see SERVICE_ICONS below).
  var SERVICE_ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V10"/>',
    clock: '<circle cx="12" cy="12" r="4.2"/><path d="M12 3v2.2M12 18.8V21M4.2 12H2.5M21.5 12h-1.7M6 6l1.3 1.3M16.7 16.7 18 18M18 6l-1.3 1.3M7.3 16.7 6 18"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    paw: '<circle cx="8" cy="9" r="2.4"/><circle cx="16" cy="9" r="2.4"/><path d="M4.5 19c.4-2.8 2.3-4.3 3.5-4.3s3.1 1.5 3.5 4.3M12.5 19c.4-2.8 2.3-4.3 3.5-4.3s3.1 1.5 3.5 4.3"/>'
  };

  // The last content.json fetched from the server. Read (not copied) by the
  // calendar's click handler and by applyLang, so it always reflects the
  // latest fetch even though those were wired up before the fetch resolved.
  var siteContent = {};

  document.addEventListener('DOMContentLoaded', function () {
    setupLanguageToggle();
    setupWhatsappRoverLinks({});
    setupMobileNav();
    setupCalendar();
    setupContactForm();
    setupFooterYear();
    loadContent();
  });

  // ---------- mobile/tablet nav drawer ----------
  function setupMobileNav() {
    var btn = document.getElementById('mobile-menu-btn');
    var nav = document.getElementById('mobile-nav');
    if (!btn || !nav) return;
    btn.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    // Tapping a link closes the drawer so the page can scroll to the section.
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---------- language toggle ----------
  function setupLanguageToggle() {
    var stored = null;
    try { stored = localStorage.getItem('michela-lang'); } catch (e) { /* ignore */ }
    var lang = stored === 'en' ? 'en' : 'it';
    applyLang(lang);

    var buttons = document.querySelectorAll('[data-set-lang]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyLang(btn.getAttribute('data-set-lang'));
      });
    });
  }

  function applyLang(lang) {
    document.documentElement.setAttribute('data-lang', lang);
    // Every bilingual span ships with a hardcoded `hidden` attribute on the EN
    // copy (so the page still looks right before JS runs). That attribute
    // never clears on its own — without this loop, switching to EN would
    // update data-lang but every EN span would stay hidden forever.
    document.querySelectorAll('[data-i18n-lang]').forEach(function (el) {
      el.hidden = el.getAttribute('data-i18n-lang') !== lang;
    });
    document.querySelectorAll('[data-set-lang]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-set-lang') === lang);
    });
    document.querySelectorAll('[data-i18n-placeholder-it]').forEach(function (field) {
      var text = lang === 'en'
        ? field.getAttribute('data-i18n-placeholder-en')
        : field.getAttribute('data-i18n-placeholder-it');
      if (text) { field.setAttribute('placeholder', text); }
    });
    try { localStorage.setItem('michela-lang', lang); } catch (e) { /* ignore */ }
    // Re-render admin-managed lists/text in the newly selected language.
    if (siteContent.services) { renderServices(siteContent.services); }
    if (siteContent.testimonials) { renderTestimonials(siteContent.testimonials); }
    if (siteContent.faqs) { renderFaqs(siteContent.faqs); }
    if (siteContent.footerTagline) { renderFooterInfo(siteContent); }
  }

  // ---------- WhatsApp / Rover links (client-editable via admin panel) ----------
  function setupWhatsappRoverLinks(content) {
    content = content || {};
    var number = (content.whatsappNumber && content.whatsappNumber.indexOf('X') === -1) ? content.whatsappNumber : WHATSAPP_NUMBER;
    var message = content.whatsappMessage || WHATSAPP_MESSAGE;
    var roverUrl = content.roverUrl || ROVER_URL;
    var waHref = 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
    document.querySelectorAll('.js-whatsapp-link').forEach(function (a) {
      a.setAttribute('href', waHref);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
    document.querySelectorAll('.js-rover-link').forEach(function (a) {
      a.setAttribute('href', roverUrl);
    });
    var waLabel = document.getElementById('wa-number-label');
    if (waLabel && number.indexOf('X') === -1) {
      waLabel.textContent = '+' + number;
    }
  }

  // ---------- services (Cosa faccio — client-editable via admin panel) ----------
  function renderServices(services) {
    var grid = document.getElementById('services-grid');
    if (!grid || !Array.isArray(services)) return;
    var lang = document.documentElement.getAttribute('data-lang') || 'it';
    var rotations = ['-1.5deg', '1deg', '-1deg', '1.5deg', '-1.2deg', '1.2deg'];
    grid.innerHTML = services.map(function (s, i) {
      var icon = SERVICE_ICONS[s.icon] || SERVICE_ICONS.paw;
      var rot = rotations[i % rotations.length];
      var iconRot = (i % 2 === 0) ? '6deg' : '-6deg';
      var title = lang === 'en' ? (s.titleEn || s.titleIt) : (s.titleIt || s.titleEn);
      var desc = lang === 'en' ? (s.descEn || s.descIt) : (s.descIt || s.descEn);
      var price = lang === 'en' ? (s.priceEn || s.priceIt) : (s.priceIt || s.priceEn);
      return ''
        + '<div class="card" style="display:flex; flex-direction:column; gap:18px; box-shadow:none; background:var(--paper); transform:rotate(' + rot + ');">'
        + '<div style="width:56px; height:56px; border-radius:16px; background:var(--brand-pale); display:flex; align-items:center; justify-content:center; transform:rotate(' + iconRot + ');">'
        + '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icon + '</svg>'
        + '</div>'
        + '<h3 style="font-size:20px;">' + escapeHtml(title) + '</h3>'
        + '<p style="font-size:15px; line-height:1.6; opacity:0.75;">' + escapeHtml(desc) + '</p>'
        + '<span style="font-weight:800; font-size:15px; color:var(--brand); margin-top:auto; padding-top:8px;">' + escapeHtml(price) + '</span>'
        + '</div>';
    }).join('');
  }

  // ---------- testimonials (Recensioni — client-editable via admin panel) ----------
  function renderTestimonials(testimonials) {
    var grid = document.getElementById('testimonials-grid');
    if (!grid || !Array.isArray(testimonials) || !testimonials.length) return;
    var lang = document.documentElement.getAttribute('data-lang') || 'it';
    var rotations = ['-2deg', '1.5deg', '-1.5deg', '2deg'];
    var star = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6Z"/></svg>';
    var stars = new Array(5).join(star) + star; // 5 stars without relying on String.prototype.repeat
    grid.innerHTML = testimonials.map(function (t, i) {
      var rot = rotations[i % rotations.length];
      var quote = lang === 'en' ? (t.quoteEn || t.quoteIt) : (t.quoteIt || t.quoteEn);
      return ''
        + '<div class="card" style="display:flex; flex-direction:column; gap:16px; background:var(--paper); box-shadow:none; transform:rotate(' + rot + ');">'
        + '<div style="display:flex; gap:4px; color:var(--brand-light);">' + stars + '</div>'
        + '<p style="font-size:15px; line-height:1.6; font-style:italic; opacity:0.8;">"' + escapeHtml(quote) + '"</p>'
        + '<span style="font-weight:800; font-size:14px;">— ' + escapeHtml(t.name || '') + '</span>'
        + '</div>';
    }).join('');
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- FAQ (client-editable via admin panel) ----------
  // Which items are expanded is tracked here (by index) so switching language
  // re-renders the text without collapsing whatever the visitor had open.
  var faqOpenState = null;
  function renderFaqs(faqs) {
    var list = document.getElementById('faq-list');
    if (!list || !Array.isArray(faqs)) return;
    var lang = document.documentElement.getAttribute('data-lang') || 'it';
    if (!faqOpenState || faqOpenState.length !== faqs.length) {
      faqOpenState = faqs.map(function (_, i) { return i === 0; });
    }
    list.innerHTML = faqs.map(function (f, i) {
      var q = lang === 'en' ? (f.questionEn || f.questionIt) : (f.questionIt || f.questionEn);
      var a = lang === 'en' ? (f.answerEn || f.answerIt) : (f.answerIt || f.answerEn);
      return ''
        + '<div class="card faq-item' + (faqOpenState[i] ? ' is-open' : '') + '" data-idx="' + i + '" style="background:var(--white); box-shadow:none; border:1.5px solid var(--brand-pale); padding:24px 28px;">'
        + '<button type="button" class="faq-question">'
        + '<h3 style="font-size:17px;">' + escapeHtml(q) + '</h3>'
        + '<svg class="faq-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
        + '</button>'
        + '<p class="faq-answer">' + escapeHtml(a) + '</p>'
        + '</div>';
    }).join('');

    list.querySelectorAll('.faq-item').forEach(function (item) {
      var question = item.querySelector('.faq-question');
      if (!question) return;
      question.addEventListener('click', function () {
        var isOpen = item.classList.toggle('is-open');
        var idx = parseInt(item.getAttribute('data-idx'), 10);
        if (!isNaN(idx)) faqOpenState[idx] = isOpen;
      });
    });
  }

  // ---------- footer info (client-editable via admin panel) ----------
  function renderFooterInfo(content) {
    var lang = document.documentElement.getAttribute('data-lang') || 'it';
    var tagline = document.getElementById('footer-tagline');
    if (tagline) {
      var tg = content.footerTagline || {};
      tagline.textContent = (lang === 'en' ? (tg.en || tg.it) : (tg.it || tg.en)) || '';
    }
    var email = document.getElementById('footer-email');
    if (email) email.textContent = content.footerEmail || '';
    var phone = document.getElementById('footer-phone');
    if (phone) phone.textContent = content.footerPhone || '';
    var city = document.getElementById('footer-city');
    if (city) city.textContent = content.footerCity || '';

    var ig = document.getElementById('footer-instagram');
    if (ig) {
      if (content.socialInstagramUrl) {
        ig.href = content.socialInstagramUrl;
        ig.style.display = '';
      } else {
        ig.style.display = 'none';
      }
    }
    var fb = document.getElementById('footer-facebook');
    if (fb) {
      if (content.socialFacebookUrl) {
        fb.href = content.socialFacebookUrl;
        fb.style.display = '';
      } else {
        fb.style.display = 'none';
      }
    }
  }

  var CAL_MONTH_NAMES = {
    it: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  };
  var CAL_MAX_MONTHS_AHEAD = 12; // how far into the future clients can navigate

  // Re-render function for the currently displayed month, set once setupCalendar()
  // runs and called again from applyContent() once content.blockedDates has
  // actually loaded (the calendar first renders with nothing blocked yet, since
  // the fetch hasn't resolved when the page's other click handlers get wired up).
  var renderCalendar = null;

  // ---------- availability calendar — defaults to the current month, click
  // #cal-prev/#cal-next to browse forward; blocked days come from the admin
  // panel's calendar (content.blockedDates) ----------
  function setupCalendar() {
    var grid = document.getElementById('cal-grid');
    var monthLabel = document.getElementById('cal-month-label');
    var prevBtn = document.getElementById('cal-prev');
    var nextBtn = document.getElementById('cal-next');
    var note = document.getElementById('cal-selected-note');
    var noteDay = document.getElementById('cal-selected-day');
    var cta = document.getElementById('cal-cta');
    var ctaText = document.getElementById('cal-cta-text');
    if (!grid) return;

    var today = new Date();
    var todayY = today.getFullYear(), todayM = today.getMonth(), todayD = today.getDate();
    var viewYear = todayY, viewMonth = todayM;
    var selectedIso = null;
    var selectedLabel = null;

    function lang() { return document.documentElement.getAttribute('data-lang') || 'it'; }
    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function isoDate(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }
    function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
    // Mon=0 .. Sun=6, to match the L M M G V S D header already in the page.
    function firstWeekdayMon0(y, m) { return (new Date(y, m, 1).getDay() + 6) % 7; }
    function defaultCtaText() { return lang() === 'en' ? 'Choose a free day' : 'Scegli un giorno libero qui accanto'; }
    function resetSelection() {
      selectedIso = null; selectedLabel = null;
      if (note) note.classList.remove('is-visible');
      if (ctaText) ctaText.textContent = defaultCtaText();
      if (cta) cta.classList.remove('is-sent');
    }

    function render() {
      var l = lang();
      if (monthLabel) monthLabel.textContent = CAL_MONTH_NAMES[l][viewMonth] + ' ' + viewYear;

      var blocked = {};
      (siteContent.blockedDates || []).forEach(function (d) { blocked[d] = true; });

      var lead = firstWeekdayMon0(viewYear, viewMonth);
      var total = daysInMonth(viewYear, viewMonth);
      var html = '';
      for (var i = 0; i < lead; i++) html += '<div class="cal-cell"></div>';
      for (var d = 1; d <= total; d++) {
        var iso = isoDate(viewYear, viewMonth, d);
        var isPast = viewYear < todayY || (viewYear === todayY && viewMonth < todayM) || (viewYear === todayY && viewMonth === todayM && d < todayD);
        var isToday = viewYear === todayY && viewMonth === todayM && d === todayD;
        if (isPast || blocked[iso]) {
          html += '<div class="cal-cell cal-booked"><span>' + d + '</span></div>';
        } else {
          html += '<button type="button" class="cal-cell cal-day' + (isToday ? ' is-today' : '') + (iso === selectedIso ? ' is-selected' : '') + '" data-date="' + iso + '" data-day="' + d + '"><span>' + d + '</span></button>';
        }
      }
      var trail = (7 - ((lead + total) % 7)) % 7;
      for (var t = 0; t < trail; t++) html += '<div class="cal-cell"></div>';
      grid.innerHTML = html;

      grid.querySelectorAll('.cal-day').forEach(function (btn) {
        btn.addEventListener('click', function () {
          grid.querySelectorAll('.cal-day').forEach(function (b) { b.classList.remove('is-selected'); });
          btn.classList.add('is-selected');
          selectedIso = btn.getAttribute('data-date');
          var dayNum = btn.getAttribute('data-day');
          selectedLabel = dayNum + ' ' + CAL_MONTH_NAMES[lang()][viewMonth];
          if (note) note.classList.add('is-visible');
          if (noteDay) noteDay.textContent = selectedLabel;
          if (ctaText) {
            ctaText.textContent = lang() === 'en'
              ? ('Request ' + selectedLabel + ' — send now')
              : ('Richiedi il ' + selectedLabel + ' — invia ora');
          }
          if (cta) cta.classList.remove('is-sent');
        });
      });

      var monthsAhead = (viewYear - todayY) * 12 + (viewMonth - todayM);
      if (prevBtn) prevBtn.disabled = monthsAhead <= 0;
      if (nextBtn) nextBtn.disabled = monthsAhead >= CAL_MAX_MONTHS_AHEAD;
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (prevBtn.disabled) return;
        viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        resetSelection();
        render();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (nextBtn.disabled) return;
        viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        resetSelection();
        render();
      });
    }

    if (ctaText) ctaText.textContent = defaultCtaText();

    if (cta) {
      cta.addEventListener('click', function () {
        if (!selectedIso) return;
        var l = lang();
        // Clicking a free day always opens WhatsApp with the selected date
        // filled into the client's message template (admin > Disponibilità).
        // siteContent is read live here, not copied at setup time, so it
        // always reflects the latest fetched content.
        var msgObj = siteContent.availabilityMessage || {};
        var template = (l === 'en' ? msgObj.en : msgObj.it) || defaultAvailabilityMessage(l);
        var text = template.replace('{giorno}', selectedLabel).replace('{day}', selectedLabel);
        var number = (siteContent.whatsappNumber && siteContent.whatsappNumber.indexOf('X') === -1) ? siteContent.whatsappNumber : WHATSAPP_NUMBER;
        window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
        if (ctaText) ctaText.textContent = l === 'en' ? 'Opening WhatsApp…' : 'Apertura di WhatsApp…';
        cta.classList.add('is-sent');
      });
    }

    function defaultAvailabilityMessage(l) {
      return l === 'en'
        ? ('Hi Michela! I would like to book for ' + selectedLabel + ' — is it available?')
        : ('Ciao Michela! Vorrei prenotare per il ' + selectedLabel + ', è disponibile?');
    }

    render();
    renderCalendar = render;
  }

  // ---------- contact form ----------
  function setupContactForm() {
    var form = document.getElementById('contact-form');
    var status = document.getElementById('contact-form-status');
    if (!form) { return; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lang = document.documentElement.getAttribute('data-lang') || 'it';

      if (!CONTACT_FORM_ENDPOINT) {
        if (status) {
          status.textContent = lang === 'en'
            ? 'Form not connected yet — message Michela on WhatsApp for now.'
            : 'Modulo non ancora collegato — nel frattempo scrivi su WhatsApp.';
        }
        return;
      }

      if (status) { status.textContent = lang === 'en' ? 'Sending…' : 'Invio in corso…'; }
      fetch(CONTACT_FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form)
      }).then(function (res) {
        if (res.ok) {
          form.reset();
          status.textContent = lang === 'en' ? 'Message sent — thank you!' : 'Messaggio inviato — grazie!';
        } else {
          status.textContent = lang === 'en' ? 'Something went wrong, please try again.' : 'Qualcosa è andato storto, riprova.';
        }
      }).catch(function () {
        status.textContent = lang === 'en' ? 'Something went wrong, please try again.' : 'Qualcosa è andato storto, riprova.';
      });
    });
  }

  function setupFooterYear() {
    var el = document.getElementById('footer-year');
    if (el) { el.textContent = new Date().getFullYear(); }
  }

  // ---------- content from the admin panel (images, links, services, testimonials, availability) ----------
  function loadContent() {
    fetch('/api/content')
      .then(function (res) { return res.json(); })
      .then(function (content) {
        siteContent = content || {};
        applyContent(siteContent);
      })
      .catch(function () { /* site still works with placeholders/defaults if this fails */ });
  }

  function applyContent(content) {
    if (content.logo) {
      ['logo-header', 'logo-footer'].forEach(function (id) {
        var img = document.getElementById(id);
        if (img) { img.src = content.logo; }
      });
    }
    setPhotoSlot('photo-hero', content.hero);
    setPhotoSlot('photo-about', content.about);
    (content.gallery || []).forEach(function (src, i) {
      setPhotoSlot('photo-gallery-' + i, src);
    });
    setupWhatsappRoverLinks(content);
    renderServices(content.services);
    renderTestimonials(content.testimonials);
    renderFaqs(content.faqs);
    renderFooterInfo(content);
    if (renderCalendar) renderCalendar();
  }

  function setPhotoSlot(id, src) {
    var el = document.getElementById(id);
    if (!el) { return; }
    var img = el.querySelector('img');
    if (src) {
      if (img) { img.src = src; }
      el.classList.add('has-photo');
    } else {
      el.classList.remove('has-photo');
    }
  }
})();
