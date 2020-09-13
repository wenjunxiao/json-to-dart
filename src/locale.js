const lcid = require('lcid');
const execSync = require('child_process').execSync;

function getStdOutSync (cmd) {
  let output = execSync(cmd);
  return output.toString('utf8').trim();
}

function getEnvLocale (env = process.env) {
  return env.LC_ALL || env.LC_MESSAGES || env.LANG || env.LANGUAGE;
}

function getWinLocaleSync () {
  let stdout = getStdOutSync('wmic os get locale');
  let lcidCode = parseInt(stdout.replace('Locale', ''), 16);
  return lcid.from(lcidCode);
}

function getAppleLocaleSync () {
  let stdout = getStdOutSync('defaults read -globalDomain AppleLocale');
  return stdout;
}

module.exports = function () {
  let locale = getEnvLocale();
  if (locale) return locale;
  switch (process.platform) {
    case 'win32':
      return getWinLocaleSync;
    case 'darwin':
      return getAppleLocaleSync();
  }
  let env = execSync('locale').toString('utf8').split('\n').reduce(function (r, l) {
    let arr = l.split('=').filter(function (s) { return !!s; });
    if (arr.length > 1) {
      r[arr[0]] = arr[1];
    }
    return r;
  }, {});
  return getEnvLocale(env);
};
