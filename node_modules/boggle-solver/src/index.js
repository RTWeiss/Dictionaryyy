var dictionary = require('./dictionary.js')();
var Set = require('./set.js').Set;
var Board = require('./board.js').Board;

// Create a new Boggle proble.
//
// Args:
//   board: [[char | "qu"]] - the input boggle board
var Boggle = function (board) {
  this.board = new Board(board);

  // Used during traversal to avoid cycles.
  //
  // [[undefined]] for now.
  this.visited = board.slice().map(function () {
    return new Array(board.length);
  });
};

// Solve this Boggle problem.
//
//  Returns: [String] - all possible words on this board
Boggle.prototype.solve = function () {
  if (!dictionary) { throw new Error("Dictionary could not be loaded."); }
  // Start with no words.
  var words = new Set([]);

  // Run an exhaustive search for all words in the board.
  for (var i = 0; i < this.board.chars.length; i++) {
    for (var j = 0; j < this.board.chars[0].length; j++) {
      this._runSearchFrom(i, j, words);
    }
  }

  return words.items().map(function (word) {
    // Words are formatted as w,o,r,d so fix it.
    return word.split('').filter(function (x) { return x != ','; }).join('');
  });
};

// Search from this.board[i][j] and add all found words to words.
Boggle.prototype._runSearchFrom = function (i, j, words) {
  this._continueSearchFrom(i, j, [], words);
};

Boggle.prototype._continueSearchFrom = function (i, j, word, words) {
  // Add this letter
  word.push(this.board.get(i, j));
  this.visited[i][j] = true;

  // Check for a legal word.
  if (dictionary.contains(word.join(''))) { words.add(word); }

  // Continue the search.
  var possibilities = this.board.neighbors(i, j).filter(function (coord) {
    // No cycles are allowed, so ensure we haven't visited this spot.
    return !this.visited[coord[0]][coord[1]];
  }.bind(this));

  possibilities.forEach(function (coordinates) {
    this._continueSearchFrom(coordinates[0], coordinates[1], word, words);
  }.bind(this));

  // Undo the addition of this letter so the buffer can be re-used.
  word.pop();
  this.visited[i][j] = undefined;
};

module.exports.Boggle = Boggle;

// Solve this boggle board directly.
module.exports.boggle = function (board) {
  return new Boggle(board).solve();
};

