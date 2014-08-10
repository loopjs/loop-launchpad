module.exports = function(inputStack, loopGrid){

  var repeater = {}

  var release = null
  var releaseTransform = null

  var activeGrid = null
  var repeatLength = 1

  repeater.setLength = function(value){
    repeatLength = value
    refresh()
  }

  repeater.getRepeat = function(){
    if (release){
      return repeatLength
    }
  }

  repeater.start = function(length){
    if (!release){
      release = inputStack(function(grid){
        activeGrid = grid
        refresh()
      })

      activeGrid = inputStack()
      refresh()
    }
    if (length){
      repeater.setLength(length)
    }
  }

  repeater.stop = function(){
    if (release){
      release()
      release = null
    }
    activeGrid = null
    refresh()
  }

  function refresh(){
    if (releaseTransform) {
      releaseTransform()
      releaseTransform = null
    }

    var active = []

    if (activeGrid){
      activeGrid.data.forEach(function(val, i){
        if (val){
          active.push(i)
        }
      })
    }

    if (active.length && repeatLength){
      releaseTransform = loopGrid.transform(repeat, active, repeatLength)
    }
  }

  return repeater
}

function repeat(input, active, length){
  active.forEach(function(index){
    input.data[index] = {
      events: [[0, length/2]],
      length: length
    }
  })
  return input
}