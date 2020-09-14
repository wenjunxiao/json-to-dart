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

function getFlag (name, argv) {
  if (typeof argv === 'undefined') {
    argv = process.argv;
  }
  let pos = argv.lastIndexOf('--' + name);
  if (pos < 0) {
    pos = argv.lastIndexOf('--no-' + name);
    if (pos > 0) {
      return false;
    }
    return;
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
  let pos = argv.lastIndexOf('--' + name);
  if (pos < 0) {
    pos = argv.lastIndexOf('--no-' + name);
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

function ifUndefined (v1, v2) {
  if (typeof v1 === 'undefined') {
    return v2;
  }
  return v1;
}

function mergeConfigs (objs, dst) {
  dst = dst || objs.shift();
  if (!dst) return {};
  let src = objs.shift();
  if (!src) return dst;
  for (let k in src) {
    let v = src[k];
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) {
        dst[k] = [].slice.call(v);
      } else {
        dst[k] = mergeConfigs([v], dst[k] || {});
      }
    } else {
      dst[k] = v;
    }
  }
  return mergeConfigs(objs, dst);
}

function mergeConfig () {
  return mergeConfigs([].slice.call(arguments));
}

function newConfig () {
  return mergeConfigs([].slice.call(arguments), {});
}

function mergeArray (dst, src) {
  let i = 0;
  let l = Math.min(src.length, dst.length);
  for (; i < l; i++) {
    let sv = src[i];
    if (sv && typeof sv === 'object') {
      if (Array.isArray(sv)) {
        dst[i] = mergeArray(dst[i] || [], sv);
      } else {
        dst[i] = mergeDatas([sv], dst[i] || {});
      }
    } else {
      dst[i] = sv;
    }
  }
  for (l = src.length; i < l; i++) {
    dst.push(src[i]);
  }
  return dst;
}

function mergeDatas (objs, dst) {
  dst = dst || objs.shift();
  if (!dst) return {};
  let src = objs.shift();
  if (!src) return dst;
  for (let k in src) {
    let v = src[k];
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) {
        dst[k] = mergeArray(dst[k] || [], v);
      } else {
        dst[k] = mergeDatas([v], dst[k] || {});
      }
    } else {
      dst[k] = v;
    }
  }
  return mergeDatas(objs, dst);
}

function mergeData () {
  return mergeDatas([].slice.call(arguments), {});
}

function isArrayEqual (a1, a2) {
  if (a1 === a2) return true;
  if (!!a1 !== !!a2) return false;
  if (!a1) return false;
  if (a1.length !== a2.length) return false;
  for (let i = 0, l = a1.length; i < l; i++) {
    let v = a1[i];
    if (Array.isArray(v)) {
      if (!isArrayEqual(v, a2[i])) {
        return false;
      }
    } else if (!isEqual(v, a2[i])) {
      return false;
    }
  }
  return true;
}

function isEqual (o1, o2) {
  if (o1 === o2) return true;
  if (!!o1 !== !!o2) return false;
  if (!o1) return false;
  if (typeof o1 !== 'object') {
    return o1 === o2;
  }
  for (let k in o1) {
    let v = o1[k];
    if (v && typeof v === 'object') {
      if (Array.isArray(v)) {
        if (!isArrayEqual(v, o2[k])) {
          return false;
        }
      } else if (!isEqual(v, o2[k])) {
        return false;
      }
    } else if (v !== o2[k]) {
      return false;
    }
  }
  return true;
}

module.exports = {
  newConfig,
  isEqual,
  mergeData,
  mergeConfig,
  ifUndefined,
  NOT_FOUND,
  formatCode,
  readJsonOrFile,
  getShortArg,
  name2file,
  getFlag,
  getArg,
  upperFirst
}