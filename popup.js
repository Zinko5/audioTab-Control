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
      // Actualizar la etiqueta del volumen
      updateVolumeLabel(data[`volume_${tabId}`] || 1); // 1 es el valor base
    });
  });
}

// Función para actualizar la etiqueta del volumen
function updateVolumeLabel(value) {
  document.getElementById('vol_label').textContent = `${(value * 100).toFixed()}%`;
}

// Cambiar el volumen del audio en la pestaña
document.getElementById('volumen').addEventListener('input', function() {
  let volume = this.value; // Rango 0 a 2
  getActiveTabId().then(tabId => {
    browser.tabs.executeScript(tabId, {
      code: `document.querySelectorAll('audio, video').forEach(el => el.volume = Math.min(Math.max(${volume}, 0), 1));`
    });

    // Guardar el volumen en el almacenamiento local de la pestaña
    browser.storage.local.set({[`volume_${tabId}`]: volume});
  });
  // Actualizar la etiqueta del volumen
  updateVolumeLabel(volume);
});

// Restablecer el volumen al 100%
document.getElementById('reset').addEventListener('click', function() {
  document.getElementById('volumen').value = 1; // Valor 1 corresponde al 100%
  document.getElementById('volumen').dispatchEvent(new Event('input')); // Disparar evento para actualizar el volumen
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