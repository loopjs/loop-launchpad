var LoopGrid = require('loop-grid')
var Controller = require('midi-controller')

var stateLights = require('./lib/state_lights')
var repeatStates = [1, 2/3, 1/2, 1/3, 1/4, 1/6, 1/8]

module.exports = function Launchpad(opts){

  opts = opts || {}
  opts.shape = [8, 8]

  var duplexPort = opts.midi

  // clear lights
  duplexPort.write([176, 0, 0])

  var self = LoopGrid(opts)

  var controller = Controller(duplexPort)
  var noteMatrix = controller.createNoteMatrix(generateNoteGrid(144, 0), stateLights.amber)

  self.setMidi = function(port){
    duplexPort = port
    controller.setPort(port)
    duplexPort.write([176, 0, 0])
  }

  // handle lighting up notes

  // play notes

  // repeat modes

  // learn, suppress, undo, redo, hold

  // move

  return self
}