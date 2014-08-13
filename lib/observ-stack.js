var Observ = require('observ')
var ObservArray = require('observ-array')

module.exports = ObservStack

function ObservStack(stack){
  var obs = Observ()
  obs.stack = ObservArray(stack || [])
  obs._removeListeners = [
    obs.stack(function(values){
      var topValue = null
      values.forEach(function(value){
        if (value){
          topValue = value
        }
      })
      if (topValue !== obs()){
        obs.set(topValue)
      }
    })
  ]

  obs.push = function(value){
    if (!(value instanceof Object)){
      value = Observ(value)
    }
    obs.stack.push(value)
    return function remove(){
      obs.stack.splice(obs.stack.indexOf(value), 1)
    }
  }

  obs.pop = function(){
    return obs.stack.pop(value)
  }

  return obs
}