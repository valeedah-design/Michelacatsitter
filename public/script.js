(function () {
  'use strict';

  // ====== CONFIG — edit these before launch ======
  // WhatsApp number in international format, digits only (e.g. Italian mobile: "39" + number, no +, no spaces).
  var WHATSAPP_NUMBER = '39XXXXXXXXXX';
  var WHATSAPP_MESSAGE = 'Ciao Michela! Vorrei chiederti informazioni per il mio gatto.';
  // Link to Michela's existing Rover profile.
  var ROVER_URL = 'https://www.rover.com/';
  // Formspree (or similar) form endpoint. Leave empty to disable real submission (shows a friendly message instead).
  var CONTACT_FORM_ENDPOINT = '';
  // =================================================

  document.addEventListener('DOMContentLoaded', function () {
    setupLanguageToggle();
    setupWhatsappRoverLinks();
    setupCalendar();
    setupFaqAccordion();
    setupContactForm();
    setupFooterYear();
    loadContent();
  });

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
  }

  // ---------- WhatsApp / Rover links ----------
  function setupWhatsappRoverLinks() {
    var waHref = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(WHATSAPP_MESSAGE);
    document.querySelectorAll('.js-whatsapp-link').forEach(function (a) {
      a.setAttribute('href', waHref);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    });
    document.querySelectorAll('.js-rover-link').forEach(function (a) {
      a.setAttribute('href', ROVER_URL);
    });
    var waLabel = document.getElementById('wa-number-label');
    if (waLabel && WHATSAPP_NUMBER.indexOf('X') === -1) {
      waLabel.textContent = '+' + WHATSAPP_NUMBER;
    }
  }

  // ---------- availability calendar (demo — not connected to a real calendar) ----------
  function setupCalendar() {
    var dayButtons = document.querySelectorAll('.cal-day');
    var note = document.getElementById('cal-selected-note');
    var noteDay = document.getElementById('cal-selected-day');
    var cta = document.getElementById('cal-cta');
    var ctaText = document.getElementById('cal-cta-text');
    var monthLabel = document.getElementById('cal-month-label');
    var selectedDay = null;

    var lang = document.documentElement.getAttribute('data-lang') || 'it';
    var months = {
      it: ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'],
      en: ['January','February','March','April','May','June','July','August','September','October','November','December']
    };
    if (monthLabel) {
      var now = new Date();
      var mIt = months.it[now.getMonth()];
      var mEn = months.en[now.getMonth()];
      monthLabel.textContent = (lang === 'en' ? mEn : mIt) + ' ' + now.getFullYear();
    }

    function defaultCtaText() {
      return lang === 'en' ? 'Choose a free day' : 'Scegli un giorno libero qui accanto';
    }
    if (ctaText) { ctaText.textContent = defaultCtaText(); }

    dayButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        dayButtons.forEach(function (b) { b.classList.remove('is-selected'); });
        btn.classList.add('is-selected');
        selectedDay = btn.getAttribute('data-day');
        if (note) { note.classList.add('is-visible'); }
        if (noteDay) { noteDay.textContent = selectedDay; }
        if (ctaText) {
          ctaText.textContent = lang === 'en'
            ? ('Request the ' + selectedDay + ' — send now')
            : ('Richiedi il ' + selectedDay + ' — invia ora');
        }
        if (cta) { cta.classList.remove('is-sent'); }
      });
    });

    if (cta) {
      cta.addEventListener('click', function () {
        if (!selectedDay) { return; }
        if (ctaText) {
          ctaText.textContent = lang === 'en'
            ? ('Request sent for the ' + selectedDay + '! I will reply soon.')
            : ('Richiesta inviata per il ' + selectedDay + '! Ti rispondo a breve.');
        }
        cta.classList.add('is-sent');
      });
    }
  }

  // ---------- FAQ accordion ----------
  function setupFaqAccordion() {
    document.querySelectorAll('.faq-item').forEach(function (item) {
      var question = item.querySelector('.faq-question');
      if (!question) { return; }
      question.addEventListener('click', function () {
        item.classList.toggle('is-open');
      });
    });
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

  // ---------- dynamic images (logo / about photo / gallery) from the admin-managed content ----------
  function loadContent() {
    fetch('/api/content')
      .then(function (res) { return res.json(); })
      .then(applyContent)
      .catch(function () { /* site still works with placeholders if this fails */ });
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
