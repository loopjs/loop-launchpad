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
    recording: mapGridValue(self.recording, stateLights.redLow),
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

  // export
  controllerGrid.inputGrabber = inputGrabber
  controllerGrid.layers = layers

  return controllerGrid
}