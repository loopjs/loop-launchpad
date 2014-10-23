var LoopGrid = require('loop-grid')
var Selector = require('loop-grid-selector')
var Holder = require('loop-grid-holder')
var Mover = require('loop-grid-mover')
var Repeater = require('loop-grid-repeater')
var Suppressor = require('loop-grid-suppressor')

var ObservMidi = require('observ-midi')
var ObservGridStack = require('observ-grid-stack')
var ObservGridGrabber = require('observ-grid/grabber')
var ObservMidiPort = require('midi-port-holder')
var MidiButtons = require('observ-midi/light-stack')
var watchButtons = require('./lib/watch-buttons.js')

var Observ = require('observ')
var ArrayGrid = require('array-grid')

var DittyGridStream = require('ditty-grid-stream')

var computedPortNames = require('midi-port-holder/computed-port-names')

var watch = require('observ/watch')
var mapWatchDiff = require('./lib/map-watch-diff-stack.js')
var mapGridValue = require('observ-grid/map-values')
var computeIndexesWhereContains = require('observ-grid/indexes-where-contains')

var stateLights = require('./state-lights.js')
var repeatStates = [2, 1, 2/3, 1/2, 1/3, 1/4, 1/6, 1/8]


module.exports = function(opts){

  // resolve options
  var opts = Object.create(opts)
  var triggerOutput = opts.triggerOutput
  var scheduler = opts.scheduler
  var gridMapping = getLaunchpadGridMapping()
  opts.shape = gridMapping.shape

  // controller midi port
  var portHolder = ObservMidiPort()
  var duplexPort = portHolder.stream
  duplexPort.on('switch', turnOffAllLights)

  // extend loop-grid instance
  var self = LoopGrid(opts, {
    port: portHolder
  })

  self.portChoices = computedPortNames()
  self.repeatLength = Observ(2)

  // loop transforms
  var transforms = {
    selector: Selector(gridMapping.shape, gridMapping.stride),
    holder: Holder(self.transform),
    mover: Mover(self.transform),
    repeater: Repeater(self.transform),
    suppressor: Suppressor(self.transform, gridMapping.shape, gridMapping.stride)
  }

  var outputLayers = ObservGridStack([

    // recording
    mapGridValue(self.recording, stateLights.redLow),

    // active
    mapGridValue(self.active, stateLights.greenLow),

    // selected
    mapGridValue(transforms.selector, stateLights.green),

    // suppressing
    mapGridValue(transforms.suppressor, stateLights.red),

    // playing
    mapGridValue(self.playing, stateLights.amber)

  ])

  var controllerGrid = ObservMidi(duplexPort, gridMapping, outputLayers)
  var inputGrabber = ObservGridGrabber(controllerGrid)

  var noRepeat = computeIndexesWhereContains(self.flags, 'noRepeat')
  var grabInputExcludeNoRepeat = inputGrabber.bind(this, {exclude: noRepeat})

  // trigger notes at bottom of input stack
  var output = DittyGridStream(inputGrabber, self.grid, scheduler)
  output.pipe(triggerOutput)

  // midi button mapping
  var buttons = MidiButtons(duplexPort, {
    store: '176/104',
    suppress: '176/105',
    undo: '176/106',
    redo: '176/107',
    hold: '176/108',
    snap1: '176/109',
    snap2: '176/110',
    select: '176/111'
  })

  watchButtons(buttons, {

    store: function(value){
      if (value){
        this.flash(stateLights.green)
        if (!self.transforms.getLength()){
          self.store()
        } else {
          self.flatten()
          transforms.selector.stop()
        }
      }
    },
 
    suppress: function(value){
      if (value){
        var turnOffLight = this.light(stateLights.red)
        transforms.suppressor.start(transforms.selector.selectedIndexes(), turnOffLight)
      } else {
        transforms.suppressor.stop()
      }
    },
 
    undo: function(value){
      if (value){
        self.undo()
        this.flash(stateLights.red, 100)
        buttons.store.flash(stateLights.red)
      }
    },
 
    redo: function(value){
      if (value){
        self.redo()
        this.flash(stateLights.red, 100)
        buttons.store.flash(stateLights.red)
      }
    },
 
    hold: function(value){
      if (value){
        var turnOffLight = this.light(stateLights.yellow)
        transforms.holder.start(
          scheduler.getCurrentPosition(), 
          transforms.selector.selectedIndexes(), 
          turnOffLight
        )
      } else {
        transforms.holder.stop()
      }
    },
 
    select: function(value){
      if (value){
        var turnOffLight = this.light(stateLights.green)
        transforms.selector.start(inputGrabber, function done(){
          transforms.mover.stop()
          transforms.selector.clear()
          turnOffLight()
        })
      } else {
        if (transforms.selector.selectedIndexes().length){
          transforms.mover.start(inputGrabber, transforms.selector.selectedIndexes())
        } else {
          transforms.selector.stop()
        }
      }
    }
  })

  // light up undo buttons by default
  buttons.undo.light(stateLights.redLow)
  buttons.redo.light(stateLights.redLow)

  // light up store button when transforming (flatten mode)
  var releaseFlattenLight = null
  watch(self.transforms, function(values){
    if (values.length && !releaseFlattenLight){
      releaseFlattenLight = buttons.store.light(stateLights.greenLow)
    } else if (releaseFlattenLight){
      releaseFlattenLight()
      releaseFlattenLight = null
    }
  })


  var repeatButtons = MidiButtons(duplexPort, {
    0: '144/8',
    1: '144/24',
    2: '144/40',
    3: '144/56',
    4: '144/72',
    5: '144/88',
    6: '144/104',
    7: '144/120'
  })

  // repeater
  var releaseRepeatLight = null
  mapWatchDiff(repeatStates, repeatButtons, self.repeatLength.set)
  watch(self.repeatLength, function(value){
    var button = repeatButtons[repeatStates.indexOf(value)]
    if (button){
      if (releaseRepeatLight) releaseRepeatLight()
      releaseRepeatLight = button.light(stateLights.amberLow)
    }
    transforms.holder.setLength(value)
    if (value < 2){
      transforms.repeater.start(grabInputExcludeNoRepeat, value)
    } else {
      transforms.repeater.stop()
    }
  })


  // visual metronome / loop position
  var releaseBeatLight = null
  var currentBeat = null
  watch(self.loopPosition, function(value){
    var index = Math.floor(value / self.loopLength() * 8)
    if (index != currentBeat){
      var button = repeatButtons[index]
      if (button){
        releaseBeatLight&&releaseBeatLight()
        releaseBeatLight = button.light(stateLights.greenLow, 0)
        button.flash(stateLights.green)
      }
      currentBeat = index
    }
  })

  // cleanup / disconnect from midi on destroy
  self._releases.push(
    turnOffAllLights,
    portHolder.destroy,
    output.destroy
  )

  return self




  // scoped

  function turnOffAllLights(){
    duplexPort.write([176, 0, 0])
  }

}



function getLaunchpadGridMapping(){
  var result = []
  for (var r=0;r<8;r++){
    for (var c=0;c<8;c++){
      var noteId = (r*16) + (c % 8)
      result.push('144/' + noteId)
    }
  }
  return ArrayGrid(result, [8, 8])
}