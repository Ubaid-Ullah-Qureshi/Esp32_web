const els = {
  serviceUuid: document.getElementById('serviceUuid'),
  charUuid: document.getElementById('charUuid'),
  sampleRate: document.getElementById('sampleRate'),
  offset: document.getElementById('offset'),
  gain: document.getElementById('gain'),
  connectBtn: document.getElementById('connectBtn'),
  disconnectBtn: document.getElementById('disconnectBtn'),
  muteBtn: document.getElementById('muteBtn'),
  status: document.getElementById('status'),
  stats: document.getElementById('stats'),
  canvas: document.getElementById('waveCanvas')
};

let ble = { device: null, server: null, characteristic: null };
let audioCtx;
let workletNode;
let muted = false;
let packetCount = 0;
let sampleCount = 0;
const plotBuffer = new Float32Array(3000);
let plotHead = 0;

function setStatus(text, cls = 'neutral') {
  els.status.textContent = text;
  els.status.className = `badge ${cls}`;
}

function updateStats(queueSize = 0) {
  els.stats.textContent = `Packets: ${packetCount} · Samples: ${sampleCount} · Queue: ${queueSize}`;
}

async function ensureAudio() {
  if (audioCtx) return;
  const requestedRate = Number(els.sampleRate.value) || 8000;
  audioCtx = new AudioContext({ sampleRate: requestedRate, latencyHint: 'interactive' });
  await audioCtx.audioWorklet.addModule('./audio-worklet-processor.js');
  workletNode = new AudioWorkletNode(audioCtx, 'pcm-player-processor');
  workletNode.connect(audioCtx.destination);
}

function pushPlot(samples) {
  for (let i = 0; i < samples.length; i += 1) {
    plotBuffer[plotHead] = samples[i];
    plotHead = (plotHead + 1) % plotBuffer.length;
  }
}

function decodeInt16ToFloat(dataView) {
  const offset = Number(els.offset.value) || 0;
  const gain = Number(els.gain.value) || 1;
  const sampleTotal = dataView.byteLength / 2;
  const out = new Float32Array(sampleTotal);

  for (let i = 0; i < sampleTotal; i += 1) {
    const s = dataView.getInt16(i * 2, true);
    const centered = s - offset;
    out[i] = Math.max(-1, Math.min(1, (centered / 2048) * gain));
  }

  return out;
}

function drawWaveform() {
  const ctx = els.canvas.getContext('2d');
  const { width, height } = els.canvas;
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = '#30363d';
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  for (let x = 0; x < width; x += 1) {
    const idx = (plotHead + Math.floor((x / width) * plotBuffer.length)) % plotBuffer.length;
    const y = height / 2 - plotBuffer[idx] * (height * 0.45);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.stroke();
  requestAnimationFrame(drawWaveform);
}

async function onNotification(event) {
  const dataView = event.target.value;
  const floats = decodeInt16ToFloat(dataView);

  packetCount += 1;
  sampleCount += floats.length;
  pushPlot(floats);

  if (workletNode && !muted) {
    workletNode.port.postMessage({ type: 'samples', payload: Array.from(floats) });
  }
  updateStats(workletNode ? 1 : 0);
}

async function connectBle() {
  if (!navigator.bluetooth) {
    setStatus('Web Bluetooth unsupported', 'warn');
    return;
  }

  await ensureAudio();
  await audioCtx.resume();

  const serviceUuid = els.serviceUuid.value.trim();
  const charUuid = els.charUuid.value.trim();

  setStatus('Requesting device…', 'warn');
  ble.device = await navigator.bluetooth.requestDevice({ filters: [{ services: [serviceUuid] }] });
  ble.server = await ble.device.gatt.connect();
  const service = await ble.server.getPrimaryService(serviceUuid);
  ble.characteristic = await service.getCharacteristic(charUuid);

  await ble.characteristic.startNotifications();
  ble.characteristic.addEventListener('characteristicvaluechanged', onNotification);

  ble.device.addEventListener('gattserverdisconnected', () => {
    setStatus('Disconnected', 'neutral');
    els.connectBtn.disabled = false;
    els.disconnectBtn.disabled = true;
  });

  els.connectBtn.disabled = true;
  els.disconnectBtn.disabled = false;
  setStatus('Streaming', 'good');
}

async function disconnectBle() {
  if (ble.characteristic) {
    try {
      ble.characteristic.removeEventListener('characteristicvaluechanged', onNotification);
      await ble.characteristic.stopNotifications();
    } catch (_) {
      // Ignore if already disconnected.
    }
  }

  if (ble.device?.gatt?.connected) {
    ble.device.gatt.disconnect();
  }

  els.connectBtn.disabled = false;
  els.disconnectBtn.disabled = true;
  setStatus('Disconnected', 'neutral');
}

els.connectBtn.addEventListener('click', async () => {
  try {
    await connectBle();
  } catch (err) {
    setStatus(`Connect failed: ${err.message}`, 'warn');
  }
});

els.disconnectBtn.addEventListener('click', async () => {
  await disconnectBle();
});

els.muteBtn.addEventListener('click', () => {
  muted = !muted;
  els.muteBtn.textContent = muted ? 'Unmute' : 'Mute';
});

drawWaveform();
