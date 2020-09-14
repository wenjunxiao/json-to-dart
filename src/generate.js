const { upperFirst, mergeData, mergeConfig } = require('./utils');
const restore = require('./restore');

function mergeArray (arr) {
  return arr.reduce(function (r, o) { return mergeData(r, o); }, {});
}

function invalidKey (key) {
  if (/^[a-zA-Z]\w*$/.test(key)) {
    return false;
  }
  return true;
}

function serial (keys, fn, results) {
  results = results || [];
  return new Promise(function (resolve, reject) {
    if (keys.length > 0) {
      return Promise.resolve(fn(keys.shift())).then(function (val) {
        results.push(val);
        return resolve(serial(keys, fn, results));
      }).catch(reject);
    } else {
      return resolve(results);
    }
  });
}

async function parseObject (rb, obj, cfg, opts) {
  const name = cfg.name;
  const cmd = opts.cmd;
  const map = cfg.map || {};
  const subs = {};
  const array = opts.array || [];
  let strict = cfg.strict;
  let globalStrict = false;
  if (typeof opts.strict === 'boolean') {
    strict = opts.strict;
    globalStrict = true;
  }
  let hasInvalidKey = false;
  return serial(Object.keys(obj), function (key) {
    if (cfg.mapped) {
      if (cfg._selected) {
        return;
      } else {
        cfg._selected = true;
      }
    }
    if (invalidKey(key)) {
      hasInvalidKey = true;
    }
    let val = obj[key];
    let mp = map[key] || {};
    if (Array.isArray(val)) {
      let item = mergeArray(val);
      rb.prompt('\nThe following array child objects are detected(' + name + '.' + key + '[]):\n%s\n', JSON.stringify(item, null, 2));
      let defName = mp.name;
      if (!defName) {
        defName = '';
        if (opts.concat) {
          defName = name;
        }
        if (!array.includes(key)) {
          defName += upperFirst(key);
        }
        if (opts.prefix) {
          defName = opts.prefix + defName;
        }
        if (cfg.nameTrim) {
          defName = defName.replace(new RegExp(cfg.nameTrim + '$'), '');
        }
        if (mp.suffix !== false && opts.suffix !== false && opts.arrayItemSuffix) {
          defName += opts.arrayItemSuffix;
          mp.nameTrim = opts.arrayItemSuffix;
        }
        if (!defName) {
          defName = upperFirst(key);
        }
      }
      return rb.questionAsync('Enter name of item of array (' + defName + '): ', defName).then(function (keyName) {
        if (!keyName) {
          keyName = defName;
        }
        mp.name = keyName;
        return parseObject(rb, item, mp, opts, name, key);
      }).then(function (data) {
        subs[mp.name] = data;
        mp.map = data.map;
        map[key] = mp;
      });
    } else if (val && typeof val === 'object') {
      rb.prompt('\nThe following child object was detected(' + name + '.' + key + '):\n%s\n', JSON.stringify(val, null, 2).trim());
      let defName = mp.name;
      if (!defName) {
        if (opts.concat) {
          defName = name + upperFirst(key);
        } else {
          defName = upperFirst(key);
        }
        if (opts.prefix) {
          defName = opts.prefix + defName;
        }
      }
      let defOpt = 0;
      if (mp.mapped) {
        defOpt = 1;
      } else if (mp.dynamic) {
        defOpt = 2;
      }
      let tips = [
        '  0. The default object name (' + defName + ')',
        '  1. Is a object map (map)',
        '  2. Is a dynamic object (dynamic)',
        '',
        `Enter a new name or the number above (${defOpt}): `,
      ];
      return rb.questionAsync(tips.join('\n'), `${defOpt}`).then(function (keyName) {
        if (keyName === '0') {
          keyName = defName;
        } else if (keyName === '1') {
          keyName = 'map';
        } else if (keyName === '2') {
          keyName = 'dynamic';
        }
        if (keyName === 'dynamic') {
          mp.ignore = true;
          keyName = defName;
        } else if (keyName === 'map') {
          mp.mapped = true;
          keyName = defName;
        } else {
          if (!keyName) {
            keyName = defName;
          }
        }
        mp.name = keyName;
        if (mp.ignore) {
          return {
            map: {}
          };
        }
        return parseObject(rb, val, mp, opts, name, key);
      }).then(function (data) {
        if (data) {
          subs[mp.name] = data;
          mp.map = data.map;
          map[key] = mp;
        }
      });
    }
  }).then(function () {
    let subCode = Object.keys(subs).map(function (name) {
      return subs[name].code;
    }).join('\n');
    if (hasInvalidKey || map.ignore || invalidKey(name) || cfg.mapped) {
      return {
        code: subCode,
        map,
      };
    }
    let extra = '';
    if (strict && !globalStrict) {
      extra += ' --strict';
    }
    let comments = [`/// {@tool ${cmd} --name ${name}${extra}}`];
    let codes = [`class ${name} {`];
    let ctors = [];
    let jn = 'json';
    let mn = 'json';
    if (jn in obj) {
      jn = null;
      let names = opts.variables || ['json', 'd', 'v', 'j', '_json'];
      for (let n of names) {
        if (!(n in obj)) {
          jn = n;
          break;
        }
      }
    }
    if (!jn) {
      return Promise.reject(new Error('`fromJson` variable confilict'));
    }
    if (mn in obj) {
      mn = null;
      let names = opts.variables || ['json', 'd', 'r', 'j', '_json'];
      for (let n of names) {
        if (!(n in obj)) {
          mn = n;
          break;
        }
      }
    }
    if (!mn) {
      return Promise.reject(new Error('`toJson` variable confilict'));
    }
    let from = [`  ${name}.fromJson(Map<String, dynamic> ${jn}) {`];
    let to = [`  Map<String, dynamic> toJson() {`];
    to.push(`    final ${mn} = <String, dynamic>{};`);
    let maxComment = opts.maxComment || 0;
    for (let key in obj) {
      const kn = key.replace(/_(\w)/g, function (_, $1) { return $1.toUpperCase(); });
      let kdn = '';
      if (key !== kn) {
        kdn = `(${key})`;
      }
      let val = obj[key];
      let type = typeof val;
      ctors.push(`this.${kn}`);
      let mp = map[key];
      const isObject = val && type === 'object';
      if (isObject && mp && !mp.ignore) {
        const isArray = Array.isArray(val);
        let tn = mp.name;
        let objVal = JSON.stringify(isArray ? mergeArray(val) : val);
        if (objVal.length > maxComment && !mp.dynamic) {
          objVal = '';
        }
        if (mp.mapped) {
          let subKey = Object.keys(mp.map)[0];
          tn = mp.map[subKey].name;
          codes.push(`  Map<String, ${tn}> ${kn};`);
          if (!objVal) {
            objVal = JSON.stringify({ [subKey]: {} });
          }
          comments.push(`/// * ${kn}${kdn}: \`<String, ${tn}>${objVal}\``);
          from.push(`    ${kn} = (${jn}["${key}"] as Map)?.map((k, v) => MapEntry(k, ${tn}.fromJson(v)));`);
          to.push(`    if (${kn} != null) {`);
          to.push(`      ${mn}["${key}"] = ${kn}.map((k, v) => MapEntry(k, v.toJson()));`);
          to.push('    }');
        } else if (mp.dynamic) {
          let subKey = Object.keys(mp.map)[0];
          tn = mp.map[subKey].name;
          codes.push(`  Map<String, dynamic> ${kn};`);
          comments.push(`/// * ${kn}${kdn}: \`<String, dynamic>${objVal}\``);
          from.push(`    ${kn} = ${jn}["${key}"]`);
          to.push(`    ${mn}["${key}"] = ${kn};`);
        } else if (isArray) {
          codes.push(`  List<${tn}> ${kn};`);
          comments.push(`/// * ${kn}${kdn}: \`<${tn}>[${objVal}]\``);
          from.push(`    ${kn} = (${jn}["${key}"] as List)?.map((v) => ${tn}.fromJson(v))?.toList();`);
          to.push(`    if (${kn} != null) {`);
          to.push(`      ${mn}["${key}"] = ${kn}.map((v) => v.toJson()).toList();`);
          to.push('    }');
        } else {
          codes.push(`  ${tn} ${kn};`);
          comments.push(`/// * ${kn}${kdn}: \`${tn}(${objVal})\``);
          from.push(`    ${kn} = ${jn}["${key}"] != null ? ${tn}.fromJson(${jn}["${key}"]) : null;`);
          to.push(`    if (${kn} != null) {`);
          to.push(`      ${mn}["${key}"] = ${kn}.toJson();`);
          to.push('    }');
        }
      } else {
        let target = 'dynamic';
        let as = '';
        let transfer = '';
        switch (type) {
          case 'boolean':
            target = as = 'bool';
            break;
          case 'number':
            target = as = 'num';
            if (strict) {
              if (parseInt(val, 10) === val) {
                transfer = '.toInt()';
                target = 'int';
              } else {
                transfer = '.toDouble()';
                target = 'double';
              }
            }
            break;
          case 'string':
            target = as = 'String';
            break;
        }
        if (transfer) {
          from.push(`    ${kn} = (${jn}["${key}"] as ${as})?${transfer};`);
        } else if (as) {
          from.push(`    ${kn} = ${jn}["${key}"] as ${as};`);
        } else {
          from.push(`    ${kn} = ${jn}["${key}"];`);
        }
        to.push(`    ${mn}["${key}"] = ${kn};`);
        codes.push(`  ${target} ${kn};`);
        if (isObject && mp && !mp.ignore) {
          comments.push(`/// * ${kn}${kdn}: \`<String, dynamic>${JSON.stringify(val)}\``);
        } else {
          comments.push(`/// * ${kn}${kdn}: \`${JSON.stringify(val)}\``);
        }
      }
    }
    from.push('  }');
    to.push(`    return ${mn};`);
    to.push('  }');
    codes.push('');
    if (ctors.length > 0) {
      codes.push(`  ${name}({`);
      codes.push(`    ${ctors.join(',\n    ')},`);
      codes.push(`  });`);
    } else {
      codes.push(`  ${name}();`);
    }
    codes.push('');
    codes.push(from.join('\n'));
    codes.push('');
    codes.push(to.join('\n'));
    codes.push('}');
    codes.push('');
    comments.push('/// {@end-tool}');
    return {
      code: comments.join('\n') + '\n' + codes.join('\n') + '\n' + subCode,
      map,
    };
  });
}

function getVal (obj, path) {
  let arr = path.split('.');
  while (obj && arr.length > 0) {
    obj = obj[arr.shift()];
  }
  if (arr.length > 0) {
    return;
  }
  return obj;
}

function restoreDataConfig (from) {
  return restore(from).then(function (data) {
    return data;
  }).catch(function (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    return Promise.reject(err);
  });
}

function isPickMatched (cond, data) {
  for (let p in cond) {
    let v = cond[p];
    let val = getVal(data, p);
    if (v === val) {
      continue;
    } else if (v === true) {
      if (typeof val === 'undefined') {
        return false;
      }
    } else if (v === false) {
      if (typeof val !== 'undefined') {
        return false;
      }
    } else if (typeof v !== typeof val) {
      return false;
    }
  }
  return true;
}

module.exports = function (rb, options) {
  const pick = options.picker ? (function (picker, data) {
    for (let key in picker) {
      let cond = picker[key];
      if (isPickMatched(cond, data)) {
        return getVal(data, key);
      }
    }
    return data;
  }).bind(this, options.picker) : function (data) {
    return data;
  }
  return rb.questionUntil('Enter json: ', function (obj) {
    if (obj) {
      try {
        obj = JSON.parse(obj);
      } catch (err) {
        rb.warn(err.message);
        return;
      }
      return pick(obj);
    }
  }, pick(options.data), true).then(function (obj) {
    rb.prompt('\nThe following json object was detected:\n%s\n', JSON.stringify(obj, null, 2).trim());
    let name = options.name || options.map && options.map.name;
    return rb.questionWhenEmpty('Enter name of json object: ', name).then(function (name) {
      options.name = name;
      // 获取输出文件
      let output = typeof options.output === 'function' ? options.output(name) : options.output;
      if (!output) {
        return options;
      }
      let withoutConfig = options.config || options.config === false;
      if (withoutConfig && !options.merge) {
        return options;
      }
      return restoreDataConfig(output).then(function (config) {
        if (options.merge) {
          obj = mergeData(config.data, obj);
          rb.prompt('\nThe merged json object is as follows:\n%s\n', JSON.stringify(obj, null, 2).trim());
        }
        delete config.data;
        return mergeConfig(config, options);
      });
    }).then(function (options) {
      let map = options.map || {};
      if (!options.cmd) {
        options.cmd = 'json2dart';
      }
      const name = map.name = options.name;
      return parseObject(rb, obj, map, options).then(function (data) {
        map.map = data.map;
        return {
          name,
          code: data.code,
          map,
        };
      });
    });
  })
};
