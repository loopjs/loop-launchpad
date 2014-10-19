var ObservGrid = require('observ-grid')
var ObservGridGrabber = require('observ-grid/grabber')
var ObservGridStack = require('observ-grid-stack')
var ObservMidi = require('observ-midi')

var DittyGridStream = require('./ditty-grid-stream')
var gridMapping = require('./grid-mapping.js')
var stateLights = require('../state-lights')

var mapGridValue = require('./map-grid-value.js')

module.exports = function(self, opts){
  // opts: duplexPort, triggerOutput, scheduler, noRepeat

  var recording = {}

  var shape = self.grid().shape

  // output layers
  var layers = {
    recording: ObservGrid([], shape),
    active: mapGridValue(self.active, stateLights.greenLow),
    selection: ObservGrid([], shape),
    playing: mapGridValue(self.playing, stateLights.amber),
    suppressing: ObservGrid([], shape)
  }
  var outputStack = ObservGridStack([
    layers.recording, layers.active, layers.selection, layers.suppressing, layers.playing
  ])

  var controllerGrid = ObservMidi(opts.duplexPort, gridMapping, outputStack)
  var inputGrabber = ObservGridGrabber(controllerGrid)

  // trigger notes at bottom of input stack
  DittyGridStream(inputGrabber, self.grid, opts.scheduler).pipe(opts.triggerOutput)

  // highlight notes currently active on grid
  
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
    var lastTriggeredAt = self.playing.lastTriggeredAt
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

}

function gridForEach(grid, iterator){
  for (var r=0;r<grid.shape[0];r++){
    for (var c=0;c<grid.shape[1];c++){
      iterator(grid.get(r,c), r, c, grid.index(r,c))
    }
  }
}