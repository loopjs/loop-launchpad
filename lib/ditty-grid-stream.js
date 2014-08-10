var Through = require('through')

module.exports = DittyGridStream

function DittyGridStream(observableGrid, mapping, scheduler){

  var offEvents = []
  var lastInput = observableGrid()

  var stream = Through()

  var removeListener = observableGrid(function(grid, isRevert){
    var changes = []

    if (!isRevert){ // don't send the notes again if we are reverting
      if (grid._diff){
        changes.push({coords: grid._diff[0], value: grid._diff[2]})
      } else {
        // search for changes
        for (var r=0;r<8;r++){
          for (var c=0;c<8;c++){
            var val = grid.get(r,c)
            if (lastInput.get(r,c) != val){
              changes.push({coords: [r,c], value: val})
            }
          }
        }
      }
    }

    lastInput = grid

    changes.forEach(function(change){
      var key = change.coords[0] + '/' + change.coords[1]
      if (offEvents[key]){
        offEvents[key].time = scheduler.context.currentTime
        offEvents[key].position = scheduler.getCurrentPosition()
        stream.queue(offEvents[key])
        offEvents[key] = null
      }

      if (change.value){
        var id = mapping().get(change.coords[0], change.coords[1])
        if (id != null){

          // send on event
          stream.queue({
            time: scheduler.context.currentTime,
            position: scheduler.getCurrentPosition(),
            id: id,
            event: 'start'
          })

          // queue off event
          offEvents[key] = {
            id: id,
            event: 'stop'
          }

        }
      }
    })
  })

  stream.on('end', removeListener)

  return stream
}