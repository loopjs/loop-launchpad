var ObservGrid = require('observ-grid')
var ObservGridGrabber = require('observ-grid/grabber')
var ObservGridStack = require('observ-grid-stack')
var ObservMidi = require('observ-midi')

var DittyGridStream = require('ditty-grid-stream')
var gridMapping = require('./grid-mapping.js')
var stateLights = require('../state-lights')

var mapGridValue = require('observ-grid/map-values')

module.exports = function(self, opts){
  // opts: duplexPort, triggerOutput, scheduler, noRepeat

  var recording = {}

  var shape = self.grid().shape

  var outputStack = ObservGridStack([
    //recording: 
    mapGridValue(self.recording, stateLights.redLow),

    //active: 
    mapGridValue(self.active, stateLights.greenLow),

    //selection: 
    mapGridValue(self.selected, stateLights.green),

    //suppressing: 
    mapGridValue(self.suppressing, stateLights.red),

    //playing: 
    mapGridValue(self.playing, stateLights.amber)
  ])

  var controllerGrid = ObservMidi(opts.duplexPort, gridMapping, outputStack)
  var inputGrabber = ObservGridGrabber(controllerGrid)

  // trigger notes at bottom of input stack
  DittyGridStream(inputGrabber, self.grid, opts.scheduler).pipe(opts.triggerOutput)

  // export
  controllerGrid.inputGrabber = inputGrabber

  return controllerGrid
}