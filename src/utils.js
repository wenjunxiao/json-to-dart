const fs = require('fs');
const spawn = require('child_process').spawn;

const NOT_FOUND = 'ENOENT';

function upperFirst (s) {
  return s[0].toUpperCase() + s.slice(1);
}

function getShortArg (name, val, argv) {
  if (typeof argv === 'undefined') {
    if (Array.isArray(val)) {
      argv = val;
      val = undefined;
    } else {
      argv = process.argv;
    }
  }
  let pos = argv.indexOf('-' + name);
  if (pos < 0) {
    return val;
  }
  if (pos + 1 < argv.length) {
    let v = argv[pos + 1];
    if (!v.startsWith('-')) {
      return v;
    }
  }
  return true;
}

function getArg (name, val, argv) {
  if (typeof argv === 'undefined') {
    if (Array.isArray(val)) {
      argv = val;
      val = undefined;
    } else {
      argv = process.argv;
    }
  }
  let pos = argv.indexOf('--' + name);
  if (pos < 0) {
    pos = argv.indexOf('--no-' + name);
    if (pos > 0) {
      return false;
    }
    return val;
  }
  if (pos + 1 < argv.length) {
    let v = argv[pos + 1];
    if (!v.startsWith('-')) {
      return v;
    }
  }
  return true;
}

function name2file (name) {
  return name.replace(/(^|[a-z0-9])([A-Z])([a-z0-9]|$)/g, function (_, $1, $2, $3) {
    if ($1) {
      return ($1 || '') + '_' + $2.toLowerCase() + ($3 || '');
    }
    return $2.toLowerCase() + ($3 || '');
  }).replace(/([^A-Z]*)([A-Z]{2,})/g, function (_, $1, $2) {
    if ($1) {
      return $1 + '_' + $2.toLowerCase();
    }
    return $2.toLowerCase();
  });
}

function readJsonOrFile (file) {
  if (file) {
    if (typeof file === 'object') {
      return file;
    }
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      if (err.code !== NOT_FOUND) {
        throw err;
      }
    }
  }
  return {};
}

function formatCode (raw, formatter) {
  if (formatter) {
    return new Promise(function (resolve, reject) {
      let p = spawn(formatter, []);
      let result = [];
      let error = [];
      p.stdout.on('data', function (data) {
        result.push(data);
      });
      p.stderr.on('data', function (data) {
        error.push(data);
      });
      p.on('exit', function (code) {
        if (code === 0) {
          return resolve(result.join(''));
        } else {
          let err = new Error(result.concat(error).join(''));
          err.code = code;
          err.raw = raw;
          return reject(err);
        }
      });
      p.stdin.write(raw, 'utf-8');
      p.stdin.end();
    })
  } else {
    return Promise.resolve(raw);
  }
}

module.exports = {
  NOT_FOUND,
  formatCode,
  readJsonOrFile,
  getShortArg,
  name2file,
  getArg,
  upperFirst
}