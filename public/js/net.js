// Thin wrapper around the socket.io client so every other file shares one connection.
const Net = (() => {
  const socket = io();
  return {
    socket,
    on(event, cb) { socket.on(event, cb); },
    off(event, cb) { socket.off(event, cb); },
    emit(event, payload, cb) {
      if (cb) socket.emit(event, payload, cb);
      else socket.emit(event, payload);
    },
  };
})();
