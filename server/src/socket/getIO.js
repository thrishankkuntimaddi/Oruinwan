// server/src/socket/getIO.js
// Singleton accessor for the Socket.IO instance, registered via app.set('io', io)
// Use this in feature modules to avoid circular-dependency issues.
let _ioRef = null;

function setIO(io) {
  _ioRef = io;
}

function getIO() {
  return _ioRef;
}

module.exports = { setIO, getIO };
