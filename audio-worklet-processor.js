class PcmPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.queue = [];
    this.port.onmessage = (event) => {
      if (event.data?.type === 'samples') {
        this.queue.push(...event.data.payload);
      }
    };
  }

  process(_, outputs) {
    const output = outputs[0][0];
    for (let i = 0; i < output.length; i += 1) {
      output[i] = this.queue.length ? this.queue.shift() : 0;
    }
    return true;
  }
}

registerProcessor('pcm-player-processor', PcmPlayerProcessor);
