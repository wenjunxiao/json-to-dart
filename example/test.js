const {
  mergeConfig,
  mergeData,
  isEqual,
} = require('../src/utils');

function checkEqual (v, e) {
  if (!isEqual(v, e)) {
    console.log('not equal =>', v, e);
  }
}

checkEqual(mergeConfig({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
checkEqual(mergeConfig({ a: [1] }, { a: [2] }), { a: [2] });
checkEqual(mergeConfig({ a: [1, 2] }, { a: [2, 3, 4] }), { a: [2, 3, 4] });
checkEqual(mergeConfig({ a: [1, 2, 3] }, { a: [2, 3] }), { a: [2, 3] });
checkEqual(mergeConfig({ a: [{ o: 1 }] }, { a: [{ o: 2 }] }), { a: [{ o: 2 }] });
checkEqual(mergeConfig({ a: [{ o: 1, c: 3 }] }, { a: [{ o: 2 }] }), { a: [{ o: 2 }] });


checkEqual(mergeData({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
checkEqual(mergeData({ a: [1] }, { a: [2] }), { a: [2] });
checkEqual(mergeData({ a: [1, 2] }, { a: [2, 3, 4] }), { a: [2, 3, 4] });
checkEqual(mergeData({ a: [1, 2, 3] }, { a: [2, 3] }), { a: [2, 3, 3] });
checkEqual(mergeData({ a: [{ o: 1 }] }, { a: [{ o: 2 }] }), { a: [{ o: 2 }] });
checkEqual(mergeData({ a: [{ o: 1, c: 3 }] }, { a: [{ o: 2 }] }), { a: [{ o: 2, c: 3 }] });
checkEqual(mergeData({ a: [{ o: 1, c: 3 }] }, { a: [{ o: 2, d: 4 }] }), { a: [{ o: 2, c: 3, d: 4 }] });
