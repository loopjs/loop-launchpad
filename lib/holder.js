module.exports = function(looper){
  var release = null

  var holding = false
  var length = 2
  var start = null

  function refresh(){
    if (holding){
      release&&release()
      release = looper.transform(hold, start, length)
    } else if (release) {
      release()
      release = null
    }
  }

  return {
    getLength: function(){
      return length
    },
    setLength: function(value){
      if (length !== value){
        length = value
        refresh()
      }
    },
    start: function(position){
      if (!holding){
        start = position
        holding = true
        refresh()
      }
    },
    stop: function(){
      if (holding){
        holding = false
        refresh()
      }
    }
  }
}

function hold(input, start, length){
  var end = start + length
  input.data.forEach(function(loop, i){

    var from = start % loop.length
    var to = end % loop.length
    var events = []

    loop.events.forEach(function(event){
      if (inRange(from, to, event[0])){
        event = event.concat()
        event[0] = event[0] % length
        event[1] = Math.min(event[1], length)
        events.push(event)
      }
    })

    input.data[i] = {
      events: events,
      length: length
    }

  })
  return input
}

function inRange(from, to, value){
  if (to > from){
    return value >= from && value < to
  } else {
    return value >= from || value < to
  }
}