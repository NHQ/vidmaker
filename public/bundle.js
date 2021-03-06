(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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





},{"./regl":26,"fs":undefined,"net":undefined}],2:[function(require,module,exports){
var glTypes = require('./constants/dtypes.json')

var GL_FLOAT = 5126

function AttributeRecord () {
  this.pointer = false

  this.x = 0.0
  this.y = 0.0
  this.z = 0.0
  this.w = 0.0

  this.buffer = null
  this.size = 0
  this.normalized = false
  this.type = GL_FLOAT
  this.offset = 0
  this.stride = 0
  this.divisor = 0
}

Object.assign(AttributeRecord.prototype, {
  equals: function (other, size) {
    if (this.pointer) {
      return other.pointer &&
        this.x === other.x &&
        this.y === other.y &&
        this.z === other.z &&
        this.w === other.w
    } else {
      return !other.pointer &&
        this.buffer === other.buffer &&
        this.size === size &&
        this.normalized === other.normalized &&
        this.type === other.type &&
        this.offset === other.offset &&
        this.stride === other.stride &&
        this.divisor === other.divisor
    }
  },

  set: function (other, size) {
    var pointer = this.pointer = other.pointer
    if (pointer) {
      this.buffer = other.buffer
      this.size = size
      this.normalized = other.normalized
      this.type = other.type
      this.offset = other.offset
      this.stride = other.stride
      this.divisor = other.divisor
    } else {
      this.x = other.x
      this.y = other.y
      this.z = other.z
      this.w = other.w
    }
  }
})

module.exports = function wrapAttributeState (gl, extensionState, bufferState) {
  var extensions = extensionState.extensions

  var attributeState = {}

  var NUM_ATTRIBUTES = gl.getParameter(gl.MAX_VERTEX_ATTRIBS)
  var attributeBindings = new Array(NUM_ATTRIBUTES)
  for (var i = 0; i < NUM_ATTRIBUTES; ++i) {
    attributeBindings[i] = new AttributeRecord()
  }

  function AttributeStack () {
    var records = new Array(16)
    for (var i = 0; i < 16; ++i) {
      records[i] = new AttributeRecord()
    }
    this.records = records
    this.top = 0
  }

  function pushAttributeStack (stack) {
    var records = stack.records
    var top = stack.top

    while (records.length - 1 <= top) {
      records.push(new AttributeRecord())
    }

    return records[++stack.top]
  }

  Object.assign(AttributeStack.prototype, {
    pushVec: function (x, y, z, w) {
      var head = pushAttributeStack(this)
      head.pointer = false
      head.x = x
      head.y = y
      head.z = z
      head.w = w
    },

    pushPtr: function (
      buffer,
      size,
      offset,
      stride,
      divisor,
      normalized,
      type) {
      var head = pushAttributeStack(this)
      head.pointer = true
      head.buffer = buffer
      head.size = size
      head.offset = offset
      head.stride = stride
      head.divisor = divisor
      head.normalized = normalized
      head.type = type
    },

    pushDyn: function (data) {
      if (typeof data === 'number') {
        this.pushVec(data, 0, 0, 0)
      } else if (Array.isArray(data)) {
        this.pushVec(data[0], data[1], data[2], data[3])
      } else {
        var buffer = bufferState.getBuffer(data)
        var size = 0
        var stride = 0
        var offset = 0
        var divisor = 0
        var normalized = false
        var type = GL_FLOAT
        if (!buffer) {
          buffer = bufferState.getBuffer(data.buffer)
          size = data.size || 0
          stride = data.stride || 0
          offset = data.offset || 0
          divisor = data.divisor || 0
          normalized = data.normalized || false
          type = buffer.dtype
          if ('type' in data) {
            type = glTypes[data.type]
          }
        } else {
          type = buffer.dtype
        }
        this.pushPtr(buffer, size, offset, stride, divisor, normalized, type)
      }
    },

    pop: function () {
      this.top -= 1
    }
  })

  // ===================================================
  // BIND AN ATTRIBUTE
  // ===================================================
  function bindAttribute (index, current, next, size) {
    size = next.size || size
    if (current.equals(next, size)) {
      return
    }
    if (!next.pointer) {
      if (current.pointer) {
        gl.disableVertexAttribArray(index)
      }
      gl.vertexAttrib4f(index, next.x, next.y, next.z, next.w)
    } else {
      if (!current.pointer) {
        gl.enableVertexAttribArray(index)
      }
      if (current.buffer !== next.buffer) {
        next.buffer.bind()
      }
      gl.vertexAttribPointer(
        index,
        size,
        next.type,
        next.normalized,
        next.stride,
        next.offset)
      var extInstancing = extensions.angle_instanced_arrays
      if (extInstancing) {
        extInstancing.vertexAttribDivisorANGLE(index, next.divisor)
      }
    }
    current.set(next, size)
  }

  // ===================================================
  // DEFINE A NEW ATTRIBUTE
  // ===================================================
  function defAttribute (name) {
    if (name in attributeState) {
      return
    }
    attributeState[name] = new AttributeStack()
  }

  return {
    bindings: attributeBindings,
    attributes: attributeState,
    bind: bindAttribute,
    def: defAttribute
  }
}

},{"./constants/dtypes.json":9}],3:[function(require,module,exports){
// Array and element buffer creation
var check = require('./check')
var isTypedArray = require('./is-typed-array')
var usageTypes = require('./constants/usage.json')
var arrayTypes = require('./constants/arraytypes.json')

var GL_UNSIGNED_BYTE = 5121
var GL_STATIC_DRAW = 35044
var GL_FLOAT = 5126

function flatten (data, dimension) {
  var result = new Float32Array(data.length * dimension)
  var ptr = 0
  for (var i = 0; i < data.length; ++i) {
    var v = data[i]
    for (var j = 0; j < dimension; ++j) {
      result[ptr++] = v[j]
    }
  }
  return result
}

module.exports = function wrapBufferState (gl) {
  var bufferCount = 0
  var bufferSet = {}

  function REGLBuffer (buffer, type) {
    this.id = bufferCount++
    this.buffer = buffer
    this.type = type
    this.usage = GL_STATIC_DRAW
    this.byteLength = 0
    this.dimension = 1
    this.data = null
    this.dtype = GL_UNSIGNED_BYTE
  }

  Object.assign(REGLBuffer.prototype, {
    bind: function () {
      gl.bindBuffer(this.type, this.buffer)
    },

    update: function (options) {
      if (Array.isArray(options) || isTypedArray(options)) {
        options = {
          data: options
        }
      } else if (typeof options === 'number') {
        options = {
          length: options | 0
        }
      } else if (options === null || options === void 0) {
        options = {}
      }

      check.type(
        options, 'object',
        'buffer arguments must be an object, a number or an array')

      if ('usage' in options) {
        var usage = options.usage
        check.parameter(usage, usageTypes, 'buffer usage')
        this.usage = usageTypes[options.usage]
      }

      var dimension = (options.dimension | 0) || 1
      if ('data' in options) {
        var data = options.data
        if (data === null) {
          this.byteLength = options.length | 0
          this.dtype = GL_UNSIGNED_BYTE
        } else {
          if (Array.isArray(data)) {
            if (data.length > 0 && Array.isArray(data[0])) {
              dimension = data[0].length
              data = flatten(data, dimension)
              this.dtype = GL_FLOAT
            } else {
              data = new Float32Array(data)
              this.dtype = GL_FLOAT
            }
          } else {
            check.isTypedArray(data, 'invalid data type buffer data')
            this.dtype = arrayTypes[Object.prototype.toString.call(data)]
          }
          this.dimension = dimension
          this.byteLength = data.byteLength
        }
        this.data = data
      } else if ('length' in options) {
        var byteLength = options.length
        check.nni(byteLength, 'buffer length must be a nonnegative integer')
        this.data = null
        this.byteLength = options.length | 0
        this.dtype = GL_UNSIGNED_BYTE
      }

      this.bind()
      gl.bufferData(this.type, this.data || this.byteLength, this.usage)
    },

    refresh: function () {
      if (!gl.isBuffer(this.buffer)) {
        this.buffer = gl.createBuffer()
      }
      this.update({})
    },

    destroy: function () {
      check(this.buffer, 'buffer must not be deleted already')
      gl.destroyBuffer(this.buffer)
      this.buffer = null
      delete bufferSet[this.id]
    }
  })

  function createBuffer (options, type) {
    options = options || {}
    var handle = gl.createBuffer()

    var buffer = new REGLBuffer(handle, type)
    buffer.update(options)
    bufferSet[buffer.id] = buffer

    function updateBuffer (options) {
      buffer.update(options || {})
      return updateBuffer
    }

    updateBuffer._reglType = 'buffer'
    updateBuffer._buffer = buffer
    updateBuffer.destroy = function () { buffer.destroy() }

    return updateBuffer
  }

  return {
    create: createBuffer,

    clear: function () {
      Object.keys(bufferSet).forEach(function (bufferId) {
        bufferSet[bufferId].destroy()
      })
    },

    refresh: function () {
      Object.keys(bufferSet).forEach(function (bufferId) {
        bufferSet[bufferId].refresh()
      })
    },

    getBuffer: function (wrapper) {
      if (wrapper && wrapper._buffer instanceof REGLBuffer) {
        return wrapper._buffer
      }
      return null
    }
  }
}

},{"./check":4,"./constants/arraytypes.json":8,"./constants/usage.json":11,"./is-typed-array":18}],4:[function(require,module,exports){
// Error checking and parameter validation
var isTypedArray = require('./is-typed-array')

function raise (message) {
  console.error(message)
  throw new Error(message)
}

function check (pred, message) {
  if (!pred) {
    raise(message)
  }
}

function encolon (message) {
  if (message) {
    return ': ' + message
  }
  return ''
}

function checkParameter (param, possibilities, message) {
  check(param in possibilities,
    'unknown parameter (' + param + ')' + encolon(message) +
    '. possible values: ' + Object.keys(possibilities).join())
}

function checkIsTypedArray (data, message) {
  check(
    isTypedArray(data),
    'invalid parameter type' + encolon(message) +
    '. must be a typed array')
}

function checkTypeOf (value, type, message) {
  check(typeof value === type,
    'invalid parameter type' + encolon(message) +
    '. expected ' + type + ', got ' + (typeof value))
}

function checkNonNegativeInt (value, message) {
  check(
    (value >= 0) &&
    ((value | 0) === value),
    'invalid parameter type, (' + value + ')' + encolon(message) +
    '. must be a nonnegative integer')
}

function checkOneOf (value, list, message) {
  check(
    list.indexOf(value) >= 0,
    'invalid value' + encolon(message) + '. must be one of: ' + list)
}

module.exports = Object.assign(check, {
  raise: raise,
  parameter: checkParameter,
  type: checkTypeOf,
  isTypedArray: checkIsTypedArray,
  nni: checkNonNegativeInt,
  oneOf: checkOneOf
})

},{"./is-typed-array":18}],5:[function(require,module,exports){
/* globals performance */
module.exports =
  (typeof performance !== 'undefined' && performance.now)
  ? function () { return performance.now() }
  : function () { return +(new Date()) }

},{}],6:[function(require,module,exports){
function slice (x) {
  return Array.prototype.slice.call(x)
}

module.exports = function createEnvironment () {
  // Unique variable id counter
  var varCounter = 0

  // Linked values are passed from this scope into the generated code block
  // Calling link() passes a value into the generated scope and returns
  // the variable name which it is bound to
  var linkedNames = []
  var linkedValues = []
  function link (value) {
    var name = '_g' + (varCounter++)
    linkedNames.push(name)
    linkedValues.push(value)
    return name
  }

  // create a code block
  function block () {
    var code = []
    function push () {
      code.push.apply(code, slice(arguments))
    }

    var vars = []
    function def () {
      var name = '_v' + (varCounter++)
      vars.push(name)

      if (arguments.length > 0) {
        code.push(name, '=')
        code.push.apply(code, slice(arguments))
        code.push(';')
      }

      return name
    }

    return Object.assign(push, {
      def: def,
      toString: function () {
        return [
          (vars.length > 0 ? 'var ' + vars + ';' : ''),
          code.join('')
        ].join('')
      }
    })
  }

  // procedure list
  var procedures = {}
  function proc (name) {
    var args = []
    function arg () {
      var name = '_a' + (varCounter++)
      args.push(name)
      return name
    }

    var body = block()
    var bodyToString = body.toString

    var result = procedures[name] = Object.assign(body, {
      arg: arg,
      toString: function () {
        return [
          'function(', args.join(), '){',
          bodyToString(),
          '}'
        ].join('')
      }
    })

    return result
  }

  // compiles and returns all blocks
  function compile () {
    var code = ['"use strict";return {']
    Object.keys(procedures).forEach(function (name) {
      code.push('"', name, '":', procedures[name].toString(), ',')
    })
    code.push('}')
    var proc = Function.apply(null, linkedNames.concat([code.join('')]))
    return proc.apply(null, linkedValues)
  }

  return {
    link: link,
    block: block,
    proc: proc,
    compile: compile
  }
}

},{}],7:[function(require,module,exports){
var check = require('./check')
var createEnvironment = require('./codegen')
var primTypes = require('./constants/primitives.json')
var glTypes = require('./constants/dtypes.json')

var DEFAULT_FRAG_SHADER = 'void main(){gl_FragColor=vec4(0,0,0,0);}'
var DEFAULT_VERT_SHADER = 'void main(){gl_Position=vec4(0,0,0,0);}'

var GL_FLOAT = 5126
var GL_FLOAT_VEC2 = 35664
var GL_FLOAT_VEC3 = 35665
var GL_FLOAT_VEC4 = 35666
var GL_INT = 5124
var GL_INT_VEC2 = 35667
var GL_INT_VEC3 = 35668
var GL_INT_VEC4 = 35669
var GL_BOOL = 35670
var GL_BOOL_VEC2 = 35671
var GL_BOOL_VEC3 = 35672
var GL_BOOL_VEC4 = 35673
var GL_FLOAT_MAT2 = 35674
var GL_FLOAT_MAT3 = 35675
var GL_FLOAT_MAT4 = 35676

var GL_TRIANGLES = 4

function typeLength (x) {
  switch (x) {
    case GL_FLOAT_VEC2:
    case GL_INT_VEC2:
    case GL_BOOL_VEC2:
      return 2
    case GL_FLOAT_VEC3:
    case GL_INT_VEC3:
    case GL_BOOL_VEC3:
      return 3
    case GL_FLOAT_VEC4:
    case GL_INT_VEC4:
    case GL_BOOL_VEC4:
      return 4
    default:
      return 1
  }
}

function setUniformString (gl, type, location, value) {
  var infix
  var separator = ','
  switch (type) {
    case GL_FLOAT:
      infix = '1f'
      break
    case GL_FLOAT_VEC2:
      infix = '2fv'
      break
    case GL_FLOAT_VEC3:
      infix = '3fv'
      break
    case GL_FLOAT_VEC4:
      infix = '4fv'
      break
    case GL_BOOL:
    case GL_INT:
      infix = '1i'
      break
    case GL_BOOL_VEC2:
    case GL_INT_VEC2:
      infix = '2iv'
      break
    case GL_BOOL_VEC3:
    case GL_INT_VEC3:
      infix = '3iv'
      break
    case GL_BOOL_VEC4:
    case GL_INT_VEC4:
      infix = '4iv'
      break
    case GL_FLOAT_MAT2:
      infix = 'Matrix2fv'
      separator = ',true,'
      break
    case GL_FLOAT_MAT3:
      infix = 'Matrix3fv'
      separator = ',true,'
      break
    case GL_FLOAT_MAT4:
      infix = 'Matrix4fv'
      separator = ',true,'
      break
    default:
      check.raise('unsupported uniform type')
  }
  return gl + '.uniform' + infix + '(' + location + separator + value + ');'
}

function stackTop (x) {
  return x + '[' + x + '.length-1]'
}

module.exports = function reglCompiler (
  gl,
  extensionState,
  bufferState,
  elementState,
  textureState,
  fboState,
  glState,
  uniformState,
  attributeState,
  shaderState,
  drawState,
  frameState) {
  var extensions = extensionState.extensions
  var contextState = glState.contextState

  var drawCallCounter = 0

  // ===================================================
  // ===================================================
  // SHADER SINGLE DRAW OPERATION
  // ===================================================
  // ===================================================
  function compileShaderDraw (program) {
    var env = createEnvironment()
    var link = env.link
    var draw = env.proc('draw')
    var def = draw.def

    var GL = link(gl)
    var PROGRAM = link(program.program)
    var BIND_ATTRIBUTE = link(attributeState.bind)
    var DRAW_STATE = {
      count: link(drawState.count),
      offset: link(drawState.offset),
      instances: link(drawState.instances),
      primitive: link(drawState.primitive)
    }
    var ELEMENT_STATE = link(elementState.elements)

    // bind the program
    draw(GL, '.useProgram(', PROGRAM, ');')

    // set up attribute state
    program.attributes.forEach(function (attribute) {
      var STACK = link(attributeState.attributes[attribute.name])
      draw(BIND_ATTRIBUTE, '(',
        attribute.location, ',',
        link(attributeState.bindings[attribute.location]), ',',
        STACK, '.records[', STACK, '.top]', ',',
        typeLength(attribute.info.type), ');')
    })

    // set up uniforms
    program.uniforms.forEach(function (uniform) {
      var LOCATION = link(uniform.location)
      var STACK = link(uniformState.uniforms[uniform.name])
      var TOP = STACK + '[' + STACK + '.length-1]'
      draw(setUniformString(GL, uniform.info.type, LOCATION, TOP))
    })

    // Execute draw command
    var CUR_PRIMITIVE = def(stackTop(DRAW_STATE.primitive))
    var CUR_COUNT = def(stackTop(DRAW_STATE.count))
    var CUR_OFFSET = def(stackTop(DRAW_STATE.offset))
    var CUR_ELEMENTS = def(stackTop(ELEMENT_STATE))

    // Only execute draw command if number elements is > 0
    draw('if(', CUR_COUNT, '){')

    var instancing = extensions.angle_instanced_arrays
    if (instancing) {
      var CUR_INSTANCES = def(stackTop(DRAW_STATE.instances))
      var INSTANCE_EXT = link(instancing)
      draw(
        'if(', CUR_ELEMENTS, '){',
        CUR_ELEMENTS, '.bind();',
        'if(', CUR_INSTANCES, '>0){',
        INSTANCE_EXT, '.drawElementsInstancedANGLE(',
        CUR_PRIMITIVE, ',',
        CUR_COUNT, ',',
        CUR_ELEMENTS, '.type,',
        CUR_OFFSET, ',',
        CUR_INSTANCES, ');}else{',
        GL, '.drawElements(',
        CUR_PRIMITIVE, ',',
        CUR_COUNT, ',',
        CUR_ELEMENTS, '.type,',
        CUR_OFFSET, ');}',
        '}else if(', CUR_INSTANCES, '>0){',
        INSTANCE_EXT, '.drawArraysInstancedANGLE(',
        CUR_PRIMITIVE, ',',
        CUR_OFFSET, ',',
        CUR_COUNT, ',',
        CUR_INSTANCES, ');}else{',
        GL, '.drawArrays(',
        CUR_PRIMITIVE, ',',
        CUR_OFFSET, ',',
        CUR_COUNT, ');}}')
    } else {
      draw(
        'if(', CUR_ELEMENTS, '){',
        GL, '.drawElements(',
        CUR_PRIMITIVE, ',',
        CUR_COUNT, ',',
        CUR_ELEMENTS, '.type,',
        CUR_OFFSET, ');}',
        '}else{',
        GL, '.drawArrays(',
        CUR_PRIMITIVE, ',',
        CUR_OFFSET, ',',
        CUR_COUNT, ');}')
    }

    return env.compile().draw
  }

  // ===================================================
  // ===================================================
  // BATCH DRAW OPERATION
  // ===================================================
  // ===================================================
  function compileBatch (program, options, uniforms, attributes) {
    // -------------------------------
    // code generation helpers
    // -------------------------------
    var env = createEnvironment()
    var link = env.link
    var batch = env.proc('batch')
    var exit = env.block()
    var def = batch.def
    var arg = batch.arg

    // -------------------------------
    // regl state
    // -------------------------------
    var GL = link(gl)
    var PROGRAM = link(program.program)
    var BIND_ATTRIBUTE = link(attributeState.bind)
    var FRAME_STATE = link(frameState)
    var FRAME_COUNT = def(FRAME_STATE, '.count')

    var DRAW_STATE = {
      count: link(drawState.count),
      offset: link(drawState.offset),
      instances: link(drawState.instances),
      primitive: link(drawState.primitive)
    }
    var CUR_COUNT = def(stackTop(DRAW_STATE.count))
    var CUR_OFFSET = def(stackTop(DRAW_STATE.offset))
    var CUR_PRIMITIVE = def(stackTop(DRAW_STATE.primitive))
    var CUR_INSTANCES
    var INSTANCE_EXT
    var instancing = extensions.angle_instanced_arrays
    if (instancing) {
      CUR_INSTANCES = def(stackTop(DRAW_STATE.instances))
      INSTANCE_EXT = link(instancing)
    }

    // -------------------------------
    // batch/argument vars
    // -------------------------------
    var ARGS = arg()
    var ARG = def()
    var BATCH_ID = def()
    var NUM_ARGS = def()

    // -------------------------------
    // load a dynamic variable
    // -------------------------------
    var dynamicVars = {}
    function dyn (x) {
      var id = x.id
      var result = dynamicVars[id]
      if (result) {
        return result
      }
      if (x.func) {
        result = batch.def(
          link(x.data), '(', FRAME_COUNT, ',', BATCH_ID, ',', ARG, ')')
      } else {
        result = batch.def(ARG, '.', x.data)
      }
      dynamicVars[id] = result
      return result
    }

    // -------------------------------
    // retrieves the first name-matching record from an ActiveInfo list
    // -------------------------------
    function findInfo (list, name) {
      return list.find(function (item) {
        return item.name === name
      })
    }

    // -------------------------------
    // bind shader
    // -------------------------------
    batch(GL, '.useProgram(', PROGRAM, ');')

    // -------------------------------
    // set static uniforms
    // -------------------------------
    program.uniforms.forEach(function (uniform) {
      if (uniform.name in uniforms) {
        return
      }
      var LOCATION = link(uniform.location)
      var STACK = link(uniformState.uniforms[uniform.name])
      var TOP = STACK + '[' + STACK + '.length-1]'
      batch(setUniformString(GL, uniform.info.type, LOCATION, TOP))
    })

    // -------------------------------
    // set static attributes
    // -------------------------------
    program.attributes.forEach(function (attribute) {
      if (attributes.name in attributes) {
        return
      }
      var STACK = link(attributeState.attributes[attribute.name])
      batch(BIND_ATTRIBUTE, '(',
        attribute.location, ',',
        link(attributeState.bindings[attribute.location]), ',',
        STACK, '.records[', STACK, '.top]', ',',
        typeLength(attribute.info.type), ');')
    })

    // -------------------------------
    // loop over all arguments
    // -------------------------------
    batch(
      NUM_ARGS, '=', ARGS, '.length;',
      'for(', BATCH_ID, '=0;', BATCH_ID, '<', NUM_ARGS, ';++', BATCH_ID, '){',
      ARG, '=', ARGS, '[', BATCH_ID, '];')

    // -------------------------------
    // set dynamic flags
    // -------------------------------
    Object.keys(options).forEach(function (option) {
      switch (option) {
        default:
          check.raise('unsupported option for batch', option)
      }
    })

    // -------------------------------
    // set dynamic uniforms
    // -------------------------------
    var programUniforms = program.uniforms
    Object.keys(uniforms).forEach(function (uniform) {
      var data = findInfo(programUniforms, uniform)
      if (!data) {
        return
      }
      var TYPE = data.info.type
      var LOCATION = link(data.location)
      var VALUE = dyn(uniforms[uniform])
      batch(setUniformString(GL, TYPE, LOCATION, VALUE))
    })

    // -------------------------------
    // set dynamic attributes
    // -------------------------------
    var programAttributes = program.attributes
    Object.keys(attributes).forEach(function (attribute) {
      var data = findInfo(programAttributes, attribute)
      if (!data) {
        return
      }
      batch(BIND_ATTRIBUTE, '(',
        data.location, ',',
        link(attribute.bindings[data.location]), ',',
        dyn(attributes[attribute]), ',',
        typeLength(data.info.type), ');')
    })

    // -------------------------------
    // set dynamic attributes
    // -------------------------------
    if (options.count) {
      batch(CUR_COUNT, '=', dyn(options.count), ';')
    }
    if (options.offset) {
      batch(CUR_OFFSET, '=', dyn(options.offset), ';')
    }
    if (options.primitive) {
      var PRIM_TYPES = link(primTypes)
      batch(CUR_PRIMITIVE, '=', PRIM_TYPES, '[', dyn(options.primitive), '];')
    }
    if (instancing) {
      if (options.instances) {
        batch(CUR_INSTANCES, '=', dyn(options.instances), ';')
      }
      batch(
        'if(', CUR_INSTANCES, '>0){',
        INSTANCE_EXT, '.drawArraysInstancedANGLE(',
        CUR_PRIMITIVE, ',',
        CUR_OFFSET, ',',
        CUR_COUNT, ',',
        CUR_INSTANCES, ');}else{',
        GL, '.drawArrays(',
        CUR_PRIMITIVE, ',',
        CUR_OFFSET, ',',
        CUR_COUNT, ');}')
    } else {
      batch(
        GL, '.drawArrays(',
        CUR_PRIMITIVE, ',',
        CUR_OFFSET, ',',
        CUR_COUNT, ');')
    }

    // -------------------------------
    // compile and return
    // -------------------------------
    batch('}', exit)
    return env.compile().batch
  }

  // ===================================================
  // ===================================================
  // MAIN DRAW COMMAND
  // ===================================================
  // ===================================================
  function compileCommand (
    staticOptions, staticUniforms, staticAttributes,
    dynamicOptions, dynamicUniforms, dynamicAttributes,
    hasDynamic) {
    // Create code generation environment
    var env = createEnvironment()
    var link = env.link
    var block = env.block
    var proc = env.proc

    var callId = drawCallCounter++

    // -------------------------------
    // Common state variables
    // -------------------------------
    var GL_POLL = link(glState.poll)
    var PROGRAM_STATE = link(shaderState.programs)
    var DRAW_STATE = {
      count: link(drawState.count),
      offset: link(drawState.offset),
      instances: link(drawState.instances),
      primitive: link(drawState.primitive)
    }
    var ELEMENT_STATE = link(elementState.elements)
    var PRIM_TYPES = link(primTypes)

    var CONTEXT_STATE = {}
    function linkContext (x) {
      var result = CONTEXT_STATE[x]
      if (result) {
        return result
      }
      result = CONTEXT_STATE[x] = link(contextState[x])
      return result
    }

    // ==========================================================
    // STATIC STATE
    // ==========================================================
    // Code blocks for the static sections
    var entry = block()
    var exit = block()

    // -------------------------------
    // update default context state variables
    // -------------------------------
    function handleStaticOption (param, value) {
      var STATE_STACK = linkContext(param)
      entry(STATE_STACK, '.push(', value, ');')
      exit(STATE_STACK, '.pop();')
    }

    var hasShader = false
    Object.keys(staticOptions).forEach(function (param) {
      var value = staticOptions[param]
      switch (param) {
        case 'frag':
        case 'vert':
          hasShader = true
          break

        // Update draw state
        case 'count':
        case 'offset':
        case 'instances':
          check.nni(value, param)
          entry(DRAW_STATE[param], '.push(', value, ');')
          exit(DRAW_STATE[param], '.pop();')
          break

        // Update primitive type
        case 'primitive':
          check.parameter(value, primTypes, 'not a valid drawing primitive')
          var primType = primTypes[value]
          entry(DRAW_STATE.primitive, '.push(', primType, ');')
          exit(DRAW_STATE.primitive, '.pop();')
          break

        // Update element buffer
        case 'elements':
          var elements = elementState.getElements(value)
          var hasPrimitive = !('primitive' in staticOptions)
          var hasCount = !('count' in staticOptions)
          if (elements) {
            var ELEMENTS = link(elements)
            entry(ELEMENT_STATE, '.push(', ELEMENTS, ');')
            if (hasPrimitive) {
              entry(DRAW_STATE.primitive, '.push(', ELEMENTS, '.primType);')
            }
            if (hasCount) {
              entry(DRAW_STATE.count, '.push(', ELEMENTS, '.vertCount);')
            }
          } else {
            entry(ELEMENT_STATE, '.push(null);')
            if (hasPrimitive) {
              entry(DRAW_STATE.primitive, '.push(', GL_TRIANGLES, ');')
            }
            if (hasCount) {
              entry(DRAW_STATE.count, '.push(0);')
            }
          }
          if (hasPrimitive) {
            exit(DRAW_STATE.primitive, '.pop();')
          }
          if (hasCount) {
            exit(DRAW_STATE.count, '.pop();')
          }
          if (!('offset' in staticOptions)) {
            entry(DRAW_STATE.offset, '.push(0);')
            exit(DRAW_STATE.offset, '.pop();')
          }
          exit(ELEMENT_STATE, '.pop();')
          break

        // Caps
        case 'cull':
        case 'blend':
        case 'dither':
        case 'stencilTest':
        case 'depthTest':
        case 'scissorTest':
        case 'polygonOffsetFill':
        case 'sampleAlpha':
        case 'sampleCoverage':
        case 'stencilMask':
        case 'depthMask':
          check.type(value, 'boolean', param)
          handleStaticOption(param, value)
          break

        // Line width
        case 'lineWidth':
          check(value >= 0 && typeof value === 'number', param)
          handleStaticOption(param, value)
          break

        // TODO Handle the rest of the state values here

        default:
          // TODO Should this just be a warning instead?
          check.raise('unsupported parameter ' + param)
          break
      }
    })

    // -------------------------------
    // update shader program
    // -------------------------------
    var program
    if (hasShader) {
      var fragSrc = staticOptions.frag || DEFAULT_FRAG_SHADER
      var vertSrc = staticOptions.vert || DEFAULT_VERT_SHADER
      program = shaderState.create(vertSrc, fragSrc)
      entry(PROGRAM_STATE, '.push(', link(program), ');')
      exit(PROGRAM_STATE, '.pop();')
    }

    // -------------------------------
    // update static uniforms
    // -------------------------------
    Object.keys(staticUniforms).forEach(function (uniform) {
      uniformState.def(uniform)
      var STACK = link(uniformState.uniforms[uniform])
      var VALUE
      var value = staticUniforms[uniform]
      if (Array.isArray(value)) {
        VALUE = link(value.slice())
      } else {
        VALUE = +value
      }
      entry(STACK, '.push(', VALUE, ');')
      exit(STACK, '.pop();')
    })

    // -------------------------------
    // update default attributes
    // -------------------------------
    Object.keys(staticAttributes).forEach(function (attribute) {
      attributeState.def(attribute)
      var ATTRIBUTE = link(attributeState.attributes[attribute])

      var data = staticAttributes[attribute]
      if (typeof data === 'number') {
        entry(ATTRIBUTE, '.pushVec(', +data, ',0,0,0);')
      } else {
        check(!!data, 'invalid attribute: ' + attribute)

        if (Array.isArray(data)) {
          entry(
            ATTRIBUTE, '.pushVec(',
            [data[0] || 0, data[1] || 0, data[2] || 0, data[3] || 0], ');')
        } else {
          var buffer = bufferState.getBuffer(data)
          var size = 0
          var stride = 0
          var offset = 0
          var divisor = 0
          var normalized = false
          var type = GL_FLOAT

          if (!buffer) {
            check.type(data, 'object', 'invalid attribute "' + attribute + '"')

            buffer = bufferState.getBuffer(data.buffer)
            size = data.size || 0
            stride = data.stride || 0
            offset = data.offset || 0
            divisor = data.divisor || 0
            normalized = data.normalized || false

            check(!!buffer, 'invalid attribute ' + attribute + '.buffer')

            // Check for user defined type overloading
            type = buffer.dtype
            if ('type' in data) {
              check.parameter(data.type, glTypes, 'attribute type')
              type = glTypes[data.type]
            }
          } else {
            type = buffer.dtype
          }

          check(!!buffer, 'invalid attribute ' + attribute + '.buffer')
          check.nni(stride, attribute + '.stride')
          check.nni(offset, attribute + '.offset')
          check.nni(divisor, attribute + '.divisor')
          check.type(normalized, 'boolean', attribute + '.normalized')
          check.oneOf(size, [0, 1, 2, 3, 4], attribute + '.size')

          entry(
            ATTRIBUTE, '.pushPtr(', [
              link(buffer), size, offset, stride,
              divisor, normalized, type
            ].join(), ');')
        }
      }
      exit(ATTRIBUTE, '.pop();')
    })

    // ==========================================================
    // DYNAMIC STATE (for scope and draw)
    // ==========================================================
    // Generated code blocks for dynamic state flags
    var dynamicEntry = env.block()
    var dynamicExit = env.block()

    var FRAMECOUNT
    var DYNARGS
    if (hasDynamic) {
      FRAMECOUNT = entry.def(link(frameState), '.count')
      DYNARGS = entry.def()
    }

    var dynamicVars = {}
    function dyn (x) {
      var id = x.id
      var result = dynamicVars[id]
      if (result) {
        return result
      }
      if (x.func) {
        result = dynamicEntry.def(
          link(x.data), '(', FRAMECOUNT, ',0,', DYNARGS, ')')
      } else {
        result = dynamicEntry.def(DYNARGS, '.', x.data)
      }
      dynamicVars[id] = result
      return result
    }

    // -------------------------------
    // dynamic context state variables
    // -------------------------------
    Object.keys(dynamicOptions).forEach(function (param) {
      // Link in dynamic variable
      var variable = dyn(dynamicOptions[param])

      switch (param) {
        case 'cull':
        case 'blend':
        case 'dither':
        case 'stencilTest':
        case 'depthTest':
        case 'scissorTest':
        case 'polygonOffsetFill':
        case 'sampleAlpha':
        case 'sampleCoverage':
        case 'stencilMask':
        case 'depthMask':
          var STATE_STACK = linkContext(param)
          dynamicEntry(STATE_STACK, '.push(', variable, ');')
          dynamicExit(STATE_STACK, '.pop();')
          break

        // Draw calls
        case 'count':
        case 'offset':
        case 'instances':
          var DRAW_STACK = DRAW_STATE[param]
          dynamicEntry(DRAW_STACK, '.push(', variable, ');')
          dynamicExit(DRAW_STACK, '.pop();')
          break

        case 'primitive':
          var PRIM_STACK = DRAW_STATE.primitive
          dynamicEntry(PRIM_STACK, '.push(', PRIM_TYPES, '[', variable, ']);')
          dynamicExit(PRIM_STACK, '.pop()')
          break

        default:
          break
      }
    })

    // -------------------------------
    // dynamic uniforms
    // -------------------------------
    Object.keys(dynamicUniforms).forEach(function (uniform) {
      var STACK = link(uniformState.uniforms[uniform])
      var VALUE = dyn(dynamicUniforms[uniform])
      uniformState.def(uniform)
      dynamicEntry(STACK, '.push(', VALUE, ');')
      dynamicExit(STACK, '.pop();')
    })

    // -------------------------------
    // dynamic attributes
    // -------------------------------
    Object.keys(dynamicAttributes).forEach(function (attribute) {
      var ATTRIBUTE = link(attributeState.attributes[attribute])
      var VALUE = dyn(dynamicAttributes[attribute])
      attributeState.def(attribute)
      dynamicEntry(ATTRIBUTE, '.pushDyn(', VALUE, ');')
      dynamicExit(ATTRIBUTE, '.pop();')
    })

    // ==========================================================
    // SCOPE PROCEDURE
    // ==========================================================
    var scope = proc('scope')

    scope(entry)

    if (hasDynamic) {
      scope(
        DYNARGS, '=', scope.arg(), ';',
        dynamicEntry)
    }

    scope(
      scope.arg(), '();',
      hasDynamic ? dynamicExit : '',
      exit)

    // ==========================================================
    // DRAW PROCEDURE
    // ==========================================================
    var draw = proc('draw')

    draw(entry)

    if (hasDynamic) {
      draw(
        DYNARGS, '=', draw.arg(), ';',
        dynamicEntry)
    }

    var CURRENT_SHADER = stackTop(PROGRAM_STATE)
    draw(
      GL_POLL, '();',
      'if(', CURRENT_SHADER, ')',
      CURRENT_SHADER, '.draw(', hasDynamic ? DYNARGS : '', ');',
      hasDynamic ? dynamicExit : '',
      exit)

    // ==========================================================
    // BATCH DRAW
    // ==========================================================
    if (hasDynamic) {
      var batch = proc('batch')
      batch(entry)
      var CUR_SHADER = batch.def(stackTop(PROGRAM_STATE))
      var EXEC_BATCH = link(function (program, args) {
        var proc = program.batchCache[callId]
        if (!proc) {
          proc = program.batchCache[callId] = compileBatch(
            program, dynamicOptions, dynamicUniforms, dynamicAttributes)
        }
        return proc(args)
      })
      batch(
        'if(', CUR_SHADER, '){',
        GL_POLL, '();',
        EXEC_BATCH, '(',
        CUR_SHADER, ',',
        batch.arg(), ');}',
        exit)
    }

    // -------------------------------
    // eval and bind
    // -------------------------------
    return env.compile()
  }

  return {
    draw: compileShaderDraw,
    command: compileCommand
  }
}

},{"./check":4,"./codegen":6,"./constants/dtypes.json":9,"./constants/primitives.json":10}],8:[function(require,module,exports){
module.exports={
  "[object Int8Array]": 5120
, "[object Int16Array]": 5122
, "[object Int32Array]": 5124
, "[object Uint8Array]": 5121
, "[object Uint8ClampedArray]": 5121
, "[object Uint16Array]": 5123
, "[object Uint32Array]": 5125
, "[object Float32Array]": 5126
, "[object Float64Array]": 5121
, "[object ArrayBuffer]": 5121
}

},{}],9:[function(require,module,exports){
module.exports={
  "int8": 5120
, "int16": 5122
, "int32": 5124
, "uint8": 5121
, "uint16": 5123
, "uint32": 5125
, "float": 5126
}

},{}],10:[function(require,module,exports){
module.exports={
  "points": 0,
  "lines": 1,
  "line loop": 2,
  "line strip": 3,
  "triangles": 4,
  "triangle strip": 5,
  "triangle fan": 6
}

},{}],11:[function(require,module,exports){
module.exports={"static":35044,"dynamic":35048,"stream":35040}

},{}],12:[function(require,module,exports){
// Context and canvas creation helper functions
/*globals HTMLElement,WebGLRenderingContext*/

var check = require('./check')

function createCanvas (element, options) {
  var canvas = document.createElement('canvas')
  var args = getContext(canvas, options)

  Object.assign(canvas.style, {
    border: 0,
    margin: 0,
    padding: 0,
    top: 0,
    left: 0
  })
  element.appendChild(canvas)

  if (element === document.body) {
    canvas.style.position = 'absolute'
    Object.assign(element.style, {
      margin: 0,
      padding: 0
    })
  }

  var scale = +window.devicePixelRatio
  function resize () {
    var w = window.innerWidth
    var h = window.innerHeight
    if (element !== document.body) {
      var bounds = element.getBoundingClientRect()
      w = bounds.right - bounds.left
      h = bounds.top - bounds.bottom
    }
    canvas.width = scale * w
    canvas.height = scale * h
    Object.assign(canvas.style, {
      width: w + 'px',
      height: h + 'px'
    })
  }

  window.addEventListener('resize', resize, false)

  var prevDestroy = args.options.onDestroy
  args.options = Object.assign({}, args.options, {
    onDestroy: function () {
      window.removeEventListener('resize', resize)
      element.removeChild(canvas)
      prevDestroy && prevDestroy()
    }
  })

  resize()

  return args
}

function getContext (canvas, options) {
  var glOptions = options.glOptions

  function get (name) {
    try {
      return canvas.getContext(name, glOptions)
    } catch (e) {
      return null
    }
  }

  var gl = get('webgl') ||
           get('experimental-webgl') ||
           get('webgl-experimental')

  check(gl, 'webgl not supported')

  return {
    gl: gl,
    options: options
  }
}

module.exports = function parseArgs (args) {
  if (typeof document === 'undefined' ||
      typeof HTMLElement === 'undefined') {
    return {
      gl: args[0],
      options: args[1] || {}
    }
  }

  var element = document.body
  var options = args[1] || {}

  if (typeof args[0] === 'string') {
    element = document.querySelector(args[0]) || document.body
  } else if (typeof args[0] === 'object') {
    if (args[0] instanceof HTMLElement) {
      element = args[0]
    } else if (args[0] instanceof WebGLRenderingContext) {
      return {
        gl: args[0],
        options: options
      }
    } else {
      options = args[0]
    }
  }

  if (element.nodeName && element.nodeName.toUpperCase() === 'CANVAS') {
    return getContext(element, options)
  } else {
    return createCanvas(element, options)
  }
}

},{"./check":4}],13:[function(require,module,exports){
var GL_TRIANGLES = 4

module.exports = function wrapDrawState (gl) {
  var primitive = [ GL_TRIANGLES ]
  var count = [ 0 ]
  var offset = [ 0 ]
  var instances = [ 0 ]

  return {
    primitive: primitive,
    count: count,
    offset: offset,
    instances: instances
  }
}

},{}],14:[function(require,module,exports){
var VARIABLE_COUNTER = 0

function DynamicVariable (isFunc, data) {
  this.id = (VARIABLE_COUNTER++)
  this.func = isFunc
  this.data = data
}

function defineDynamic (data, path) {
  switch (typeof data) {
    case 'boolean':
    case 'number':
    case 'string':
      return new DynamicVariable(false, data)
    case 'function':
      return new DynamicVariable(true, data)
    default:
      return defineDynamic
  }
}

function isDynamic (x) {
  return (typeof x === 'function' && !x._reglType) ||
         x instanceof DynamicVariable
}

function unbox (x, path) {
  if (x instanceof DynamicVariable) {
    return x
  } else if (typeof x === 'function' &&
             x !== defineDynamic) {
    return new DynamicVariable(true, x)
  }
  return new DynamicVariable(false, path)
}

module.exports = {
  define: defineDynamic,
  isDynamic: isDynamic,
  unbox: unbox
}

},{}],15:[function(require,module,exports){
var check = require('./check')
var isTypedArray = require('./is-typed-array')
var primTypes = require('./constants/primitives.json')

var GL_POINTS = 0
var GL_LINES = 1
var GL_TRIANGLES = 4

var GL_UNSIGNED_BYTE = 5121
var GL_UNSIGNED_SHORT = 5123
var GL_UNSIGNED_INT = 5125

var GL_ELEMENT_ARRAY_BUFFER = 34963

module.exports = function wrapElementsState (gl, extensionState, bufferState) {
  var extensions = extensionState.extensions

  var elements = [ null ]

  function REGLElementBuffer () {
    this.buffer = null
    this.primType = GL_TRIANGLES
    this.vertCount = 0
    this.type = 0
  }

  function parseOptions (elements, options) {
    var result = {
      type: 'elements'
    }
    var ext32bit = extensions.oes_element_index_uint
    elements.primType = GL_TRIANGLES
    elements.vertCount = 0
    elements.type = 0

    var data = null

    // Check option type
    if (!options) {
      return result
    }
    if (typeof options === 'number') {
      result.length = options
    } else {
      check.type(options, 'object', 'argument to element buffer must be object')
      data = options.data || options
    }

    if (Array.isArray(data)) {
      if (options.length === 0) {
        data = null
      } else if (Array.isArray(data[0])) {
        var dim = data[0].length
        if (dim === 1) elements.primType = GL_POINTS
        if (dim === 2) elements.primType = GL_LINES
        if (dim === 3) elements.primType = GL_TRIANGLES
        var i
        var count = 0
        for (i = 0; i < data.length; ++i) {
          count += data[i].length
        }
        var flattened = ext32bit
          ? new Uint32Array(count)
          : new Uint16Array(count)
        var ptr = 0
        for (i = 0; i < data.length; ++i) {
          var x = data[i]
          for (var j = 0; j < x.length; ++j) {
            flattened[ptr++] = x[j]
          }
        }
        data = flattened
      } else if (ext32bit) {
        data = new Uint32Array(data)
      } else {
        data = new Uint16Array(data)
      }
    }

    if (isTypedArray(data)) {
      if ((data instanceof Uint8Array) ||
          (data instanceof Uint8ClampedArray)) {
        elements.type = GL_UNSIGNED_BYTE
      } else if (data instanceof Uint16Array) {
        elements.type = GL_UNSIGNED_SHORT
      } else if (data instanceof Uint32Array) {
        check(ext32bit, '32-bit element buffers not supported')
        elements.type = GL_UNSIGNED_INT
      } else {
        check.raise('invalid typed array for element buffer')
      }
      elements.vertCount = data.length
      result.data = data
    } else {
      check(!data, 'invalid element buffer data type')
    }

    if (typeof options === 'object') {
      if ('primitive' in options) {
        var primitive = options.primitive
        check.param(primitive, primTypes)
        elements.primType = primTypes[primitive]
      }

      if ('usage' in options) {
        result.usage = options.usage
      }

      if ('count' in options) {
        elements.vertCount = options.vertCount | 0
      }
    }

    return result
  }

  Object.assign(REGLElementBuffer.prototype, {
    bind: function () {
      gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, this.buffer._buffer.buffer)
    },

    destroy: function () {
      if (this.buffer) {
        this.buffer.destroy()
        this.buffer = null
      }
    }
  })

  function createElements (options) {
    var elements = new REGLElementBuffer()

    // Create buffer
    elements.buffer = bufferState.create(
      parseOptions(elements, options),
      GL_ELEMENT_ARRAY_BUFFER)

    function updateElements (options) {
      elements.buffer.udate(parseOptions(elements, options))
      return updateElements
    }

    updateElements._reglType = 'elements'
    updateElements._elements = elements
    updateElements.destroy = function () { elements.destroy() }

    return updateElements
  }

  return {
    create: createElements,
    elements: elements,
    getElements: function (elements) {
      if (elements && elements._elements instanceof REGLElementBuffer) {
        return elements._elements
      }
      return null
    }
  }
}

},{"./check":4,"./constants/primitives.json":10,"./is-typed-array":18}],16:[function(require,module,exports){
// Extension wrangling

var check = require('./check')

module.exports = function createExtensionCache (gl, required) {
  var extensions = {}

  function refreshExtensions () {
    [
      'oes_texture_float',
      'oes_texture_float_linear',
      'oes_texture_half_float',
      'oes_texture_half_float_linear',
      'oes_standard_derivatives',
      'oes_element_index_uint',
      'oes_fbo_render_mipmap',

      'webgl_depth_texture',
      'webgl_draw_buffers',
      'webgl_color_buffer_float',

      'ext_texture_filter_anisotropic',
      'ext_frag_depth',
      'ext_blend_minmax',
      'ext_shader_texture_lod',
      'ext_color_buffer_half_float',
      'ext_srgb',

      'angle_instanced_arrays'
    ].forEach(function (ext) {
      try {
        extensions[ext] = gl.getExtension(ext)
      } catch (e) {}
    })

    required.forEach(function (ext) {
      check(extensions[ext.toLowerCase()],
        'required extension "' + ext + '" is unsupported')
    })
  }

  refreshExtensions()

  return {
    extensions: extensions,
    refresh: refreshExtensions
  }
}

},{"./check":4}],17:[function(require,module,exports){
// Framebuffer object state management

module.exports = function wrapFBOState (
  gl,
  textureCache) {
  function createFBO (options) {
  }

  function clearCache () {
  }

  function refreshCache () {
  }

  return {
    create: createFBO,
    clear: clearCache,
    refresh: refreshCache,
    getFBO: function (wrapper) {
      return null
    }
  }
}

},{}],18:[function(require,module,exports){
var dtypes = require('./constants/arraytypes.json')
module.exports = function (x) {
  return Object.prototype.toString.call(x) in dtypes
}

},{"./constants/arraytypes.json":8}],19:[function(require,module,exports){
/* globals requestAnimationFrame, cancelAnimationFrame */
if (typeof requestAnimationFrame === 'function' &&
    typeof cancelAnimationFrame === 'function') {
  module.exports = {
    next: function (x) { return requestAnimationFrame(x) },
    cancel: function (x) { return cancelAnimationFrame(x) }
  }
} else {
  module.exports = {
    next: function (cb) {
      setTimeout(cb, 30)
    },
    cancel: clearTimeout
  }
}

},{}],20:[function(require,module,exports){
var check = require('./check')
var isTypedArray = require('./is-typed-array')

var GL_RGBA = 6408
var GL_UNSIGNED_BYTE = 5121
var GL_PACK_ALIGNMENT = 0x0D05

module.exports = function wrapReadPixels (gl, glState) {
  function readPixels (input) {
    var options = input || {}
    if (isTypedArray(input)) {
      options = {
        data: options
      }
    } else if (arguments.length === 2) {
      options = {
        width: arguments[0] | 0,
        height: arguments[1] | 0
      }
    } else if (typeof input !== 'object') {
      options = {}
    }

    // Update WebGL state
    glState.poll()

    // Read viewport state
    var viewportState = glState.viewport
    var x = options.x || 0
    var y = options.y || 0
    var width = options.width || viewportState.width
    var height = options.height || viewportState.height

    // Compute size
    var size = width * height * 4

    // Allocate data
    var data = options.data || new Uint8Array(size)

    // Type check
    check.isTypedArray(data)
    check(data.byteLength >= size, 'data buffer too small')

    // Run read pixels
    gl.pixelStorei(GL_PACK_ALIGNMENT, 4)
    gl.readPixels(x, y, width, height, GL_RGBA, GL_UNSIGNED_BYTE, data)

    return data
  }

  return readPixels
}

},{"./check":4,"./is-typed-array":18}],21:[function(require,module,exports){
var check = require('./check')

var GL_FRAGMENT_SHADER = 35632
var GL_VERTEX_SHADER = 35633

function ActiveInfo (name, location, info) {
  this.name = name
  this.location = location
  this.info = info
}

module.exports = function wrapShaderState (
  gl,
  extensions,
  attributeState,
  uniformState,
  compileShaderDraw) {
  // ===================================================
  // glsl compilation and linking
  // ===================================================
  var shaders = {}

  function getShader (type, source) {
    var cache = shaders[type]
    var shader = cache[source]

    if (!shader) {
      shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var errLog = gl.getShaderInfoLog(shader)
        check.raise('Error compiling shader:\n' + errLog)
      }
      cache[source] = shader
    }

    return shader
  }

  function refreshShaders () {
    shaders[GL_FRAGMENT_SHADER] = {}
    shaders[GL_VERTEX_SHADER] = {}
  }

  function clearShaders () {
    Object.keys(shaders).forEach(function (type) {
      Object.keys(shaders[type]).forEach(function (shader) {
        gl.destroyShader(shader)
      })
    })
    shaders[GL_FRAGMENT_SHADER] = {}
    shaders[GL_VERTEX_SHADER] = {}
  }

  // ===================================================
  // program linking
  // ===================================================
  var programCache = {}
  var programList = []

  function REGLProgram (fragSrc, vertSrc) {
    this.fragSrc = fragSrc
    this.vertSrc = vertSrc
    this.program = null
    this.uniforms = []
    this.attributes = []
    this.draw = function () {}
    this.batchCache = {}
  }

  Object.assign(REGLProgram.prototype, {
    link: function () {
      var i, info

      // -------------------------------
      // compile & link
      // -------------------------------
      var fragShader = getShader(gl.FRAGMENT_SHADER, this.fragSrc)
      var vertShader = getShader(gl.VERTEX_SHADER, this.vertSrc)

      var program = this.program = gl.createProgram()
      gl.attachShader(program, fragShader)
      gl.attachShader(program, vertShader)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        var errLog = gl.getProgramInfoLog(program)
        check.raise('Error linking program:\n' + errLog)
      }

      // -------------------------------
      // grab uniforms
      // -------------------------------
      var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
      var uniforms = this.uniforms = []
      for (i = 0; i < numUniforms; ++i) {
        info = gl.getActiveUniform(program, i)
        if (info) {
          if (info.size > 1) {
            for (var j = 0; j < info.size; ++j) {
              var name = info.name.replace('[0]', '[' + j + ']')
              uniforms.push(new ActiveInfo(
                name,
                gl.getUniformLocation(program, name),
                info))
              uniformState.def(name)
            }
          } else {
            uniforms.push(new ActiveInfo(
              info.name,
              gl.getUniformLocation(program, info.name),
              info))
            uniformState.def(info.name)
          }
        }
      }

      // -------------------------------
      // grab attributes
      // -------------------------------
      var numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
      var attributes = this.attributes = []
      for (i = 0; i < numAttributes; ++i) {
        info = gl.getActiveAttrib(program, i)
        if (info) {
          attributes.push(new ActiveInfo(
            info.name,
            gl.getAttribLocation(program, info.name),
            info))
          attributeState.def(info.name)
        }
      }

      // -------------------------------
      // clear cached rendering methods
      // -------------------------------
      this.draw = compileShaderDraw(this)
      this.batchCache = {}
    },

    destroy: function () {
      gl.deleteProgram(this.program)
    }
  })

  function getProgram (vertSource, fragSource) {
    var cache = programCache[fragSource]
    if (!cache) {
      cache = programCache[vertSource] = {}
    }
    var program = cache[vertSource]
    if (!program) {
      program = new REGLProgram(fragSource, vertSource)
      program.link()
      cache[vertSource] = program
      programList.push(program)
    }
    return program
  }

  function clearPrograms () {
    programList.forEach(function (program) {
      program.destroy()
    })
    programList.length = 0
    programCache = {}
  }

  function refreshPrograms () {
    programList.forEach(function (program) {
      program.link()
    })
  }

  // ===================================================
  // program state
  // ===================================================
  var programState = [null]

  // ===================================================
  // context management
  // ===================================================
  function clear () {
    clearShaders()
    clearPrograms()
  }

  function refresh () {
    refreshShaders()
    refreshPrograms()
  }

  // We call clear once to initialize all data structures
  clear()

  return {
    create: getProgram,
    clear: clear,
    refresh: refresh,
    programs: programState
  }
}

},{"./check":4}],22:[function(require,module,exports){
// A stack for managing the state of a scalar/vector parameter

module.exports = function createStack (init, onChange) {
  var n = init.length
  var stack = init.slice()
  var dirty = true

  function poll () {
    var ptr = stack.length - n
    if (dirty) {
      switch (n) {
        case 1:
          onChange(stack[ptr])
          break
        case 2:
          onChange(stack[ptr], stack[ptr + 1])
          break
        case 3:
          onChange(stack[ptr], stack[ptr + 1], stack[ptr + 2])
          break
        case 4:
          onChange(stack[ptr], stack[ptr + 1], stack[ptr + 2], stack[ptr + 3])
          break
        case 5:
          onChange(stack[ptr], stack[ptr + 1], stack[ptr + 2], stack[ptr + 3], stack[ptr + 4])
          break
        case 6:
          onChange(stack[ptr], stack[ptr + 1], stack[ptr + 2], stack[ptr + 3], stack[ptr + 4], stack[ptr + 5])
          break
        default:
          onChange.apply(null, stack.slice(ptr, stack.length))
      }
      dirty = false
    }
  }

  return {
    push: function () {
      for (var i = 0; i < n; ++i) {
        stack.push(arguments[i])
      }
      dirty = true
    },

    pop: function () {
      stack.length -= n
      dirty = true
    },

    poll: poll,

    setDirty: function () {
      dirty = true
    }
  }
}

},{}],23:[function(require,module,exports){
var createStack = require('./stack')

// WebGL constants
var GL_CULL_FACE = 0x0B44
var GL_BLEND = 0x0BE2
var GL_DITHER = 0x0BD0
var GL_STENCIL_TEST = 0x0B90
var GL_DEPTH_TEST = 0x0B71
var GL_SCISSOR_TEST = 0x0C11
var GL_POLYGON_OFFSET_FILL = 0x8037
var GL_SAMPLE_ALPHA_TO_COVERAGE = 0x809E
var GL_SAMPLE_COVERAGE = 0x80A0
var GL_FUNC_ADD = 0x8006
var GL_ZERO = 0
var GL_ONE = 1
var GL_FRONT = 1028
var GL_BACK = 1029
var GL_LESS = 513
var GL_CCW = 2305
var GL_ALWAYS = 519
var GL_KEEP = 7680

module.exports = function wrapContextState (gl, shaderState) {
  function capStack (cap) {
    var result = createStack([false], function (flag) {
      if (flag) {
        gl.enable(cap)
      } else {
        gl.disable(cap)
      }
    })
    result.flag = cap
    return result
  }

  var viewportState = {
    width: 0,
    height: 0
  }

  // Caps, flags and other random WebGL context state
  var contextState = {
    // Caps
    cull: capStack(GL_CULL_FACE),
    blend: capStack(GL_BLEND),
    dither: capStack(GL_DITHER),
    stencilTest: capStack(GL_STENCIL_TEST),
    depthTest: capStack(GL_DEPTH_TEST),
    scissorTest: capStack(GL_SCISSOR_TEST),
    polygonOffsetFill: capStack(GL_POLYGON_OFFSET_FILL),
    sampleAlpha: capStack(GL_SAMPLE_ALPHA_TO_COVERAGE),
    sampleCoverage: capStack(GL_SAMPLE_COVERAGE),

    // Blending
    blendEquation: createStack([GL_FUNC_ADD, GL_FUNC_ADD], function (rgb, a) {
      gl.blendEquationSeparate(rgb, a)
    }),
    blendFunc: createStack([
      GL_ONE, GL_ZERO, GL_ONE, GL_ZERO
    ], function (srcRGB, dstRGB, srcAlpha, dstAlpha) {
      gl.blendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha)
    }),

    // Depth
    depthFunc: createStack([GL_LESS], function (func) {
      gl.depthFunc(func)
    }),
    depthRange: createStack([0, 1], function (near, far) {
      gl.depthRange(near, far)
    }),

    // Face culling
    cullFace: createStack([GL_BACK], function (mode) {
      gl.cullFace(mode)
    }),
    frontFace: createStack([GL_CCW], function (mode) {
      gl.frontFace(mode)
    }),

    // Write masks
    colorMask: createStack([true, true, true, true], function (r, g, b, a) {
      gl.colorMask(r, g, b, a)
    }),
    depthMask: createStack([true], function (m) {
      gl.depthMask(m)
    }),
    stencilMask: createStack([-1, -1], function (front, back) {
      gl.stencilMask(GL_FRONT, front)
      gl.stencilMask(GL_BACK, back)
    }),

    // Line width
    lineWidth: createStack([1], function (w) {
      gl.lineWidth(w)
    }),

    // Polygon offset
    polygonOffset: createStack([0, 0], function (factor, units) {
      gl.polygonOffset(factor, units)
    }),

    // Sample coverage
    sampleCoverageParams: createStack([1, false], function (value, invert) {
      gl.sampleCoverage(value, invert)
    }),

    // Stencil
    stencilFunc: createStack([
      GL_ALWAYS, 0, -1,
      GL_ALWAYS, 0, -1
    ], function (frontFunc, frontRef, frontMask,
                 backFunc, backRef, backMask) {
      gl.stencilFuncSeparate(GL_FRONT, frontFunc, frontRef, frontMask)
      gl.stencilFuncSeparate(GL_BACK, backFunc, backRef, backMask)
    }),
    stencilOp: createStack([
      GL_KEEP, GL_KEEP, GL_KEEP,
      GL_KEEP, GL_KEEP, GL_KEEP
    ], function (frontFail, frontDPFail, frontPass,
                 backFail, backDPFail, backPass) {
      gl.stencilOpSeparate(GL_FRONT, frontFail, frontDPFail, frontPass)
      gl.stencilOpSeparate(GL_BACK, backFail, backDPFail, backPass)
    }),

    // Scissor
    scissor: createStack([0, 0, -1, -1], function (x, y, w, h) {
      gl.scissor(
        x, y,
        w < 0 ? gl.drawingBufferWidth : w,
        h < 0 ? gl.drawingBufferHeight : h)
    }),

    // Viewport
    viewport: createStack([0, 0, -1, -1], function (x, y, w, h) {
      var w_ = w
      if (w < 0) {
        w_ = gl.drawingBufferWidth
      }
      var h_ = h
      if (h < 0) {
        h_ = gl.drawingBufferHeight
      }
      gl.viewport(x, y, w_, h_)
      viewportState.width = w_
      viewportState.height = h_
    })
  }

  var contextProps = Object.keys(contextState)

  return {
    contextState: contextState,
    viewport: viewportState,

    poll: function () {
      contextProps.forEach(function (state) {
        contextState[state].poll()
      })
    },

    refresh: function () {
      contextProps.forEach(function (state) {
        contextState[state].setDirty()
      })
    },

    notifyViewportChanged: function () {
      contextState.viewport.setDirty()
      contextState.scissor.setDirty()
    }
  }
}

},{"./stack":22}],24:[function(require,module,exports){
var check = require('./check')

var GL_TEXTURE_2D = 0x0DE1

var GL_DEPTH_COMPONENT = 0x1902
var GL_ALPHA = 0x1906
var GL_RGB = 0x1907
var GL_RGBA = 0x1908
var GL_LUMINANCE = 0x1909
var GL_LUMINANCE_ALPHA = 0x190A

var GL_UNSIGNED_BYTE = 0x1401
var GL_UNSIGNED_SHORT = 0x1403
var GL_FLOAT = 0x1406

var GL_TEXTURE_WRAP_S = 0x2802
var GL_TEXTURE_WRAP_T = 0x2803

var GL_REPEAT = 0x2901
var GL_CLAMP_TO_EDGE = 0x812F
var GL_MIRRORED_REPEAT = 0x8370

var GL_TEXTURE_MAG_FILTER = 0x2800
var GL_TEXTURE_MIN_FILTER = 0x2801

var GL_NEAREST = 0x2600
var GL_LINEAR = 0x2601
var GL_NEAREST_MIPMAP_NEAREST = 0x2700
var GL_LINEAR_MIPMAP_NEAREST = 0x2701
var GL_NEAREST_MIPMAP_LINEAR = 0x2702
var GL_LINEAR_MIPMAP_LINEAR = 0x2703

var GL_UNPACK_FLIP_Y_WEBGL = 0x9240
var GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL = 0x9241
var GL_UNPACK_COLORSPACE_CONVERSION_WEBGL = 0x9243
var GL_BROWSER_DEFAULT_WEBGL = 0x9244

var wrapModes = {
  'repeat': GL_REPEAT,
  'clamp': GL_CLAMP_TO_EDGE,
  'mirror': GL_MIRRORED_REPEAT
}

var magFilters = {
  'nearest': GL_NEAREST,
  'linear': GL_LINEAR
}

var minFilters = Object.assign({
  'nearest mipmap nearest': GL_NEAREST_MIPMAP_NEAREST,
  'linear mipmap nearest': GL_LINEAR_MIPMAP_NEAREST,
  'nearest mipmap linear': GL_NEAREST_MIPMAP_LINEAR,
  'linear mipmap linear': GL_LINEAR_MIPMAP_LINEAR,
  'mipmap': GL_LINEAR_MIPMAP_LINEAR
}, magFilters)

module.exports = function createTextureSet (gl, extensionState) {
  var extensions = extensionState.extensions

  var textureCount = 0
  var textureSet = {}

  function REGLTexture () {
    this.id = textureCount++

    // Texture target
    this.target = GL_TEXTURE_2D

    // Texture handle
    this.texture = null

    // Texture format
    this.format = GL_RGBA
    this.type = GL_UNSIGNED_BYTE

    // Data
    this.mipLevels = []

    // Shape
    this.width = 0
    this.height = 0

    // Parameters
    this.minFilter = GL_NEAREST
    this.magFilter = GL_NEAREST
    this.wrapS = GL_REPEAT
    this.wrapT = GL_REPEAT
    this.mipSamples = 0

    // Storage flags
    this.flipY = false
    this.premultiplyAlpha = false
    this.colorSpace = GL_BROWSER_DEFAULT_WEBGL
  }

  Object.assign(REGLTexture.prototype, {
    bind: function () {
    },

    update: function (args) {
      var options = args || {}

      // Possible initialization pathways:
      if (Array.isArray(args) ||
          isTypedArray(args) ||
          isHTMLElement(args)) {
        options = {
          data: args
        }
      }

      var data = options.data || null
      var width = options.width || 0
      var height = options.height || 0
      var format = options.format || 'rgba'

      this.minFilter = GL_NEAREST
      if ('min' in options) {
        check.param(options.min, minFilters)
        this.minFilter = minFilters[options.min]
      }

      this.magFilter = GL_NEAREST
      if ('mag' in options) {
        check.param(options.mag, magFilters)
        this.magFilter = magFilters(options.mag)
      }

      if (Array.isArray(data)) {

      } else if (isTypedArray(data)) {

      } else if (isHTMLElement(data)) {

      }

      // Set tex image
    },

    refresh: function () {
      gl.textureParameteri(GL_TEXTURE_MIN_FILTER, this.minFilter)
      gl.textureParameteri(GL_TEXTURE_MAG_FILTER, this.magFilter)
      gl.textureParameteri(GL_TEXTURE_WRAP_T, this.wrapT)
      gl.textureParameteri(GL_TEXTURE_WRAP_S, this.wrapS)
    },

    destroy: function () {
      check(this.texture, 'must not double free texture')
      gl.deleteTexture(this.texture)
      this.texture = null
      delete textureSet[this.id]
    }
  })

  function createTexture (options) {
    var texture = new REGLTexture()
    texture.texture = gl.createTexture()
    texture.update(options)
    textureSet[texture.id] = texture

    function updateTexture (options) {
      texture.update(options)
      return updateTexture
    }

    updateTexture._texture = texture
    updateTexture.destroy = function () {
      texture.destroy()
    }

    return updateTexture
  }

  function refreshTextures () {
    Object.keys(textureSet).forEach(function (texId) {
      textureSet[texId].refresh()
    })
  }

  function destroyTextures () {
    Object.keys(textureSet).forEach(function (texId) {
      textureSet[texId].destroy()
    })
  }

  return {
    create: createTexture,
    refresh: refreshTextures,
    destroy: destroyTextures,
    getTexture: function (wrapper) {
      return null
    }
  }
}

},{"./check":4}],25:[function(require,module,exports){
module.exports = function wrapUniformState () {
  var uniformState = {}

  function defUniform (name) {
    if (name in uniformState) {
      return
    }
    uniformState[name] = [ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] ]
  }

  return {
    uniforms: uniformState,
    def: defUniform
  }
}

},{}],26:[function(require,module,exports){
var check = require('./lib/check')
var getContext = require('./lib/context')
var wrapExtensions = require('./lib/extension')
var wrapBuffers = require('./lib/buffer')
var wrapElements = require('./lib/elements')
var wrapTextures = require('./lib/texture')
var wrapFBOs = require('./lib/fbo')
var wrapUniforms = require('./lib/uniform')
var wrapAttributes = require('./lib/attribute')
var wrapShaders = require('./lib/shader')
var wrapDraw = require('./lib/draw')
var wrapContext = require('./lib/state')
var createCompiler = require('./lib/compile')
var wrapRead = require('./lib/read')
var dynamic = require('./lib/dynamic')
var raf = require('./lib/raf')
var clock = require('./lib/clock')

var GL_COLOR_BUFFER_BIT = 16384
var GL_DEPTH_BUFFER_BIT = 256
var GL_STENCIL_BUFFER_BIT = 1024

var GL_ARRAY_BUFFER = 34962

var CONTEXT_LOST_EVENT = 'webglcontextlost'
var CONTEXT_RESTORED_EVENT = 'webglcontextrestored'

module.exports = function wrapREGL () {
  var args = getContext(Array.prototype.slice.call(arguments))
  var gl = args.gl
  var options = args.options

  var extensionState = wrapExtensions(gl, options.requiredExtensions || [])
  var bufferState = wrapBuffers(gl)
  var elementState = wrapElements(gl, extensionState, bufferState)
  var textureState = wrapTextures(gl, extensionState)
  var fboState = wrapFBOs(gl, extensionState, textureState)
  var uniformState = wrapUniforms()
  var attributeState = wrapAttributes(gl, extensionState, bufferState)
  var shaderState = wrapShaders(
    gl,
    extensionState,
    attributeState,
    uniformState,
    function (program) {
      return compiler.draw(program)
    })
  var drawState = wrapDraw(gl, extensionState, bufferState)
  var glState = wrapContext(gl, shaderState)
  var frameState = {
    count: 0,
    start: clock(),
    dt: 0,
    t: clock(),
    renderTime: 0
  }
  var readPixels = wrapRead(gl, glState)

  var compiler = createCompiler(
    gl,
    extensionState,
    bufferState,
    elementState,
    textureState,
    fboState,
    glState,
    uniformState,
    attributeState,
    shaderState,
    drawState,
    frameState)

  var canvas = gl.canvas

  // raf stuff
  var rafCallbacks = []
  var activeRAF = 0
  var prevWidth = 0
  var prevHeight = 0
  function handleRAF () {
    activeRAF = raf.next(handleRAF)
    frameState.count += 1

    if (prevWidth !== gl.drawingBufferWidth ||
        prevHeight !== gl.drawingBufferHeight) {
      prevWidth = gl.drawingBufferWidth
      prevHeight = gl.drawingBufferHeight
      glState.notifyViewportChanged()
    }

    var now = clock()
    frameState.dt = now - frameState.t
    frameState.t = now
    for (var i = 0; i < rafCallbacks.length; ++i) {
      var cb = rafCallbacks[i]
      cb(frameState.count, frameState.t, frameState.dt)
    }
    frameState.renderTime = clock() - now
  }

  function startRAF () {
    if (!activeRAF && rafCallbacks.length > 0) {
      handleRAF()
    }
  }

  function stopRAF () {
    if (activeRAF) {
      raf.cancel(handleRAF)
      activeRAF = 0
    }
  }

  function handleContextLoss (event) {
    stopRAF()
    event.preventDefault()
    if (options.onContextLost) {
      options.onContextLost()
    }
  }

  function handleContextRestored (event) {
    gl.getError()
    extensionState.refresh()
    bufferState.refresh()
    textureState.refresh()
    fboState.refresh()
    shaderState.refresh()
    glState.refresh()
    if (options.onContextRestored) {
      options.onContextRestored()
    }
    handleRAF()
  }

  if (canvas) {
    canvas.addEventListener(CONTEXT_LOST_EVENT, handleContextLoss, false)
    canvas.addEventListener(CONTEXT_RESTORED_EVENT, handleContextRestored, false)
  }

  // Resource destructuion
  function destroy () {
    stopRAF()

    if (canvas) {
      canvas.removeEventListener(CONTEXT_LOST_EVENT, handleContextLoss)
      canvas.removeEventListener(CONTEXT_RESTORED_EVENT, handleContextRestored)
    }

    glState.clear()
    shaderState.clear()
    fboState.clear()
    textureState.clear()
    bufferState.clear()

    if (options.onDestroy) {
      options.onDestroy()
    }
  }

  function create (cache) {
    return function (options) {
      return cache.create(options)
    }
  }

  // Compiles a set of procedures for an object
  function compileProcedure (options) {
    check(!!options, 'invalid args to regl({...})')
    check.type(options, 'object', 'invalid args to regl({...})')

    var hasDynamic = false

    // First we separate the options into static and dynamic components
    function separateDynamic (object) {
      var staticItems = {}
      var dynamicItems = {}
      Object.keys(object).forEach(function (option) {
        var value = object[option]
        if (dynamic.isDynamic(value)) {
          hasDynamic = true
          dynamicItems[option] = dynamic.unbox(value, option)
        } else {
          staticItems[option] = value
        }
      })
      return {
        dynamic: dynamicItems,
        static: staticItems
      }
    }

    var uniforms = separateDynamic(options.uniforms || {})
    var attributes = separateDynamic(options.attributes || {})
    var parts = separateDynamic(options)
    var staticOptions = parts.static
    delete staticOptions.uniforms
    delete staticOptions.attributes

    var compiled = compiler.command(
      staticOptions, uniforms.static, attributes.static,
      parts.dynamic, uniforms.dynamic, attributes.dynamic,
      hasDynamic)

    return Object.assign(compiled.draw, {
      scope: compiled.scope,
      batch: compiled.batch || void 0
    })
  }

  // Clears the currently bound frame buffer
  function clear (options) {
    var clearFlags = 0

    // Update context state
    glState.poll()

    var c = options.color
    if (c) {
      gl.clearColor(+c[0] || 0, +c[1] || 0, +c[2] || 0, +c[3] || 0)
      clearFlags |= GL_COLOR_BUFFER_BIT
    }

    if ('depth' in options) {
      gl.clearDepth(+options.depth)
      clearFlags |= GL_DEPTH_BUFFER_BIT
    }

    if ('stencil' in options) {
      gl.clearStencil(options.stencil | 0)
      clearFlags |= GL_STENCIL_BUFFER_BIT
    }

    check(!!clearFlags, 'called regl.clear with no buffer specified')
    gl.clear(clearFlags)
  }

  // Registers another requestAnimationFrame callback
  function frame (cb) {
    rafCallbacks.push(cb)

    function cancel () {
      var index = rafCallbacks.find(function (item) {
        return item === cb
      })
      if (index < 0) {
        return
      }
      rafCallbacks.splice(index, 1)
      if (rafCallbacks.length <= 0) {
        stopRAF()
      }
    }

    startRAF()

    return {
      cancel: cancel
    }
  }

  return Object.assign(compileProcedure, {
    // Clear current FBO
    clear: clear,
    canvas: canvas,

    // Dynamic variable binding
    prop: dynamic.define,

    // Object constructors
    elements: create(elementState),
    buffer: function (options) {
      return bufferState.create(options, GL_ARRAY_BUFFER)
    },
    texture: create(textureState),
    fbo: create(fboState),

    // Frame rendering
    frame: frame,
    stats: frameState,

    // Read pixels
    read: readPixels,

    // Destroy regl and all associated resources
    destroy: destroy
  })
}

},{"./lib/attribute":2,"./lib/buffer":3,"./lib/check":4,"./lib/clock":5,"./lib/compile":7,"./lib/context":12,"./lib/draw":13,"./lib/dynamic":14,"./lib/elements":15,"./lib/extension":16,"./lib/fbo":17,"./lib/raf":19,"./lib/read":20,"./lib/shader":21,"./lib/state":23,"./lib/texture":24,"./lib/uniform":25}]},{},[1]);
