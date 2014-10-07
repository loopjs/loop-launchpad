var MidiStream = require('web-midi')
var nextTick = require('next-tick')
var Observ = require('observ')
var watch = require('observ/watch')
var Switcher = require('switch-stream')
var Stream = require('stream')
var deepEqual = require('deep-equal')

module.exports = PortHolder

function PortHolder(context){
  var empty = new Stream()
  empty.write = function(){
    // evaporate!
  }

  function handleError(err){
    obs.stream.set(empty)
  }

  var obs = Observ()
  obs.stream = Switcher(empty)

  var lastValue = null
  var port = null

  watch(obs, function(descriptor){
    if (!deepEqual(descriptor,lastValue)){

      if (typeof descriptor === 'string'){
        descriptor = [descriptor]
      }

      if (Array.isArray(descriptor) && descriptor[0]){
        var port = MidiStream(descriptor[0], descriptor[1] || 0)
        port.on('connect', function(){
          obs.stream.set(port)
          console.log('connect', descriptor, port)
        })
        port.on('error', function(){
          obs.stream.set(empty)
        })
      } else {
        obs.stream.set(empty)
        console.log('disconnect', port)
      }
      lastValue = descriptor
    }
  })

  return obs
}