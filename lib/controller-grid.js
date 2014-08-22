var ObservGrid = require('observ-grid')
var ObservGridGrabber = require('./observ-grid-grabber')
var ObservGridStack = require('observ-grid-stack')
var ObservMidi = require('observ-midi')

var DittyGridStream = require('./ditty-grid-stream')
var gridMapping = require('./grid-mapping.js')
var stateLights = require('../state-lights')


module.exports = function(self, opts){
  // opts: duplexPort, triggerOutput, scheduler, noRepeat

  var playing = {}
  var recording = {}

  var shape = self.grid().shape

  // output layers
  var layers = {
    recording: ObservGrid([], shape),
    active: ObservGrid([], shape),
    selection: ObservGrid([], shape),
    playing: ObservGrid([], shape),
    suppressing: ObservGrid([], shape)
  }
  var outputStack = ObservGridStack([
    layers.recording, layers.active, layers.selection, layers.suppressing, layers.playing
  ])

  var controllerGrid = ObservMidi(opts.duplexPort, gridMapping, outputStack)
  var inputGrabber = ObservGridGrabber(controllerGrid)

  // highlight playing on grid
  var lastTriggeredAt = {}
  opts.triggerOutput.on('data', function(data){
    var coords = self.grid().lookup(data.id)
    lastTriggeredAt[data.id] = data.position
    if (coords){
      if (data.event === 'start'){
        layers.playing.set(coords[0], coords[1], stateLights.amber)
      } else if (data.event === 'stop'){
        layers.playing.set(coords[0], coords[1], null)
      }
    }
  })

  // trigger notes at bottom of input stack
  DittyGridStream(inputGrabber, self.grid, opts.scheduler).pipe(opts.triggerOutput)

  // highlight notes currently active on grid
  opts.player.on('change', function(descriptor){
    var value = descriptor.events && descriptor.events.length && true || null
    if (value != descriptor.id){
      playing[descriptor.id] = value
      refreshActive()
    }
  })
  self.grid(refreshActive)

  // highlight recording on grid
  self.grid(refreshRecording)
  opts.scheduler.on('data', checkRecording)

  // export
  controllerGrid.inputGrabber = inputGrabber
  controllerGrid.layers = layers

  return controllerGrid

  // scoped

  function checkRecording(schedule){
    var changed = false
    Object.keys(lastTriggeredAt).forEach(function(key){
      var value = (lastTriggeredAt[key] > schedule.to - self.loopLength())
      if (value != recording[key]){
        recording[key] = value
        changed = true
      }
    })
    if (changed){
      refreshRecording()
    }
  }

  function refreshRecording(){
    gridForEach(self.grid(), function(val, row, col, i){
      var currentState = layers.recording.get(row, col)
      var value = recording[val]
      if (value && currentState != stateLights.redLow){
        layers.recording.set(row, col, stateLights.redLow)
        self.recording.push(i)
      } else if (!value && currentState != null){
        layers.recording.set(row, col, null)
        var index = self.recording.indexOf(i)
        if (~index){
          self.recording.splice(index, 1)
        }
      }
    })
  }

  function refreshActive(){
    gridForEach(self.grid(), function(val, row, col){
      var currentState = layers.active.get(row, col)
      var value = playing[val]
      if (value && currentState != stateLights.greenLow){
        layers.active.set(row, col, stateLights.greenLow)
      } else if (!value && currentState != null){
        layers.active.set(row, col, null)
      }
    })
  }
}


function gridForEach(grid, iterator){
  for (var r=0;r<grid.shape[0];r++){
    for (var c=0;c<grid.shape[1];c++){
      iterator(grid.get(r,c), r, c)
    }
  }
}