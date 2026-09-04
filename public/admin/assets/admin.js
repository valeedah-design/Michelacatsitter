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
      if (content) { renderPreviews(content); }
    });
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

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', !!isError);
  }
})();
