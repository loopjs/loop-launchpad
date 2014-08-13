var ObservMidi = require('observ-midi')
var ObservArray = require('observ-array')
var Observ = require('observ')

module.exports = function(self, duplexPort){
  var buttons = ObservMidi(duplexPort, {
    loopRange: '176/104',
    suppress: '176/105',
    undo: '176/106',
    redo: '176/107',
    hold: '176/108',
    snap1: '176/109',
    snap2: '176/110',
    select: '176/111'
  })

  extendLightStack(buttons.loopRange, buttons.undo, buttons.redo)
  return buttons
}

function extendLightStack(args){
  for (var i=0;i<arguments.length;i++){
    var button = arguments[i]
    button.state = Observ()
    button.flash = flash
    button.light = light
    extendValueStack(button.output, [button.state])
  }
}

function extendValueStack(obs, stack){
  if (!obs.stack){
    obs.stack = ObservArray(stack || [Observ(obs())])
    return obs.stack(function(values){
      var topValue = null
      values.forEach(function(value){
        if (value){
          topValue = value
        }
      })
      obs.set(topValue)
    })
  }
}

function light(color){
  var output = this.output
  var obs = Observ(color)
  output.stack.push(obs)
  return function remove(){
    var index = output.stack.indexOf(obs)
    output.stack.splice(index, 1)
  }
}

function flash(color, duration){
  setTimeout(this.light(color), duration || 50)
}