const { EventEmitter } = require('events');
const emitter = new EventEmitter();

emitter.setMaxListeners(50);

// emit(eventName, payload, meta?)
function emit(eventName, payload, meta = {}) {
  emitter.emit(eventName, { payload, meta });
}

function on(eventName, handler) {
  // handler reçoit (envelope) => { payload, meta }
  emitter.on(eventName, handler);
}

function listeners(eventName) { return emitter.listeners(eventName); }

module.exports = { emit, on, listeners };
