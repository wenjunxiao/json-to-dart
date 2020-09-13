const util = require('util');
const EventEmitter = require('events').EventEmitter;

const LF = 0x0a;

class ReadBlock extends EventEmitter {
  constructor(options) {
    super();
    options = options || {};
    let delay = options.delay || 60;
    let returnAt = 0;
    let chunks = [];
    let timer = null;
    let input = options.input || process.stdin;
    this._interactive = options.interactive === true;
    this._promptEnabled = options.disablePrompt !== true;
    this._yes = options.yes === true;
    this._output = options.output || process.stdout;
    this._prompt = options.prompt || '>';
    const self = this;
    input.on('data', function (chunk) {
      let now = Date.now();
      let cost = now - returnAt;
      returnAt = now;
      let last = chunk.length - 1;
      let lineEnd = LF === chunk[last];
      if (timer) clearTimeout(timer);
      if (cost > delay && lineEnd) {
        chunks.push(chunk);
        if (last === 0) {
          self.emit('block', Buffer.concat(chunks).toString('utf-8').replace(/\n$/, ''));
          chunks = [];
        } else {
          timer = setTimeout(function () {
            self.emit('block', Buffer.concat(chunks).toString('utf-8').replace(/\n$/, ''));
            chunks = [];
          }, delay);
        }
      } else {
        chunks.push(chunk);
      }
    });
  }

  setPrompt (prompt) {
    this._prompt = prompt;
    return this;
  }

  prompt () {
    if (this._promptEnabled) {
      let msg = util.format.apply(util, arguments) || this._prompt;
      this._output.write(msg);
    }
    return this;
  }

  warn () {
    if (!this._interactive) {
      let msg = util.format.apply(util, arguments);
      this.emit('error', new Error(msg));
      return this;
    }
    if (this._promptEnabled) {
      let msg = util.format.apply(util, arguments);
      this._output.write(msg + '\n');
    }
    return this;
  }

  question (query, defaultAnswer, callback) {
    if (typeof callback === 'undefined') {
      callback = defaultAnswer;
      defaultAnswer = undefined;
    }
    if (this._yes && typeof defaultAnswer !== 'undefined') {
      if (this._promptEnabled) {
        this._output.write('\n');
      }
      return callback(defaultAnswer);
    }
    if (this._promptEnabled) {
      this._output.write(query);
    }
    this.once('block', callback);
    return this;
  }

  questionAsync (query, defaultAnswer) {
    const self = this;
    return new Promise(function (resolve) {
      if (self._promptEnabled) {
        self._output.write(query);
      }
      if (self._yes && typeof defaultAnswer !== 'undefined') {
        if (self._promptEnabled) {
          self._output.write('\n');
        }
        return resolve(defaultAnswer);
      }
      self.once('block', resolve);
    });
  }

  questionUntil (query, validator, defaultAnswer, defaultYes) {
    const self = this;
    return new Promise(function (resolve) {
      if (self._promptEnabled) {
        self._output.write(query);
      }
      if ((self._yes || defaultYes) && typeof defaultAnswer !== 'undefined') {
        if (self._promptEnabled) {
          self._output.write('\n');
        }
        return resolve(defaultAnswer);
      }
      const onBlock = function (block) {
        let v = validator(block);
        if (v === null || typeof v === 'undefined') {
          if (self._promptEnabled) {
            self._output.write(query);
          }
          self.once('block', onBlock);
        } else {
          resolve(v);
        }
      }
      self.once('block', onBlock);
    });
  }

  questionWhenEmpty (query, answer) {
    if (answer) return Promise.resolve(answer);
    return this.questionUntil(query, function (answer) {
      if (answer) return answer;
    });
  }
}

module.exports = ReadBlock;
