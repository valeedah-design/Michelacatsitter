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
    wireContactSettingsForm();
    wireAvailabilitySettingsForm();
    wireServiceAdd();
    wireTestimonialAdd();
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
      if (content) { applyContent(content); }
    });
  }

  // Re-renders every panel from a fresh content object — called after the
  // initial load and after every save/add/remove, so the dashboard always
  // reflects exactly what's in content.json.
  function applyContent(content) {
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
            applyContent(result.data.content);
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
            applyContent(result.data.content);
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

  // ---------- contact links (WhatsApp / Rover) ----------
  function fillContactSettingsForm(content) {
    var num = document.getElementById('settings-whatsapp-number');
    var msg = document.getElementById('settings-whatsapp-message');
    var rover = document.getElementById('settings-rover-url');
    if (num) num.value = (content.whatsappNumber && content.whatsappNumber.indexOf('X') === -1) ? content.whatsappNumber : '';
    if (msg) msg.value = content.whatsappMessage || '';
    if (rover) rover.value = content.roverUrl || '';
  }

  function wireContactSettingsForm() {
    var btn = document.getElementById('save-contact-settings');
    if (!btn) return;
    btn.addEventListener('click', function () {
      postSettings({
        whatsappNumber: fieldValue('settings-whatsapp-number'),
        whatsappMessage: fieldValue('settings-whatsapp-message'),
        roverUrl: fieldValue('settings-rover-url'),
      }, 'Link di contatto aggiornati.');
    });
  }

  // ---------- availability confirmation ----------
  function fillAvailabilitySettingsForm(content) {
    var method = document.getElementById('settings-availability-method');
    var msgIt = document.getElementById('settings-availability-message-it');
    var msgEn = document.getElementById('settings-availability-message-en');
    var am = content.availabilityMessage || {};
    if (method) method.value = content.availabilityMethod === 'whatsapp' ? 'whatsapp' : 'message';
    if (msgIt) msgIt.value = am.it || '';
    if (msgEn) msgEn.value = am.en || '';
  }

  function wireAvailabilitySettingsForm() {
    var btn = document.getElementById('save-availability-settings');
    if (!btn) return;
    btn.addEventListener('click', function () {
      postSettings({
        availabilityMethod: fieldValue('settings-availability-method') || 'message',
        availabilityMessage: {
          it: fieldValue('settings-availability-message-it'),
          en: fieldValue('settings-availability-message-en'),
        },
      }, 'Impostazioni disponibilità aggiornate.');
    });
  }

  function postSettings(body, successMessage) {
    setStatus('Salvataggio…', false);
    fetch('/admin/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) { throw new Error(result.data.error || 'Errore'); }
        applyContent(result.data.content);
        setStatus(successMessage, false);
      })
      .catch(function (err) { setStatus(err.message || 'Errore durante il salvataggio.', true); });
  }

  // ---------- services (Cosa faccio) ----------
  function renderServicesAdmin(services) {
    var list = document.getElementById('services-admin-list');
    if (!list) return;
    list.innerHTML = '';
    services.forEach(function (s, i) {
      list.appendChild(buildServiceRow(s, i));
    });
  }

  function buildServiceRow(s, index) {
    var row = document.createElement('div');
    row.className = 'admin-list-item';
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
      + '  <button type="button" class="admin-save-btn" data-action="save">Salva</button>'
      + '</div>';

    row.querySelector('[data-action="save"]').addEventListener('click', function () {
      putListItem('services', index, {
        icon: s.icon || 'paw',
        titleIt: row.querySelector('.f-title-it').value,
        titleEn: row.querySelector('.f-title-en').value,
        descIt: row.querySelector('.f-desc-it').value,
        descEn: row.querySelector('.f-desc-en').value,
        priceIt: row.querySelector('.f-price-it').value,
        priceEn: row.querySelector('.f-price-en').value,
      }, 'Servizio aggiornato.');
    });
    row.querySelector('[data-action="remove"]').addEventListener('click', function () {
      if (!window.confirm('Rimuovere questo servizio?')) return;
      deleteListItem('services', index, 'Servizio rimosso.');
    });
    return row;
  }

  function wireServiceAdd() {
    var btn = document.getElementById('add-service-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      postListItem('services', {
        icon: 'paw', titleIt: 'Nuovo servizio', titleEn: 'New service',
        descIt: '', descEn: '', priceIt: '', priceEn: '',
      }, 'Servizio aggiunto — modificalo qui sotto.');
    });
  }

  // ---------- testimonials (Recensioni) ----------
  function renderTestimonialsAdmin(testimonials) {
    var list = document.getElementById('testimonials-admin-list');
    if (!list) return;
    list.innerHTML = '';
    testimonials.forEach(function (t, i) {
      list.appendChild(buildTestimonialRow(t, i));
    });
  }

  function buildTestimonialRow(t, index) {
    var row = document.createElement('div');
    row.className = 'admin-list-item';
    row.innerHTML = ''
      + '<div class="admin-field"><label>Recensione (italiano)</label><textarea class="f-quote-it">' + escHtml(t.quoteIt) + '</textarea></div>'
      + '<div class="admin-field"><label>Recensione (inglese)</label><textarea class="f-quote-en">' + escHtml(t.quoteEn) + '</textarea></div>'
      + '<div class="admin-field"><label>Nome cliente</label><input type="text" class="f-name" value="' + escHtml(t.name) + '"></div>'
      + '<div class="admin-list-actions">'
      + '  <button type="button" class="admin-btn-remove" data-action="remove">Rimuovi</button>'
      + '  <button type="button" class="admin-save-btn" data-action="save">Salva</button>'
      + '</div>';

    row.querySelector('[data-action="save"]').addEventListener('click', function () {
      putListItem('testimonials', index, {
        quoteIt: row.querySelector('.f-quote-it').value,
        quoteEn: row.querySelector('.f-quote-en').value,
        name: row.querySelector('.f-name').value,
      }, 'Recensione aggiornata.');
    });
    row.querySelector('[data-action="remove"]').addEventListener('click', function () {
      if (!window.confirm('Rimuovere questa recensione?')) return;
      deleteListItem('testimonials', index, 'Recensione rimossa.');
    });
    return row;
  }

  function wireTestimonialAdd() {
    var btn = document.getElementById('add-testimonial-btn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      postListItem('testimonials', { quoteIt: '', quoteEn: '', name: '' }, 'Recensione aggiunta — modificala qui sotto.');
    });
  }

  // ---------- generic list CRUD helpers (services / testimonials) ----------
  function postListItem(path, body, successMessage) {
    setStatus('Salvataggio…', false);
    fetch('/admin/api/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) { throw new Error(result.data.error || 'Errore'); }
        applyContent(result.data.content);
        setStatus(successMessage, false);
      })
      .catch(function (err) { setStatus(err.message || 'Errore.', true); });
  }

  function putListItem(path, index, body, successMessage) {
    setStatus('Salvataggio…', false);
    fetch('/admin/api/' + path + '/' + index, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) { throw new Error(result.data.error || 'Errore'); }
        applyContent(result.data.content);
        setStatus(successMessage, false);
      })
      .catch(function (err) { setStatus(err.message || 'Errore.', true); });
  }

  function deleteListItem(path, index, successMessage) {
    setStatus('Rimozione…', false);
    fetch('/admin/api/' + path + '/' + index, { method: 'DELETE' })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) { throw new Error(result.data.error || 'Errore'); }
        applyContent(result.data.content);
        setStatus(successMessage, false);
      })
      .catch(function (err) { setStatus(err.message || 'Errore.', true); });
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
