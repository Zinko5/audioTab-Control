// Mantener un mapa para almacenar los contextos de audio por pestaña
let audioContexts = {};

// Obtener el ID de la pestaña activa
function getActiveTabId() {
  return browser.tabs.query({ active: true, currentWindow: true }).then(tabs => tabs[0].id);
}

// Función para aplicar la ganancia de volumen en el audio de la pestaña
function applyGain(tabId, gainValue) {
  browser.tabs.executeScript(tabId, {
    code: `
      (function() {
        // Obtener o crear un contexto de audio para la pestaña
        if (!window.audioContext) {
          window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        const audioContext = window.audioContext;

        // Si ya tenemos un nodo de ganancia, lo reutilizamos
        if (!window.gainNode) {
          window.gainNode = audioContext.createGain();
          const mediaElements = document.querySelectorAll('audio, video');
          mediaElements.forEach(el => {
            const source = audioContext.createMediaElementSource(el);
            source.connect(window.gainNode);
            window.gainNode.connect(audioContext.destination);
          });
        }

        // Establecer la ganancia del nodo de audio
        window.gainNode.gain.value = ${gainValue};
      })();
    `
  });
}

// Función para aplicar el modo mono o estéreo
function applyMono(tabId, mono) {
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
}

// Función para actualizar el estado del popup basado en los datos almacenados
function updatePopup() {
  getActiveTabId().then(tabId => {
    browser.storage.local.get([`volume_${tabId}`, `mono_${tabId}`]).then(data => {
      if (data[`volume_${tabId}`] !== undefined) {
        document.getElementById('volumen').value = data[`volume_${tabId}`];
        document.getElementById('vol_label').innerHTML = (data[`volume_${tabId}`] * 100).toFixed() + '%';
      }
      if (data[`mono_${tabId}`] !== undefined) {
        document.getElementById('mono').checked = data[`mono_${tabId}`];
      }
    });
  });
}

// Cambiar el volumen del audio en la pestaña
function changeVolume(volume) {
  let displayVolume = (volume * 100).toFixed() + '%';
  document.getElementById('vol_label').innerHTML = displayVolume;

  getActiveTabId().then(tabId => {
    applyGain(tabId, volume);

    // Guardar el volumen en el almacenamiento local de la pestaña
    browser.storage.local.set({[`volume_${tabId}`]: volume});
  });
}

// Asignar evento al input de volumen
document.getElementById('volumen').addEventListener('input', function() {
  let volume = parseFloat(this.value);
  changeVolume(volume);
});

// Cambiar entre modo mono y estéreo
document.getElementById('mono').addEventListener('change', function() {
  let mono = this.checked;
  getActiveTabId().then(tabId => {
    applyMono(tabId, mono);

    // Guardar el estado del modo mono en el almacenamiento local de la pestaña
    browser.storage.local.set({[`mono_${tabId}`]: mono});
  });
});

// Botón de reset para volver al 100%
document.getElementById('reset').addEventListener('click', function() {
  document.getElementById('volumen').value = 1; // Volver al 100%
  changeVolume(1);
});

// Al abrir el popup, actualizar el estado
updatePopup();
