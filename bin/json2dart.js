#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const generate = require('../src/generate');
const restore = require('../src/restore');
const ReadBlock = require('../src/read-block');
const {
  getArg, name2file, getShortArg, ifUndefined,
  readJsonOrFile, formatCode, NOT_FOUND,
  newConfig, mergeData, getFlag
} = require('../src/utils');
const locale = require('../src/locale');

const CMD = 'json2dart';

function zhHelp () {
  return console.error(`使用: ${CMD} [options...]

选项: 
      --[no-]concat           是否连接键的路径作为类名(默认: true)
      --[no-]config [CONFIG]  JSON对象的特殊配置[文件](默认: 包含在已经生成的Dart文件中的配置)
                              \`--no-config\`表示不加载Dart文件中的配置，使用全新的配置生成
      --dir CODE DIRECTORY    *存储生成代码的目录。
      --dry-run               只是执行并输出结果，但是不会存储文件。
      --file DART FILE        指定存储文件，默认会根据类名得到文件
  -f, --force                 强制写入文件，即使文件存在
      --from JSON FILE/URL    JSON数据源，可以是文件或者URL地址(默认: 标准输入)
      --from-option           *获取JSON数据需要的参数。通常是用于HTTP请求，比如Headers
      --formatter FORMATTER   *Dart代码个时候(默认: dartfmt)
  -l, --language LANG         帮助信息的语言(zh/en)
      --max-comment LENGTH    *注释中最大JSON数据长度, 用于在注释中存储冗余的JSON数据(默认: 0, 不存储额外非必要的JSON)
      --[no-]merge            如果Dart文件已经存在，是否把文件中数据合并到输入的JSON中(默认: true)
  -n, --name NAME             生成类的名称.
      --[no-]prefix [PREFIX]  除了顶级类之外其他所有类名的前缀
      --rebuild DART FILE     基于Dart文件的注释中的配置信息重新生成该文件。通常用于全局的配置改变了，或者
                              或者Dart文件中的有效的注释信息被修改了，比如添加了字段、修改了类名
      --restore DART FILE     从Dart文件中还原JSON数据
      --[no-]strict           *使用严格模式, 所有的数字都会使用更具体的类型，比如int、double(默认: false，所有的数字使用num类型)
      --[no-]suffix           数组项是否需要追加\`arrayItemSuffix\`定义的后缀作为类名(默认: true)
      --verbose               打印更多详细信息.
  -y, --yes                   对于有默认选项的直接使用默认选项进行生成，而不需要确认

举例:
  1. 按照提示从标准输入获取数据生成:
    json2dart --name ClassName 
  2. 从JSON文件获取数据生成:
    json2dart --name ClassName --from data.json
  3. 从HTTP请求获取数据生成:
    json2dart --name ClassName --from http://url/of/data.json
  4. 重新构建已生成的Dart文件
    json2dart --rebuild lib/models/class_name.dart

在当前工作目录的\`.json2dart\`可以配置一些通用选项.
{
  "picker": { // JSON数据提取，通过提取可以去掉外层的包装
    "data": { // 当数据匹配以下条件时，提取输入JSON中的[data](可以是用点分隔的路径，比如api.data)字段作为最终的数据
      "success": true, // 输入JSON有[success]字段
      "error": true // 并且输入JSON有[error]字段
      "id": false // 并且输入JSON没有[id]字段
    } // 可以配置多种提取
  },
  "array": ["list", "items"], // JSON数据中常用做数组名称，这些名称不会在默认生成的对象名中被拼接
  "variables": ["json", "j", "d", "_json"], // 可用的变量列表，用于解决生成的方法命名冲突的问题
  "dir": "lib/models", // 默认的存放代码的目录
  "formatter": "dartfmt", // 格式化工具命令
  "maxComment": 0,
  "fromOption": { // 可以是对象，也可以是文件名
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
`);
}

function help () {
  return console.error(`Usage: ${CMD} [options...]
Options: 
      --[no-]concat          Concat the key path as the class name
      --[no-]config [CONFIG] The JSON object specific configuration (default: the configuration is already 
                             included in the generated dart file);
                             \`--no-config\` means generate without the configuration included in the
                             generated dart file
      --dir CODE DIRECTORY   *The directory where the generated file is stored.
      --dry-run              Just run and output the result, won't save to file.
      --file DART FILE       Output file, default based on class name
  -f, --force                Force save to file, even if the file already exists.
      --from JSON FILE/URL   JSON data file/url used to generate objects(default: stdin)
      --from-option          *The options used to fetch JSON data from file/url.
                             Usually an option for http request, such as headers, etc.
      --formatter FORMATTER  *The dart code formatter (default: dartfmt)
  -l, --language LANG        The language of the help
      --max-comment LENGHT   *The max commnet length of object, used to redundantly store 
                             JSON data in comments (default: 0, no additional non-essential JSON)
      --[no-]merge           If the Dart file already exists, whether to merge the data in the file
                             into the input JSON (default: true)
  -n, --name CLASS NAME      The class name to be generated of top object.
      --[no-]prefix [PREFIX] The prefix of all class name except the top class
      --rebuild DART FILE    Rebuild dart based on its own configuration in the dart file.
                             Usually in the global configuration changes, or effective comments 
                             in the dart file changes, such as, add field or rename class name,etc.
      --restore DART FILE    Restore json object from the generated dart file.
      --strict               *Generate with strict mode, the number will specify a specific type,
                             such as int, double. (default: false, all numbers are of type num).
      --[no-]suffix          The array item with or without a prefix defined by \`arrayItemSuffix\`.
      --verbose              Print more infomation.
  -y, --yes                  Automatic generate use default option, without prompt.

For examples:
  1. Generate from stdin with prompt:
    json2dart --name ClassName 
  2. Generate from json file:
    json2dart --name ClassName --from data.json
  3. Generate from json request:
    json2dart --name ClassName --from http://url/of/data.json
  4. Rebuild the generated dart file
    json2dart --rebuild lib/models/class_name.dart

The file \`.json2dart\` in the work directory provides common options.
{
  "picker": { // JSON data extraction, the outer packaging can be removed by extraction
    "data": { // When the data matches the following conditions, extract the [data] (can be a path separated by dots, such as api.data) in the input JSON as the final data
      "success": true, // input JSON has [success] field
      "error": true // And the input JSON has [error] field
      "id": false // And the input JSON has no [id] field
    } // Multiple extractions can be configured
  },
  "array": ["list", "items"], // JSON data is often used as array names, these names will not be spliced in the object names generated by default
  "variables": ["json", "j", "d", "_json"], // List of available variables, used to solve the problem of naming conflicts in generated methods
  "dir": "lib/models", // The default directory for storing code
  "formatter": "dartfmt", // formatting tool command
  "maxComment": 0,
  "fromOption": {// Can be an object or a file name
    "headers": {
      "Authorization": "Bearer token"
    }
  }
}
`);
}

function defaultNaN (v, d) {
  if (isNaN(v)) {
    return parseInt(d, 10);
  }
  return parseInt(v, 10);
}

function main () {
  let l = ifUndefined(getArg('language'), getShortArg('l'));
  if (ifUndefined(getArg('version'), getShortArg('v'))) {
    return console.log(require('../package.json').version);
  } else if (ifUndefined(getArg('help'), getShortArg('h'))) {
    if (!l) {
      l = locale();
    }
    if (/^zh/.test(l)) {
      return zhHelp();
    }
    return help();
  }
  const verbose = getArg('verbose');
  const yes = ifUndefined(getArg('yes'), getShortArg('y'));
  const name = ifUndefined(getArg('name'), getShortArg('n'));
  const config = getArg('config');
  const restoreFrom = getArg('restore');
  const concat = getArg('concat');
  const prefix = ifUndefined(getArg('prefix'), getShortArg('p'));
  const suffix = getArg('suffix');

  if (restoreFrom) {
    return restore(restoreFrom).then(function (data) {
      if (verbose) {
        console.error(JSON.stringify(data.map, null, 2));
      }
      console.log(JSON.stringify(data.data, null, 2));
    }).catch(function (err) {
      console.error('restore error =>', err);
      process.exit(1);
    });
  }
  const cfg = readJsonOrFile('.json2dart');
  const defaults = {
    formatter: 'dartfmt',
    arrayItemSuffix: 'Item',
    concat: true,
  };
  for (let key in defaults) {
    if (typeof cfg[key] === 'undefined') {
      cfg[key] = defaults[key];
    }
  }
  let dir = getArg('dir');
  let dryRun = getArg('dry-run') === true;
  let force = ifUndefined(getArg('force'), getShortArg('f')) === true;
  let formatter = getArg('formatter', cfg.formatter);
  let strict = getArg('strict');
  let maxComment = getArg('max-comment');
  let merge = getFlag('merge') !== false;
  let defDirChecked = false;
  let defDir = 'lib/models';
  function getOutputDir () {
    if (!defDirChecked) {
      defDirChecked = true;
      if (!fs.existsSync(defDir)) {
        defDir = '';
      }
    }
    return dir || cfg.dir || defDir;
  }
  function getOutputFile (name) {
    return getArg('file') || path.resolve(getOutputDir(), name2file(name) + '.dart');
  }
  function normalize (data, from, fromOption, cmd, args) {
    const file = getOutputFile(data.name);
    cmd = cmd || CMD;
    cmd += (args || ` -n ${data.name}`);
    if (dir) {
      cmd += ` --dir ${dir}`;
    }
    if (strict) {
      cmd += ' --strict';
    }
    if (concat === false) {
      cmd += ' --no-concat';
    }
    if (prefix) {
      cmd += ` -p ${prefix}`;
    }
    if (suffix === false) {
      cmd += ' --no-suffix';
    }
    if (maxComment) {
      cmd += ` --max-comment ${maxComment}`;
    }
    if (from) {
      if (!/^http/.test(from)) {
        from = path.isAbsolute(from) ? path.relative(process.cwd(), from) : from;
        from = path.relative(getOutputDir(), from);
      }
      cmd += ` --from ${from}`;
      if (fromOption) {
        cmd += ` --from-option ${fromOption}`;
      }
    }
    if (config === true) {
      cmd += ` --config`;
    } else if (config) {
      cmd += ` --config ${config}`;
    }
    if (yes) {
      cmd += ` -y`;
    }
    const code = [`// GENERATED BY \`${cmd}\``, data.code].join('\n\n');
    return formatCode(code, formatter).then(function (code) {
      if (dryRun) {
        data.map.file = file;
        if (verbose) {
          try {
            console.error(JSON.stringify(data.map, null, 2));
          } catch (err) {
            console.error(data.map);
          }
          console.error();
        }
        console.log(code);
        process.exit(0);
      } else {
        fs.writeFile(file, Buffer.from(code, 'utf8'), { flag: force ? 'w' : 'wx' }, function (err) {
          if (err) {
            console.error('* save error=>', err);
            process.exit(1);
          } else {
            process.exit(0);
          }
        });
      }
    });
  }
  let rebuild = getArg('rebuild');
  if (rebuild) {
    return restore(rebuild).then(function (data) {
      const rb = new ReadBlock({
        output: process.stderr,
        yes: true,
        disablePrompt: true,
        interactive: false,
      });
      if (typeof strict === 'boolean') {
        data.strict = strict;
      }
      let maxC = defaultNaN(maxComment, cfg.maxComment);
      if (!isNaN(maxC)) {
        data.maxComment = maxC;
      }
      if (verbose) {
        console.error(JSON.stringify(data, null, 2));
        console.error();
      }
      if (typeof concat === 'boolean') {
        data.concat = concat;
      }
      if (typeof prefix !== 'undefined') {
        data.prefix = prefix;
      }
      if (typeof suffix !== 'undefined') {
        data.suffix = suffix;
      }
      for (let ck in cfg) {
        if (!(ck in data)) {
          data[ck] = cfg[ck];
        }
      }
      return generate(rb, data).then(function (result) {
        return normalize(result, null, null, data.cmd, data.args);
      });
    }).catch(function (err) {
      console.error('* rebuild error =>', err);
      if (err.raw) {
        console.log(err.raw);
      }
      process.exit(1);
    });
  }
  function fetchConfig () {
    if (config === true && name || /\.dart$/.test(config)) {
      return restore(getOutputFile(config === true ? name : config)).then(function (data) {
        delete data.data;
        return newConfig(cfg, data);
      }).catch(function (err) {
        if (err.code === NOT_FOUND) {
          return cfg;
        }
        return Promise.reject(err);
      });
    } else if (config) {
      return new Promise(function (resolve, reject) {
        fs.readFile(config, { encoding: 'utf-8' }, function (err, data) {
          if (err) {
            return reject(err);
          }
          try {
            return resolve(newConfig(cfg, JSON.parse(data)));
          } catch (err) {
            reject(err);
          }
        });
      });
    } else {
      return Promise.resolve(cfg);
    }
  }
  function generateByData (data, from, fromOption) {
    const rb = new ReadBlock({
      output: process.stderr,
      yes
    });
    return fetchConfig().then(function (cfg0) {
      let opts = {
        name,
        data,
        merge,
        maxComment: defaultNaN(maxComment, cfg.maxComment) || 0,
        output: getOutputFile,
      };
      if (typeof strict === 'boolean') {
        opts.strict = strict;
      }
      if (typeof concat === 'boolean') {
        opts.concat = concat;
      }
      if (typeof prefix !== 'undefined') {
        opts.prefix = prefix;
      }
      if (typeof suffix !== 'undefined') {
        opts.suffix = suffix;
      }
      opts.config = config;
      return generate(rb, newConfig(cfg0, opts));
    }).then(function (data) {
      return normalize(data, from, fromOption);
    }).catch(function (err) {
      console.error('* generate error =>', err);
      if (err.raw) {
        console.log(err.raw);
      }
      process.exit(1);
    });
  }

  function fetchData (src, opts) {
    if (/^http(s?)/.test(src)) {
      const request = RegExp.$1 ? require('https') : require('http');
      return new Promise(function (resolve, reject) {
        let req = request.get(src, opts, function (res) {
          res.setEncoding('utf8');
          let data = '';
          res.on('error', reject);
          res.on('data', function (chunk) {
            data += chunk;
          });
          res.on('end', function () {
            try {
              data = JSON.parse(data);
              if (verbose) {
                console.error('* http data => %s %j', res.statusCode, data);
              }
              if (res.statusCode !== 200) {
                return reject(data);
              }
              resolve({
                from: src,
                data
              });
            } catch (err) {
              err.raw = data;
              return reject(err);
            }
          });
        });
        req.on('error', reject);
      });
    } else {
      return new Promise(function (resolve, reject) {
        fs.readFile(src, function (err, data) {
          if (err) {
            if (err.code === NOT_FOUND) {
              src = path.resolve(getOutputDir(), src);
              return fs.readFile(src, function (err, data) {
                if (err) {
                  return reject(err);
                }
                try {
                  return resolve({
                    data: JSON.parse(data.toString('utf8')),
                    from: src,
                  });
                } catch (err) {
                  return reject(err);
                }
              });
            }
            return reject(err);
          }
          try {
            return resolve({
              data: JSON.parse(data.toString('utf8')),
              from: src,
            });
          } catch (err) {
            return reject(err);
          }
        });
      })
    }
  }
  const from = getArg('from');
  const fromOption = getArg('from-option');
  if (from) {
    let opts = newConfig(readJsonOrFile(cfg.fromOption), readJsonOrFile(fromOption));
    fetchData(from, opts).then(function (result) {
      return generateByData(result.data, result.from, fromOption);
    }).catch(function (err) {
      console.error('* generate error =>', err);
      if (err.raw) {
        console.log(err.raw);
      }
      process.exit(1);
    });
  } else {
    generateByData();
  }
}

main();
