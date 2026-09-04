(function () {
  'use strict';

  var GALLERY_SIZE = 4;
  var statusEl = document.getElementById('status-message');

  document.addEventListener('DOMContentLoaded', function () {
    buildGalleryGrid();
    loadContent();
    wireLogout();
    wireUploadButtons();
    wireRemoveButtons();
    wireServiceAdd();
    wireTestimonialAdd();
    wireSaveAllButton();
  });

  function buildGalleryGrid() {
    var grid = document.getElementById('gallery-grid');
    if (!grid) return;
    var html = '';
    for (var i = 0; i < GALLERY_SIZE; i++) {
      html += ''
        + '<div class="gallery-item">'
        + '  <div class="slot-preview" id="preview-gallery-' + i + '"></div>'
        + '  <div class="slot-controls">'
        + '    <input type="file" id="file-gallery-' + i + '" accept="image/png,image/jpeg,image/webp,image/gif">'
        + '    <div style="display:flex; gap:8px;">'
        + '      <button class="admin-btn" data-slot="gallery-' + i + '" data-input="file-gallery-' + i + '">Carica</button>'
        + '      <button class="admin-btn-remove" data-slot="gallery-' + i + '">Rimuovi</button>'
        + '    </div>'
        + '  </div>'
        + '</div>';
    }
    grid.innerHTML = html;
  }

  function loadContent() {
    fetch('/admin/api/content').then(function (res) {
      if (res.status === 401) { window.location.href = '/admin/login'; return null; }
      return res.json();
    }).then(function (content) {
      if (content) { applyInitialContent(content); }
    });
  }

  // Full refresh from the server — used on first load and right after "Salva
  // modifiche" confirms a save. NOT used after a single photo upload/remove,
  // since that would wipe out any text edits the client hasn't saved yet.
  function applyInitialContent(content) {
    renderPreviews(content);
    fillContactSettingsForm(content);
    fillAvailabilitySettingsForm(content);
    renderServicesAdmin(content.services || []);
    renderTestimonialsAdmin(content.testimonials || []);
  }

  function renderPreviews(content) {
    setPreview('preview-logo', content.logo, 'Nessun logo');
    setPreview('preview-hero', content.hero, '[FOTO]');
    setPreview('preview-about', content.about, '[FOTO DI MICHELA]');
    (content.gallery || []).forEach(function (src, i) {
      setPreview('preview-gallery-' + i, src, '[FOTO]');
    });
  }

  function setPreview(id, src, placeholderText) {
    var el = document.getElementById(id);
    if (!el) return;
    if (src) {
      el.innerHTML = '<img src="' + src + '?t=' + Date.now() + '" alt="">';
    } else {
      el.textContent = placeholderText;
    }
  }

  // Photos save immediately on upload/remove (unlike everything else on this
  // page) — only the photo previews are refreshed here, so an in-progress
  // edit to services/testimonials/links elsewhere on the page is untouched.
  function wireUploadButtons() {
    document.querySelectorAll('.admin-btn[data-slot]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slot = btn.getAttribute('data-slot');
        var inputId = btn.getAttribute('data-input');
        var input = document.getElementById(inputId);
        if (!input || !input.files || !input.files[0]) {
          setStatus('Scegli prima un file per "' + slot + '".', true);
          return;
        }
        var fd = new FormData();
        fd.append('slot', slot);
        fd.append('file', input.files[0]);
        setStatus('Caricamento in corso…', false);
        fetch('/admin/api/upload', { method: 'POST', body: fd })
          .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok) { throw new Error(result.data.error || 'Errore'); }
            renderPreviews(result.data.content);
            input.value = '';
            setStatus('Immagine aggiornata.', false);
          })
          .catch(function (err) { setStatus(err.message || 'Errore durante il caricamento.', true); });
      });
    });
  }

  function wireRemoveButtons() {
    document.querySelectorAll('.admin-btn-remove[data-slot]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slot = btn.getAttribute('data-slot');
        fetch('/admin/api/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot: slot })
        })
          .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
          .then(function (result) {
            if (!result.ok) { throw new Error(result.data.error || 'Errore'); }
            renderPreviews(result.data.content);
            setStatus('Immagine rimossa.', false);
          })
          .catch(function (err) { setStatus(err.message || 'Errore durante la rimozione.', true); });
      });
    });
  }

  function wireLogout() {
    var btn = document.getElementById('logout-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      fetch('/admin/logout', { method: 'POST' }).then(function () {
        window.location.href = '/admin/login';
      });
    });
  }

  // ---------- contact links (WhatsApp / Rover) — just fields, no per-section save ----------
  function fillContactSettingsForm(content) {
    var num = document.getElementById('settings-whatsapp-number');
    var msg = document.getElementById('settings-whatsapp-message');
    var rover = document.getElementById('settings-rover-url');
    if (num) num.value = (content.whatsappNumber && content.whatsappNumber.indexOf('X') === -1) ? content.whatsappNumber : '';
    if (msg) msg.value = content.whatsappMessage || '';
    if (rover) rover.value = content.roverUrl || '';
  }

  // ---------- availability confirmation — just fields, no per-section save ----------
  function fillAvailabilitySettingsForm(content) {
    var method = document.getElementById('settings-availability-method');
    var msgIt = document.getElementById('settings-availability-message-it');
    var msgEn = document.getElementById('settings-availability-message-en');
    var am = content.availabilityMessage || {};
    if (method) method.value = content.availabilityMethod === 'whatsapp' ? 'whatsapp' : 'message';
    if (msgIt) msgIt.value = am.it || '';
    if (msgEn) msgEn.value = am.en || '';
  }

  // ---------- services (Cosa faccio) — rows are edited/added/removed locally;
  // nothing hits the server until "Salva modifiche" is clicked ----------
  function renderServicesAdmin(services) {
    var list = document.getElementById('services-admin-list');
    if (!list) return;
    list.innerHTML = '';
    services.forEach(function (s) {
      list.appendChild(buildServiceRow(s));
    });
  }

  function buildServiceRow(s) {
    s = s || {};
    var row = document.createElement('div');
    row.className = 'admin-list-item';
    row.dataset.icon = ['home', 'clock', 'moon', 'paw'].indexOf(s.icon) !== -1 ? s.icon : 'paw';
    row.innerHTML = ''
      + '<div class="admin-field-row">'
      + '  <div class="admin-field"><label>Titolo (italiano)</label><input type="text" class="f-title-it" value="' + escHtml(s.titleIt) + '"></div>'
      + '  <div class="admin-field"><label>Titolo (inglese)</label><input type="text" class="f-title-en" value="' + escHtml(s.titleEn) + '"></div>'
      + '</div>'
      + '<div class="admin-field"><label>Descrizione (italiano)</label><textarea class="f-desc-it">' + escHtml(s.descIt) + '</textarea></div>'
      + '<div class="admin-field"><label>Descrizione (inglese)</label><textarea class="f-desc-en">' + escHtml(s.descEn) + '</textarea></div>'
      + '<div class="admin-field-row">'
      + '  <div class="admin-field"><label>Prezzo / nota (italiano)</label><input type="text" class="f-price-it" value="' + escHtml(s.priceIt) + '"></div>'
      + '  <div class="admin-field"><label>Prezzo / nota (inglese)</label><input type="text" class="f-price-en" value="' + escHtml(s.priceEn) + '"></div>'
      + '</div>'
      + '<div class="admin-list-actions">'
      + '  <button type="button" class="admin-btn-remove" data-action="remove">Rimuovi</button>'
      + '</div>';

    row.querySelector('[data-action="remove"]').addEventListener('click', function () {
      if (!window.confirm('Rimuovere questo servizio? Diventa definitivo quando premi "Salva modifiche".')) return;
      row.remove();
    });
    return row;
  }

  function wireServiceAdd() {
    var btn = document.getElementById('add-service-btn');
    var list = document.getElementById('services-admin-list');
    if (!btn || !list) return;
    btn.addEventListener('click', function () {
      var row = buildServiceRow({ icon: 'paw', titleIt: 'Nuovo servizio', titleEn: 'New service', descIt: '', descEn: '', priceIt: '', priceEn: '' });
      list.appendChild(row);
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var firstInput = row.querySelector('.f-title-it');
      if (firstInput) firstInput.focus();
    });
  }

  // ---------- testimonials (Recensioni) — same local-only pattern ----------
  function renderTestimonialsAdmin(testimonials) {
    var list = document.getElementById('testimonials-admin-list');
    if (!list) return;
    list.innerHTML = '';
    testimonials.forEach(function (t) {
      list.appendChild(buildTestimonialRow(t));
    });
  }

  function buildTestimonialRow(t) {
    t = t || {};
    var row = document.createElement('div');
    row.className = 'admin-list-item';
    row.innerHTML = ''
      + '<div class="admin-field"><label>Recensione (italiano)</label><textarea class="f-quote-it">' + escHtml(t.quoteIt) + '</textarea></div>'
      + '<div class="admin-field"><label>Recensione (inglese)</label><textarea class="f-quote-en">' + escHtml(t.quoteEn) + '</textarea></div>'
      + '<div class="admin-field"><label>Nome cliente</label><input type="text" class="f-name" value="' + escHtml(t.name) + '"></div>'
      + '<div class="admin-list-actions">'
      + '  <button type="button" class="admin-btn-remove" data-action="remove">Rimuovi</button>'
      + '</div>';

    row.querySelector('[data-action="remove"]').addEventListener('click', function () {
      if (!window.confirm('Rimuovere questa recensione? Diventa definitivo quando premi "Salva modifiche".')) return;
      row.remove();
    });
    return row;
  }

  function wireTestimonialAdd() {
    var btn = document.getElementById('add-testimonial-btn');
    var list = document.getElementById('testimonials-admin-list');
    if (!btn || !list) return;
    btn.addEventListener('click', function () {
      var row = buildTestimonialRow({ quoteIt: '', quoteEn: '', name: '' });
      list.appendChild(row);
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var firstInput = row.querySelector('.f-quote-it');
      if (firstInput) firstInput.focus();
    });
  }

  // ---------- the one save button at the bottom of the page ----------
  function wireSaveAllButton() {
    var btn = document.getElementById('save-all-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var body = {
        whatsappNumber: fieldValue('settings-whatsapp-number'),
        whatsappMessage: fieldValue('settings-whatsapp-message'),
        roverUrl: fieldValue('settings-rover-url'),
        availabilityMethod: fieldValue('settings-availability-method') || 'message',
        availabilityMessage: {
          it: fieldValue('settings-availability-message-it'),
          en: fieldValue('settings-availability-message-en'),
        },
        services: collectRows('#services-admin-list', function (row) {
          return {
            icon: row.dataset.icon || 'paw',
            titleIt: row.querySelector('.f-title-it').value,
            titleEn: row.querySelector('.f-title-en').value,
            descIt: row.querySelector('.f-desc-it').value,
            descEn: row.querySelector('.f-desc-en').value,
            priceIt: row.querySelector('.f-price-it').value,
            priceEn: row.querySelector('.f-price-en').value,
          };
        }),
        testimonials: collectRows('#testimonials-admin-list', function (row) {
          return {
            quoteIt: row.querySelector('.f-quote-it').value,
            quoteEn: row.querySelector('.f-quote-en').value,
            name: row.querySelector('.f-name').value,
          };
        }),
      };

      btn.disabled = true;
      setStatus('Salvataggio in corso…', false);
      fetch('/admin/api/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) { throw new Error(result.data.error || 'Errore'); }
          applyInitialContent(result.data.content);
          setStatus('Modifiche salvate ✓', false);
        })
        .catch(function (err) { setStatus(err.message || 'Errore durante il salvataggio.', true); })
        .then(function () { btn.disabled = false; });
    });
  }

  function collectRows(listSelector, readRow) {
    var list = document.querySelector(listSelector);
    if (!list) return [];
    return Array.prototype.map.call(list.querySelectorAll('.admin-list-item'), readRow);
  }

  function fieldValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function escHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', !!isError);
  }
})();
