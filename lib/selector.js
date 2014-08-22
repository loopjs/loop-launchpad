var ObservGrid = require('observ-grid')
var ObservArray = require('observ-array')

var watchGridChanges = require('./watch-grid-changes')

module.exports = function(inputGrabber, selection, selectionOutput, selectionColor){
  selection = selection || ObservArray([])

  var releases = []

  function toggleSelected(row, col){
    var index = selectionOutput.index(row, col)
    var i = selection.indexOf(index)
    if (~i){
      selection.splice(i, 1)
    } else {
      selection.push(index)
    }
  }

  function select(row, col){
    var index = selectionOutput.index(row, col)
    if (!~selection.indexOf(index)){
      selection.push(index)
    }
  }

  function selectRange(start, end){
    var rowStart = Math.min(start[0], end[0])
    var rowEnd = Math.max(start[0], end[0])
    var colStart = Math.min(start[1], end[1])
    var colEnd = Math.max(start[1], end[1])

    for (var row=rowStart;row<=rowEnd;row++){
      for (var col=colStart;col<=colEnd;col++){
        select(row, col)
      }
    }
  }

  function release(){
    releases.forEach(invoke)
    releases = []
  }

  // update output
  selection(function(values){
    gridForEach(selectionOutput(), function(value, row, col, i){
      if (!value && ~values.indexOf(i)){
        selectionOutput.set(row, col, selectionColor)
      } else if (value && !~values.indexOf(i)){
        selectionOutput.set(row, col, null)
      }
    })
  })

  var downNotes = []

  function handleInput(changes, isRevert){
    changes.forEach(function(change){
      var id = selectionOutput.index(change[0], change[1])
      if (change[2]){
        if (downNotes.length){
          selectRange(selectionOutput.coordsAt(downNotes[0]), change)
        } else {
          toggleSelected(change[0], change[1])
        }
        downNotes.push(id)
      } else {
        remove(downNotes, id)
      }
    })
  }

  return {
    selection: selection,
    start: function(){
      release()
      releases.push(
        watchGridChanges(inputGrabber, handleInput)
      )
    },
    stop: function(){
      release()
    },
    set: function(values){

    },
    clear: function(){
      selection.splice(0, selection.getLength())
    }
  }
}

function invoke(f){
  return f()
}

function remove(array, value){
  var index = array.indexOf(value)
  if (~index){
    array.splice(index, 1)
  }
}

function gridForEach(grid, iterator){
  for (var r=0;r<grid.shape[0];r++){
    for (var c=0;c<grid.shape[1];c++){
      iterator(grid.get(r,c), r, c, grid.index(r,c))
    }
  }
}