// Obtener el ID de la pestaña activa
function getActiveTabId() {
  return browser.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0].id);
}

// Función para actualizar el estado del popup basado en los datos almacenados
function updatePopup() {
  getActiveTabId().then(tabId => {
    browser.storage.local.get([`volume_${tabId}`, `mono_${tabId}`]).then(data => {
      if (data[`volume_${tabId}`] !== undefined) {
        document.getElementById('volumen').value = data[`volume_${tabId}`];
      }
      if (data[`mono_${tabId}`] !== undefined) {
        document.getElementById('mono').checked = data[`mono_${tabId}`];
      }
    });
  });
}

// Cambiar el volumen del audio en la pestaña
document.getElementById('volumen').addEventListener('input', function() {
  let volume = this.value / 100;
  getActiveTabId().then(tabId => {
    browser.tabs.executeScript(tabId, {
      code: `document.querySelectorAll('audio, video').forEach(el => el.volume = ${volume});`
    });

    // Guardar el volumen en el almacenamiento local de la pestaña
    browser.storage.local.set({[`volume_${tabId}`]: this.value});
  });
});

// Cambiar entre modo mono y estéreo
document.getElementById('mono').addEventListener('change', function() {
  let mono = this.checked;
  getActiveTabId().then(tabId => {
    browser.tabs.executeScript(tabId, {
      code: mono ? `
        document.querySelectorAll('audio, video').forEach(el => {
          if (!el.dataset.isMono) {
            let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            let source = audioCtx.createMediaElementSource(el);
            let merger = audioCtx.createChannelMerger(2);

            source.connect(merger, 0, 0);
            source.connect(merger, 0, 1);
            merger.connect(audioCtx.destination);

            el.audioCtx = audioCtx;
            el.source = source;
            el.merger = merger;
            el.dataset.isMono = 'true';
          }
        });
      ` : `
        document.querySelectorAll('audio, video').forEach(el => {
          if (el.dataset.isMono === 'true') {
            // Desconectar el modo mono
            if (el.merger) {
              el.merger.disconnect();
              el.source.disconnect();
              el.source.connect(el.audioCtx.destination); // Reconectar el audio de vuelta a su flujo normal
            }
            el.audioCtx = null;
            el.source = null;
            el.merger = null;
            el.dataset.isMono = 'false';
          }
        });
      `
    });

    // Guardar el estado del modo mono en el almacenamiento local de la pestaña
    browser.storage.local.set({[`mono_${tabId}`]: mono});
  });
});

// Al abrir el popup, actualizar el estado
updatePopup();
