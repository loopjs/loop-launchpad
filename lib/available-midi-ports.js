var Observ = require('observ')
var MidiStream = require('web-midi')

module.exports = ObservAvailableMidiPorts
function ObservAvailableMidiPorts(){
  var obs = Observ([])
  MidiStream.getPortNames(function(err, names){
    obs.set(names.sort())
  })
  return obs
}