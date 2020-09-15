const getArg = require('./utils').getArg;
const LineParser = require('./line-parser');

/**
 * restore json from dart file
 * @param {String|ReadStream|Buffer} file dart file, or stream or buffer
 */
module.exports = function (file) {
  return new Promise(function (resolve, reject) {
    let parser = new LineParser();
    let objs = {};
    let cur;
    let cmd;
    let args;
    parser.on('error', reject);
    parser.on('line', function (line) {
      if (/^\W*{@tool\s+json2dart\s+([^}]+)}/.test(line)) {
        let argv = RegExp.$1.split(' ').filter(function (s) { return !!s; });
        let name = getArg('name', argv);
        let strict = getArg('strict', argv);
        cur = objs[name];
        if (!cur) {
          cur = objs[name] = {
            top: true,
            data: {},
            cfg: {
              name,
              map: {},
            }
          }
        }
        if (strict) {
          cur.cfg.strict = true;
        }
      } else if (/^\W*{@end-tool}/.test(line)) {
        cur = null;
      } else if (cur && /\*\s*(\w+)(?:\((\w+)\))?\s*:\s*`(.*)`\s*$/.test(line)) {
        let key = RegExp.$2 || RegExp.$1;
        let val = RegExp.$3;
        try {
          let objVal = cur.data[key] = JSON.parse(val);
          if (objVal && typeof objVal === 'object') {
            if (!cur.cfg.map[key]) {
              cur.cfg.map[key] = {
                map: {},
              };
            }
            cur.cfg.map[key].ignore = true;
          }
        } catch (err) {
          if (/^<(\w+)>\[.*\]$/.test(val)) {
            let on = RegExp.$1;
            let ob = objs[on];
            if (!ob) {
              ob = objs[on] = {
                data: {},
                cfg: {
                  map: {},
                  name: on,
                }
              };
            } else {
              ob.top = false;
            }
            if (cur.data[key]) {
              if (!Array.isArray(cur.data[key])) {
                cur.data[key] = [cur.data[key]];
              }
            } else {
              cur.data[key] = [ob.data];
            }
            if (cur.cfg.map[key]) {
              Object.assign(cur.cfg.map[key], ob.cfg);
            } else {
              cur.cfg.map[key] = ob.cfg;
            }
          } else if (/^<String,\s*(\w+)>({.*})$/.test(val)) {
            let on = RegExp.$1;
            let ov = JSON.parse(RegExp.$2);
            cur.data[key] = ov;
            if (!cur.cfg.map[key]) {
              cur.cfg.map[key] = {
                map: {},
              };
            }
            if (on === 'dynamic') {
              cur.cfg.map[key].dynamic = true;
            } else {
              cur.cfg.map[key].mapped = true;
              let ob = objs[on];
              if (!ob) {
                ob = objs[on] = {
                  data: {},
                  cfg: {
                    map: {},
                    name: on,
                  }
                };
              } else {
                ob.top = false;
              }
              let sk = Object.keys(ov)[0];
              ov[sk] = ob.data;
              cur.cfg.map[key].map[sk] = ob.cfg;
              ob.cfg.suffix = false;
            }
          } else if (/^([a-zA-Z]\w*)/.test(val)) {
            let on = RegExp.$1;
            let ob = objs[on];
            if (!ob) {
              ob = objs[on] = {
                data: {},
                cfg: {
                  map: {},
                  name: on,
                }
              };
            } else {
              ob.top = false;
            }
            if (!cur.data[key]) {
              cur.data[key] = ob.data;
            }
            if (cur.cfg.map[key]) {
              Object.assign(cur.cfg.map[key], ob.cfg);
            } else {
              cur.cfg.map[key] = ob.cfg;
            }
          } else {
            throw err;
          }
        }
      } else if (/\/\/\W+GENERATED\s+BY\s+`\s*([\w-]+)(.*)`\s*$/.test(line)) {
        cmd = RegExp.$1;
        args = RegExp.$2;
      }
    });
    parser.on('end', function () {
      for (let name in objs) {
        let obj = objs[name];
        if (obj.top) {
          return resolve({
            cmd,
            args,
            data: obj.data,
            map: obj.cfg,
          });
        }
      }
      let err = new Error('no top class found');
      err.raw = objs;
      reject(err);
    });
    parser.parse(file);
  });
};
