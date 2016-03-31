var w = 640
var h = 480
var fs = require('fs')
var net = require('net')
var gl = require('gl')(w, h, {preserveDrawingBuffer: true})
var regl = require('./regl')(gl)

var draw = regl({
  frag: `
    precision mediump float;
    float diric (float n, float x);
    vec3 hsl2rgb (float h, float s, float l);
    varying float iGlobalTime;

    void main () {
      float x = gl_FragCoord.x - 400.0;
      float y = gl_FragCoord.y - 800.0;
      float t = iGlobalTime*2.0;
      float z = 200.0 - (1.0 + sin(t/20.0)) / 20.0 * 40.0;
      float z0 = 350.0 - (1.0 + sin(t/20.0)) / 2.0 * 40.0;
      
      float h = diric(10.0, 10.0*(y/10.0/z*t/20.0-40.0 + x/10.0/z*t/120.0)/80.0)
        + diric(10.0, 2.0 * sin(x/z * y/z + t/40.0) + sin(t/2.0 + y/4.0/z)*2.0)
      ;
      float s = 1.0;
      float l = diric(10.0, 100.0*(y/z0*t/20.0-40.0 + x/z0*t/120.0)/20.0)
        + diric(10.0, 4.0 * sin(x/z0 * y/z0 + t/4.0)
          + sin(t/2.0 + y/z0 + x/z0*3.0) * 2.0)
        + diric(10.0, 1.0 * sin((x*2.0) * (y*2.2)
          / (800.0 + sin((x/2.0+sin(t))/(y/3.0+cos(t))*200.0+t) + t/40.0)))
      ;
      gl_FragColor = vec4(hsl2rgb(h,s,l),1.0);
    }

    float EPSILON = 0.00001;
    float PI = 3.141592654;

    float diric(float n, float x) {
      float denom = sin(PI * x / n);
      if(-EPSILON <= denom && denom <= EPSILON) {
        return 1.0;
      }
      return sin(PI * x) / (n * denom);
    }

    vec3 hsl2rgb(in float h, float s, float l) {
      vec3 rgb = clamp( abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0,1.0);
      return l + s * (rgb-0.5)*(1.0-abs(2.0*l-1.0));
    }
  `,
  vert: `
    precision mediump float;
    attribute vec2 position;
    attribute float globalTime;
    varying float iGlobalTime;

    void main () {
      gl_Position = vec4(position, 0, 1);
      iGlobalTime = globalTime;
    }
  `,
  attributes: {
    position: regl.buffer([
      [-1,-1],[1,-1],[-1,1],
      [-1,1],[1,1],[1,-1]
    ]),
    globalTime: regl.prop('globalTime')
  },
  count: 6
})


var streamo = net.createServer(function(stream){
  var start = Date.now()

  var pixels = new Uint8Array(w * h * 4)

  regl.frame(function(count){
    var t = (Date.now() - start) / 1000
    regl.clear({color: [Math.abs(Math.sin(t * Math.PI * 2 / 4)) ,0,1,0]})
    //regl.clear({color: [0,0,0,1]})

    draw({
      globalTime: (Date.now() - start) / 1000
    })
    gl.readPixels(0,0,w,h,gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    stream.write(new Buffer(pixels))
  })

  setTimeout(function(){
    stream.end()
    process.exit()
  }, 10000 / 3)

})

streamo.listen(2233)



