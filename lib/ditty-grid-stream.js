var Through = require('through')
var watchGridChanges = require('./watch-grid-changes')

module.exports = DittyGridStream

function DittyGridStream(observableGrid, mapping, scheduler){

  var offEvents = []
  var stream = Through()

  var removeListener = watchGridChanges(observableGrid, function(changes, isRevert){
    changes.forEach(function(change){
      var key = change[0] + '/' + change[1]
      if (offEvents[key]){
        offEvents[key].time = scheduler.context.currentTime
        offEvents[key].position = scheduler.getCurrentPosition()
        stream.queue(offEvents[key])
        offEvents[key] = null
      }

      if (change[2]){
        var id = mapping().get(change[0], change[1])
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