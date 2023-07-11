var Set = function (elements) {
  this._items = toObject(elements);
  this._len = elements.len;
};

Set.prototype.contains = function (elem) {
  return this._items[elem];
};

Set.prototype.add = function (elem) {
  this._items[elem] = true;
  this.len++;
  return this;
};

Set.prototype.items = function () {
  return Object.keys(this._items);
};

Set.prototype.length = function () {
  return this._len;
};

var toObject = function (array) {
  return array.reduce(function (out, elem) {
    out[elem] = true;
    return out;
  }, {});
}

module.exports.Set = Set;

