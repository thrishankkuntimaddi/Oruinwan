let _ioRef = null;

function setIO(io) {
  _ioRef = io;
}

function getIO() {
  return _ioRef;
}

module.exports = { setIO, getIO };
