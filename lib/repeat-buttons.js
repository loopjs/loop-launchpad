var stateLights = require('./state_lights.js')
var ObservStack = require('./observ-stack.js')
var ObservMidi = require('observ-midi')
var Observ = require('observ')

var repeatStates = [2, 1, 2/3, 1/2, 1/3, 1/4, 1/6, 1/8]

module.exports = function(self, duplexPort){

  var repeatButtons = ObservMidi(duplexPort, [
    '144/8','144/24','144/40','144/56','144/72','144/88','144/104','144/120'
  ])

  // handle input
  var repeatStack = ObservStack()
  var releases = [
    repeatButtons(function(values){
      // hold down multiple buttons and revert to previous when released
      var diff = values._diff
      if (diff){
        var value = repeatStates[diff[0]]
        if (diff[2]){
          repeatStack.stack.push(value)
        } else {
          remove(repeatStack.stack, value)
        }
      }
    }),
    repeatStack(function(value){
      if (value){
        self.repeatLength.set(value)
      }
    })
  ]

  var activeBeatLight = Observ(0)

  var repeatLights = repeatStates.map(function(val, i){

    var output = ObservStack()

    output.stack.push(
      output.beat = Observ(),
      output.state = Observ(),
      output.flash = Observ()
    )

    repeatButtons.output.put(i, output)

    function update(value){
      output.state.set(value === val ? stateLights.amberLow : null)
    }

    function updateBeat(value){
      if (value === i){
        output.beat.set(stateLights.greenLow)
        output.flash.set(stateLights.green)
        setTimeout(function(){
          output.flash.set(null)
        }, 50)
      } else {
        output.beat.set(null)
      }
    }

    releases.push(
      self.repeatLength(update),
      activeBeatLight(updateBeat)
    )

    update(self.repeatLength())

    return output
  })

  self.loopPosition(function(value){
    var index = Math.floor(value / self.loopLength() * 8)
    if (index != activeBeatLight()){
      activeBeatLight.set(index)
    }
  })

  return repeatButtons
}

function remove(array, item){
  var index = array.indexOf(item)
  if (~index){
    array.splice(index, 1)
  }
}