const fs = require('fs');
const EventEmitter = require('events').EventEmitter;

const LF = 0x0a;

class LineParser extends EventEmitter {
  constructor(encoding) {
    super();
    this.encoding = encoding || 'utf-8';
  }

  _parseBuffer (buffer, ended = true) {
    let pos = 0;
    while (pos > -1) {
      let p = buffer.indexOf(LF, pos);
      if (p > -1) {
        this.emit('line', buffer.toString(this.encoding, pos, p));
        pos = p + 1;
      } else {
        if (ended) {
          if (pos < buffer.length) {
            this.emit('line', buffer.toString(this.encoding, pos));
          }
          this.emit('end');
        }
        break;
      }
    }
    return pos;
  }

  parse (file) {
    const self = this;
    if (typeof file === 'string') {
      file = fs.createReadStream(file);
    }
    if (Buffer.isBuffer(file)) {
      self._parseBuffer(file);
    } else {
      let buffer = Buffer.alloc(0);
      file.on('data', function (chunk) {
        buffer = Buffer.concat([buffer, chunk]);
        let pos = self._parseBuffer(buffer, false);
        if (pos > 0) {
          buffer = buffer.slice(pos);
        }
      });
      file.on('error', function (err) {
        self.emit('error', err);
      });
      file.on('end', function () {
        self._parseBuffer(buffer, true);
      });
    }
  }
}

module.exports = LineParser;
