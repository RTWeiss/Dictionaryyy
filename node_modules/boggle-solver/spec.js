var boggle = require('./src').boggle;
var expect = require('chai').expect;

describe("boggle", function () {
  it("should find all major word kinds", function () {
    expect(boggle([
      ['e', 'e', 'l'],
      ['m', 'l', 'b'],
      ['t', 'i', 'e'],
    ])).to.include.members([
      // Horizontal
      'tie',
      'eel',

      // Vertical
      'ell',

      // Bent
      'lie',

      // Diagonal
      'elm',
      'bile',
      'melt'

      // There are more words but this
      // ensures it catches all the basic
      // cases
    ])
  });

  // A quick integration test to ensure we don't break anything
  // during refactors.
  it("should find all words", function () {
    expect(boggle([
          ['e', 'e', 'l'],
          ['m', 'l', 'b'],
          ['t', 'i', 'e'],
    ])).to.eql([
      'eel', 'el', 'elm', 'ell', 'elemi', 'em', 'emit', 'eme', 'lee',
      'mi', 'mib', 'mil', 'mile', 'milt', 'mill', 'mille', 'me', 'mel',
      'mell', 'melt', 'lei', 'li', 'lie', 'lit', 'lib', 'libel', 'lime',
      'bi', 'bit', 'bile', 'bill', 'be', 'bel', 'bell', 'belle', 'bee',
      'belt', 'belie', 'ti', 'tie', 'time', 'til', 'tile', 'till', 'it',
      'ill'
    ])
  });

  it("should work with 'qu'", function () {
    expect(boggle([
      ['e', 'qu', 'a'],
      ['k', 'z', 'l'],
      ['g', 'f', 'd']
    ])).to.contain('equal');
  });
});

