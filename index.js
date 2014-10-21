var LoopGrid = require('loop-grid')
var Observ = require('observ')
var ObservArray = require('observ-array')
var ArrayGrid = require('array-grid')

var Repeater = require('./lib/repeater')
var Holder = require('./lib/holder')
var Selector = require('loop-grid-selector')
var Mover = require('./lib/mover')
var Suppressor = require('./lib/suppressor')

var stateLights = require('./state-lights')
var ControllerGrid = require('./lib/controller-grid')
var RepeatButtons = require('./lib/repeat-buttons')
var ControlButtons = require('./lib/control-buttons')

var ObservStruct = require('observ-struct')
var computedPortNames = require('midi-port-holder/computed-port-names')

var computed = require('observ/computed')
var computeIndexesWhereGridContains = require('observ-grid/indexes-where-contains')

var PortHolder = require('midi-port-holder')

module.exports = function Launchpad(opts){

  var opts = Object.create(opts)
  opts.shape = [8, 8]

  var portHolder = PortHolder(opts)
  var duplexPort = portHolder.stream
  var triggerOutput = opts.triggerOutput

  duplexPort.on('switch', turnOffAllLights)

  function turnOffAllLights(){
    duplexPort.write([176, 0, 0])
  }


  var self = LoopGrid(opts, {
    port: portHolder
  })

  var selector = self.selected = Selector(opts.shape)
  var noRepeat = computeIndexesWhereGridContains(self.flags, 'noRepeat')

  self.repeatLength = Observ(2)
  
  self.portChoices = computedPortNames()

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
  var mover = Mover(self, inputGrabber)
  var suppressor = Suppressor(self, layers.suppressing, stateLights.red)

  var selectedIndexes = computed([selector], function(selectionGrid){
    return selectionGrid.data.reduce(function(result, value, i){
      if (value){
        result.push(i)
      }
      return result
    }, [])
  })

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
        self.store()
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
      holder.start(opts.scheduler.getCurrentPosition(), selectedIndexes())
    } else {
      buttons.hold.output.set(stateLights.off)
      holder.stop()
    }
  })

  buttons.suppress(function(value){
    if (value){
      buttons.suppress.output.set(stateLights.red)
      suppressor.start(selectedIndexes())
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
      selector.start(inputGrabber)
    } else {
      if (selectedIndexes().length){
        mover.start(selectedIndexes())
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

  self._releases.push(
    turnOffAllLights,
    portHolder.destroy,
    function(){ opts.scheduler.removeListener('data', onSchedule) }
  )

  return self
}

function updateArray(obs, value){
  obs.transaction(function(rawList){
    rawList.length = 0
    Array.prototype.push.apply(rawList, value)
  })
}


function inArray(array, value){
  return Array.isArray(array) && !!~array.indexOf(value)
}