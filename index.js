var LoopGrid = require('loop-grid')
var Observ = require('observ')
var ObservArray = require('observ-array')

var Repeater = require('./lib/repeater')
var Holder = require('./lib/holder')
var Selector = require('./lib/selector')
var Mover = require('./lib/mover')
var Suppressor = require('./lib/suppressor')

var stateLights = require('./state-lights')
var ControllerGrid = require('./lib/controller-grid')
var RepeatButtons = require('./lib/repeat-buttons')
var ControlButtons = require('./lib/control-buttons')

var ObservStruct = require('observ-struct')

var computed = require('observ/computed')

var PortHolder = require('./port-holder')

module.exports = function Launchpad(opts){

  var opts = Object.create(opts)
  opts.shape = [8, 8]

  var portHolder = PortHolder(opts)
  var duplexPort = portHolder.stream
  var triggerOutput = opts.triggerOutput

  duplexPort.on('switch', function(){
    duplexPort.write([176, 0, 0])
  })

  var self = LoopGrid(opts, {
    port: portHolder
  })

  var noRepeat = computed([self.flags], function(flags){
    var noRepeatIndexes = []
    flags.data.forEach(function(val, i){
      if (val){
        if (~val.indexOf('noRepeat')){
          noRepeatIndexes.push(i)
        }
      }
    })
    return noRepeatIndexes
  })


  self.repeatLength = Observ(2)
  self.loopLength = Observ(8)
  self.selection = ObservArray([])
  self.recording = ObservArray([]),
  self.loopPosition = Observ()

  // for binding to visual interface
  self.gridState = computed([
    controller.grid, controller.selection, controller.playing, controller.recording, controller.flags
  ], function(grid, selection, playing, recording, flags){
    var length = grid.data.length
    var result = []
    for (var i=0;i<length;i++){
      if (grid.data[i]){
        result = {
          id: grid.data[i],
          isPlaying: playing.data[i],
          isSelected: !!~selection.indexOf(i),
          isRecording: !!~recording.indexOf(i),
          flags: flags.data[i]
        }
      }
    }
    return result
  })

  var lastPosition = -1
  opts.scheduler.on('data', function(schedule){
    if (Math.floor(schedule.from*10) > Math.floor(lastPosition*10)){
      self.loopPosition.set(Math.floor(schedule.from) % self.loopLength())
      lastPosition = schedule.from
    }
  })

  var buttons = ControlButtons(self, duplexPort)
  var repeatButtons = RepeatButtons(self, duplexPort)

  var controllerGrid = self.controllerGrid = ControllerGrid(self, {
    duplexPort: duplexPort, 
    triggerOutput: triggerOutput,
    scheduler: opts.scheduler,
    player: opts.player
  })

  var inputGrabber = controllerGrid.inputGrabber
  var layers = controllerGrid.layers

  var repeater = Repeater(inputGrabber, self, noRepeat)
  var holder = Holder(self)
  var selector = Selector(inputGrabber, self.selection, layers.selection, stateLights.green)
  var mover = Mover(self, inputGrabber)
  var suppressor = Suppressor(self, layers.suppressing, stateLights.red)

  var learnMode = 'store'
  var recordingNotes = []

  function refreshLearnButton(){
    if (self.transforms.getLength()){
      buttons.loopRange.state.set(stateLights.greenLow)
      learnMode = 'flatten'
    } else {
      if (recordingNotes.length > 0){
        buttons.loopRange.state.set(stateLights.redLow)
      } else {
        buttons.loopRange.state.set(stateLights.off)
      }
      learnMode = 'store'
    }
  }

  buttons.loopRange(function(value){
    if (value){
      buttons.loopRange.flash(stateLights.green)
      if (learnMode === 'store'){
        self.loopRange(opts.scheduler.getCurrentPosition()-self.loopLength(), self.loopLength())
      } else if (learnMode === 'flatten'){
        self.flatten()
        clearSelection()
      }
    }
  })

  self.transforms(function(transforms){
    refreshLearnButton()
  })

  buttons.undo.output.set(stateLights.redLow)
  buttons.undo(function(value){
    if (value){
      buttons.undo.flash(stateLights.red, 100)
      self.undo()
    }
  })

  buttons.redo.output.set(stateLights.redLow)
  buttons.redo(function(value){
    if (value){
      buttons.redo.flash(stateLights.red, 100)
      self.redo()
    }
  })

  buttons.hold(function(value){
    if (value){
      buttons.hold.output.set(stateLights.yellow)
      holder.start(opts.scheduler.getCurrentPosition(), selector.selection())
    } else {
      buttons.hold.output.set(stateLights.off)
      holder.stop()
    }
  })

  buttons.suppress(function(value){
    if (value){
      buttons.suppress.output.set(stateLights.red)
      suppressor.start(selector.selection())
    } else {
      buttons.suppress.output.set(stateLights.off)
      suppressor.stop()
    }
  })

  function clearSelection(){
    mover.stop()
    selector.clear()
    selector.stop()
    buttons.select.output.set(stateLights.off)
  }

  buttons.select(function(value){
    if (value){
      mover.stop()
      selector.clear()
      buttons.select.output.set(stateLights.green)
      selector.start()
    } else {
      if (selector.selection.getLength()){
        mover.start(selector.selection())
      } else {
        selector.stop()
        buttons.select.output.set(stateLights.off)
      }
    }
  })

  self.repeatLength(function(value){

    if (value < 2){
      repeater.start()
    } else {
      repeater.stop()
    }

    repeater.setLength(value)
    holder.setLength(value)
  })

  return self
}

function updateArray(obs, value){
  obs.transaction(function(rawList){
    rawList.length = 0
    Array.prototype.push.apply(rawList, value)
  })
}