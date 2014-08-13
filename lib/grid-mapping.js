var ArrayGrid = require('array-grid')

var result = []
var message = 144
for (var r=0;r<8;r++){
  for (var c=0;c<8;c++){
    var noteId = (r*16) + (c % 8)
    result.push(message + '/' + noteId)
  }
}

module.exports = ArrayGrid(result, [8,8])