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
        document.getElementById('vol_label').textContent = `${(data[`volume_${tabId}`] * 100).toFixed()}%`;
      }
      if (data[`mono_${tabId}`] !== undefined) {
        document.getElementById('mono').checked = data[`mono_${tabId}`];
      }
    });
  });
}

// Cambiar el volumen del audio en la pestaña
document.getElementById('volumen').addEventListener('input', function() {
  let volume = parseFloat(this.value);  // Rango de 0 a 2
  getActiveTabId().then(tabId => {
    browser.tabs.executeScript(tabId, {
      code: `
        let volume = ${volume};
        document.querySelectorAll('audio, video').forEach(el => {
          if (!el.dataset.audioContext) {
            let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            let source = audioCtx.createMediaElementSource(el);
            let gainNode = audioCtx.createGain();
            
            source.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            el.dataset.audioContext = 'true';
            el.dataset.gainNode = gainNode;
          } else {
            let gainNode = el.dataset.gainNode;
            if (gainNode) {
              gainNode.gain.value = volume;
            }
          }
        });
      `
    });

    // Guardar el volumen en el almacenamiento local de la pestaña
    browser.storage.local.set({[`volume_${tabId}`]: volume});
    document.getElementById('vol_label').textContent = `${(volume * 100).toFixed()}%`;
  });
});

// Restablecer el volumen al 100%
document.getElementById('reset').addEventListener('click', function() {
  getActiveTabId().then(tabId => {
    document.getElementById('volumen').value = 1;  // 1 = 100%
    document.getElementById('vol_label').textContent = '100%';

    browser.tabs.executeScript(tabId, {
      code: `
        document.querySelectorAll('audio, video').forEach(el => {
          if (el.dataset.gainNode) {
            el.dataset.gainNode.gain.value = 1; // Restablece al 100%
          }
        });
      `
    });

    // Guardar el volumen en el almacenamiento local de la pestaña
    browser.storage.local.set({[`volume_${tabId}`]: 1});
  });
});

// Cambiar entre modo mono y estéreo
document.getElementById('mono').addEventListener('change', function() {
  let mono = this.checked;
  getActiveTabId().then(tabId => {
    browser.tabs.executeScript(tabId, {
      code: mono ? `
        document.querySelectorAll('audio, video').forEach(el => {
          if (!el.audioCtx || el.dataset.isMono === 'false') {
            // Si ya existe un contexto de audio, desconectar las conexiones previas
            if (el.source) {
              el.source.disconnect();
            }
            if (el.merger) {
              el.merger.disconnect();
            }
            if (el.audioCtx) {
              el.audioCtx.close();
            }
            
            // Crear un nuevo contexto de audio para el modo mono
            let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            let source = audioCtx.createMediaElementSource(el);
            let merger = audioCtx.createChannelMerger(2);
            
            source.connect(merger, 0, 0);
            source.connect(merger, 0, 1);
            merger.connect(audioCtx.destination);
            
            // Guardar las referencias en el elemento
            el.audioCtx = audioCtx;
            el.source = source;
            el.merger = merger;
            el.dataset.isMono = 'true';
          }
        });
      ` : `
        document.querySelectorAll('audio, video').forEach(el => {
          if (el.dataset.isMono === 'true') {
            // Desconectar las conexiones del modo mono
            if (el.source) {
              el.source.disconnect();
            }
            if (el.merger) {
              el.merger.disconnect();
            }
            // Conectar de nuevo el audio original al destino sin efectos
            let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            let source = audioCtx.createMediaElementSource(el);
            source.connect(audioCtx.destination);
            
            // Limpiar los datos del modo mono
            el.dataset.isMono = 'false';
            if (el.audioCtx) {
              el.audioCtx.close();
            }
            el.audioCtx = audioCtx;
            el.source = source;
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