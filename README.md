# ESP32 BLE Realtime Audio Web App

This is a mobile-friendly web app that:

- Connects to your ESP32 over Web Bluetooth.
- Receives streaming `int16` little-endian samples from BLE notifications.
- Re-centers samples (default STM32 offset `2047`) and converts to normalized audio.
- Plays audio in real time via Web Audio API.
- Plots a live waveform on canvas.

## Run

Because `AudioWorklet` and Web Bluetooth require a secure context, run over HTTPS or localhost:

```bash
python3 -m http.server 8080
```

Then open on a browser with Web Bluetooth support (Android Chrome recommended):

- `http://localhost:8080` (local testing)
- or serve from HTTPS and open on your phone.

## BLE assumptions

- Service UUID and Characteristic UUID are configurable from the UI.
- Characteristic sends raw PCM data as `int16` little-endian.
- Packet size can vary; app decodes based on notification length.

## STM32/ESP32 integration notes

From your STM32 code, samples are offset (`+ offst`, currently ~2047) and sent as `int16` bytes over UART. Your ESP32 should forward those bytes over BLE notifications unchanged. The app removes offset and scales for playback.
