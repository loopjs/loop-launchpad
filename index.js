var LoopGrid = require('loop-grid')
var MidiGrid = require('midi-grid')
var Switcher = require('switch-stream')
var Controller = require('midi-controller')
var ObserverStack = require('observer-stack')
var ArrayGrid = require('array-grid')
var ObservGrid = require('observ-grid')
var ObservGridStack = require('observ-grid-stack')
var DittyGridStream = require('./lib/ditty-grid-stream')

var stateLights = require('./lib/state_lights')
var repeatStates = [1, 2/3, 1/2, 1/3, 1/4, 1/6, 1/8]
var Repeater = require('./lib/repeater')
var Holder = require('./lib/holder')


module.exports = function Launchpad(opts){

  opts = opts || {}
  opts.shape = [8, 8]

  var duplexPort = Switcher()
  var triggerOutput = opts.triggerOutput

  var self = LoopGrid(opts)

  var controller = Controller(duplexPort)

  // layers
  var layers = {
    recording: ObservGrid([], opts.shape),
    active: ObservGrid([], opts.shape),
    playing: ObservGrid([], opts.shape)
  }

  var outputStack = ObservGridStack([
    layers.recording, layers.active, layers.playing
  ])

  var controllerGrid = MidiGrid(duplexPort, generateNoteGrid(), outputStack)
  var inputStack = ObserverStack(controllerGrid)

  var repeater = Repeater(inputStack, self)
  var holder = Holder(self)

  self.setMidi = function(port){
    if (port){
      duplexPort.set(port)
      // clear lights
      duplexPort.write([176, 0, 0])
      controllerGrid.resend()
    }
  }

  var lastTriggeredAt = {}
  triggerOutput.on('data', function(data){
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
  DittyGridStream(inputStack, self.grid, opts.scheduler).pipe(triggerOutput)

  var playing = {}
  opts.player.on('change', function(descriptor){
    var value = descriptor.events && descriptor.events.length && true || null
    if (value != descriptor.id){
      playing[descriptor.id] = value
      refreshPlaying()
    }
  })

  self.grid(refreshPlaying)
  self.grid(refreshRecording)
  opts.scheduler.on('data', checkRecording)

  var recording = {}
  function checkRecording(schedule){
    var changed = false
    Object.keys(lastTriggeredAt).forEach(function(key){
      var value = (lastTriggeredAt[key] > schedule.to - 8)
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
    console.log('refreshing recording', recording)
    gridForEach(self.grid(), function(val, row, col){
      var currentState = layers.recording.get(row, col)
      var value = recording[val]
      if (value && currentState != stateLights.redLow){
        layers.recording.set(row, col, stateLights.redLow)
      } else if (!value && currentState != null){
        layers.recording.set(row, col, null)
      }
    })
  }

  function refreshPlaying(){
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

  self.setMidi(opts.midi)

  var learnMode = 'store'
  var recordingNotes = []
  function refreshLearnButton(){
    if (self.transforms.getLength()){
      learnButton.setOff(stateLights.greenLow)
      learnMode = 'flatten'
    } else {
      if (recordingNotes.length > 0){
        learnButton.setOff(stateLights.redLow)
      } else {
        learnButton.setOff(stateLights.off)
      }
      learnMode = 'store'
    }
  }

  var learnButton = controller.createButton([176, 104], function(){
    this.flash(stateLights.green)
    if (learnMode === 'store'){
      self.loopRange(opts.scheduler.getCurrentPosition()-8, 8)
    } else if (learnMode === 'flatten'){
      self.flatten()
    }
  })

  self.transforms(function(transforms){
    refreshLearnButton()
  })

  var undoButton = controller.createButton([176, 106], function(){
    this.flash(stateLights.red, 100)
    self.undo()
  })
  undoButton.setOff(stateLights.redLow)

  var redoButton = controller.createButton([176, 107], function(){
    this.flash(stateLights.red, 100)
    self.redo()
  })
  redoButton.setOff(stateLights.redLow)

  var holdButton = controller.createButton([176, 108], function(){
    this.turnOn(stateLights.yellow)
    holder.start(opts.scheduler.getCurrentPosition())
  }, function(){
    this.turnOff()
    holder.stop()
  })

  var releaseSuppress = null
  var suppressButton = controller.createButton([176, 105], function(){
    this.turnOn(stateLights.red)
    releaseSuppress = self.transform(function(input){
      input.data.forEach(function(loop){
        if (loop){
          loop.events = []
        }
      })
      return input
    })
  }, function(){
    this.turnOff()
    releaseSuppress()
  })

  var clearRepeatButton = controller.createButton([144, 8], function(){
    clearRepeat()
    this.turnOn(stateLights.amberLow)
    repeater.stop()
  })

  function clearRepeat(){
    holder.setLength(2/1)
    clearRepeatButton.turnOff()
    repeatButtons.forEach(function(button){
      button.turnOff()
    })
  }

  clearRepeatButton.turnOn(stateLights.amberLow)

  var repeatButtons = repeatStates.map(function(length, i){
    var id = 8 + (i*16)
    return controller.createButton([144, id+16], function(){
      clearRepeat()
      this.turnOn(stateLights.amberLow)
      repeater.start(length)
      holder.setLength(length)
    })
  })

  var sideButtons = [clearRepeatButton].concat(repeatButtons)

  // handle lighting up notes

  // play notes

  // repeat modes

  // learn, suppress, undo, redo, hold

  // move

  return self

  ///


  function getGlobalIdFromMidi(noteId){
    var row = Math.floor(noteId / 8)
    var col = noteId % 8
    return self.grid().get(row, col)
  }

  function getMidiFromGlobalId(globalId){
    var coords = self.grid().lookup(globalId)
    if (coords){
      return (coords[0] * 8) + (coords[1] % 8)
    }
  }

}



function generateNoteGrid(message){
  var result = []
  var message = message || 144

  for (var r=0;r<8;r++){
    for (var c=0;c<8;c++){
      var noteId = (r*16) + (c % 8)
      result.push(message + '/' + noteId)
    }
  }

  return ArrayGrid(result, [8,8]) 
}

function gridForEach(grid, iterator){
  for (var r=0;r<grid.shape[0];r++){
    for (var c=0;c<grid.shape[1];c++){
      iterator(grid.get(r,c), r, c)
    }
  }
}