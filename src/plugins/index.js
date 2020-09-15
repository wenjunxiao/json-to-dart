const plugins = [
  require('./jetbrains-12562'),
];

module.exports = {
  printPlugins (fmt) {
    const widths = [0, 0, 0];
    const updateWidth = (i, s) => {
      widths[i] = Math.max(widths[i], s && s.length || 0);
    };
    const pad = (s, i) => {
      const w = widths[i];
      s = s || '';
      while (s.length < w) {
        s += ' ';
      }
      return s;
    };
    if (fmt === true) {
      fmt = '%id • %name • %homepage • %alias';
    }
    for (let p of plugins) {
      updateWidth(0, p.id);
      updateWidth(1, p.name);
      updateWidth(2, p.homepage);
    }
    const variables = [
      'id',
      'name',
      'homepage',
      'alias',
    ];
    let names = [];
    let msgFmt = fmt.replace(/%(\w+)/g, function ($0, $1) {
      let name = $1.toLowerCase();
      if (variables.includes(name)) {
        names.push($1.toLowerCase());
        return '%s';
      }
      return '%' + $0;
    });
    console.error.apply(console, [msgFmt].concat(names.map(s => pad(s.toUpperCase(), variables.indexOf(s)))));
    for (let p of plugins) {
      console.log.apply(console, [msgFmt].concat(names.map(s => pad(p[s], variables.indexOf(s)))));
    }
  },
  getPlugin (idOrName) {
    for (let p of plugins) {
      if (p.id === idOrName) {
        return p.fn;
      }
    }
    for (let p of plugins) {
      if (p.name === idOrName) {
        return p.fn;
      }
    }
    for (let p of plugins) {
      if (p.alias && p.alias.includes(idOrName)) {
        return p.fn;
      }
    }
  }
};
