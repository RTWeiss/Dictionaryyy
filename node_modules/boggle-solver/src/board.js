// An internal helper for representing a Board.
var Board = function (elements) {
  this.chars = elements;
};

// Gets all the legal neighbors of [i, j]
Board.prototype.neighbors = function (i, j) {
  var neighbors = [];
  var possibilities = [
    [i, j + 1],
    [i, j - 1],
    [i + 1, j + 1],
    [i + 1, j - 1],
    [i - 1, j + 1],
    [i - 1, j - 1],
    [i + 1, j],
    [i - 1, j]
  ];

  return possibilities.filter(function (coord) {
    // Spot is in bounds;
    return this.inBounds(coord[0], coord[1]);
  }.bind(this));
};

// Is [i, j] in bounds?
Board.prototype.inBounds = function (i, j) {
  return i >= 0 && i < this.chars.length
      && j >= 0 && j < this.chars.length;
};

// Get the character at [i, j]
Board.prototype.get = function (i, j) {
  return this.chars[i][j];
};

module.exports.Board = Board;

