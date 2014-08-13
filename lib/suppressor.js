module.exports = function(loopGrid, outputState, color){

  var releases = []

  function release(){
    releases.forEach(invoke)
    releases = []
  }

  function updateDisplay(selection){
    gridForEach(outputState(), function(value, row, col, i){
      if (!value && ~selection.indexOf(i)){
        outputState.set(row, col, color)
      } else if (value && !~selection.indexOf(i)){
        outputState.set(row, col, null)
      }
    })
  }

  return {
    start: function(selection){
      selection = typeof selection === 'function' ? selection() : selection
      releases.push(
        loopGrid.transform(function(input){
          input.data.forEach(function(loop, i){
            if (loop && (!selection || !selection.length || ~selection.indexOf(i))){
              loop.events = []
            }
          })
          return input
        })
      )
      updateDisplay(selection)
    },

    stop: function(){
      release()
      updateDisplay([])
    }
  }
}

function invoke(f){
  return f()
}

function gridForEach(grid, iterator){
  for (var r=0;r<grid.shape[0];r++){
    for (var c=0;c<grid.shape[1];c++){
      iterator(grid.get(r,c), r, c, grid.index(r,c))
    }
  }
}