var fs = require('fs');
var Set = require('./set.js').Set;

var DICTIONARY_FILE = "./dictionary.txt";
var cache = null;

module.exports = function () {
  if (cache) { return cache; }

  try {
    // Not important to be asynchronous here, since we
    // do this just once and not under load.
    var dictionary = fs.readFileSync(DICTIONARY_FILE, { encoding: "utf-8" });
  } catch (e) {
    return null;
  }

  var words = dictionary.split('\n');
  cache = new Set(words);
  return cache;
};


