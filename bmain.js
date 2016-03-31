var net = require('net')
var fs = require('fs')
var gls = fs.readFileSync('./shader.glsl', 'utf8')

var regl = require('./regl')()
const draw = regl({
  frag: gls,
  vert: `
    precision mediump float;
    attribute vec2 position;
    attribute vec2 resolution;
    varying vec2 iResolution;
    attribute float globalTime;
    varying float iGlobalTime;

    void main () {
      gl_Position = vec4(position, 0, 1);
      iResolution = resolution;
      iGlobalTime = globalTime;
    }
  `,
  attributes: {
    position: regl.buffer([
      [-1,-1],[1,-1],[-1,1],
      [-1,1],[1,1],[1,-1]
    ]),
    globalTime: regl.prop('globalTime'),
    resolution: regl.buffer([[1280, 720]])
  },

  count: 6
})

//document.body.querySelector('canvas').style.display = 'none'
  var start = Date.now()
  regl.frame(function (count) {
    //regl.clear({color: [Math.abs(Math.sin(t * Math.PI * 2 / 4)) ,0,1,0]})
    regl.clear({color: [0,0,0,1]})
    draw({
      globalTime: ((Date.now() - start) / 1000) * 12
    })
    //var pixels = regl.read()//canvas.getImageData(0,0, 1280, 720).data

    //stream.write(new Buffer(pixels))
  })

var streamo = net.createServer(function(stream){

  var start = Date.now()
  regl.frame(function (count) {
    //regl.clear({color: [Math.abs(Math.sin(t * Math.PI * 2 / 4)) ,0,1,0]})
    regl.clear({color: [0,0,0,1]})
    draw({
      globalTime: ((Date.now() - start) / 1000) * 12
    })
    var pixels = regl.read()//canvas.getImageData(0,0, 1280, 720).data
    stream.write(new Buffer(pixels))
  })

  setTimeout(function(){
    stream.end()
//    process.exit()
  }, 10000 / 3)

})

streamo.listen(2233)




