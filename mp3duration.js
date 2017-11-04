var fs = require('fs')

var versions = ['2.5', 'x', '2', '1']
  , layers = ['x', '3', '2', '1']
  , bitRates = {
    'V1Lx' : [0, 0, 0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    'V1L1' : [0,32,64,96,128,160,192,224,256,288,320,352,384,416,448],
    'V1L2' : [0,32,48,56, 64, 80, 96,112,128,160,192,224,256,320,384],
    'V1L3' : [0,32,40,48, 56, 64, 80, 96,112,128,160,192,224,256,320],
    'V2Lx' : [0, 0, 0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    'V2L1' : [0,32,48,56, 64, 80, 96,112,128,144,160,176,192,224,256],
    'V2L2' : [0, 8,16,24, 32, 40, 48, 56, 64, 80, 96,112,128,144,160],
    'V2L3' : [0, 8,16,24, 32, 40, 48, 56, 64, 80, 96,112,128,144,160],
    'VxLx' : [0, 0, 0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    'VxL1' : [0, 0, 0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    'VxL2' : [0, 0, 0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0],
    'VxL3' : [0, 0, 0, 0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0]
  }
  , sampleRates = {
    'x':   [    0,     0,     0],
    '1':   [44100, 48000, 32000],
    '2':   [22050, 24000, 16000],
    '2.5': [11025, 12000,  8000]
  }
  , samples = {
    x: {
      x: 0,
      1: 0,
      2: 0,
      3: 0
    },
    1: { //MPEGv1,     Layers 1,2,3
      x: 0,
      1: 384,
      2: 1152,
      3: 1152
    },
    2: { //MPEGv2/2.5, Layers 1,2,3
      x: 0,
      1: 384,
      2: 1152,
      3: 576
    }
  }

function frameSize(samples, layer, bitRate, sampleRate, paddingBit) {
  if (layer === 1) {
    return (((samples * bitRate * 125 / sampleRate) + paddingBit * 4)) | 0
  } else { //layer 2, 3
    return (((samples * bitRate * 125) / sampleRate) + paddingBit) | 0
  }
}

function parseFrameHeader(header) {
  var b1
    , b2
    , versionBits
    , version
    , simpleVersion
    , layerBits
    , layer
    , bitRateKey
    , bitRateIndex
    , bitRate
    , sampleRateIdx
    , sampleRate
    , paddingBit
    , sample

  b1 = header[1]
  b2 = header[2]

  versionBits = (b1 & 0x18) >> 3
  version = versions[versionBits]
  simpleVersion = (version === '2.5' ? 2 : version)

  layerBits = (b1 & 0x06) >> 1
  layer = layers[layerBits]

  bitRateKey = 'V' + simpleVersion + 'L' + layer
  bitRateIndex = (b2 & 0xf0) >> 4
  bitRate = bitRates[bitRateKey][bitRateIndex] || 0

  sampleRateIdx = (b2 & 0x0c) >> 2
  sampleRate = sampleRates[version][sampleRateIdx] || 0

  sample = samples[simpleVersion][layer]

  paddingBit = (b2 & 0x02) >> 1
  return {
    bitRate: bitRate,
    sampleRate: sampleRate,
    frameSize: frameSize(sample, layer, bitRate, sampleRate, paddingBit),
    samples: sample
  }
}

function estimateDuration(bitRate, offset, fileSize) {
  var kbps = (bitRate * 1000) / 8
    , dataSize = fileSize - offset

  return round(dataSize / kbps)
}

function round(duration) {
  return Math.round(duration * 1000) / 1000 //round to nearest ms
}

function mp3Duration(fd, offset, cbrEstimate, callback) {
  if (typeof cbrEstimate === 'function') {
    callback = cbrEstimate
    cbrEstimate = false
  }
    var duration = 0
      , buffer
      , bytesRead
      , stat
      , info

      stat = fs.fstatSync(fd)

      buffer = new Buffer(100)

      while (offset < stat.size) {

        bytesRead = fs.readSync(fd, buffer, 0, 10, offset)
        if (bytesRead < 10) return callback(round(duration))

        //Looking for 1111 1111 111 (frame synchronization bits)
        if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
          info = parseFrameHeader(buffer)
          if (info.frameSize && info.samples) {
            offset += info.frameSize
            duration += ( info.samples / info.sampleRate )
          } else {
            offset++ //Corrupt file?
          }
        } else if (buffer[0] === 0x54 && buffer[1] === 0x41 && buffer[2] === 0x47) {//'TAG'
          offset += 128 //Skip over id3v1 tag size
        } else {
          offset++ //Corrupt file?
        }

        if (cbrEstimate && info) {
          return callback(round(estimateDuration(info.bitRate, offset, stat.size)))
        }
      }

  callback(round(duration))
}

module.exports = mp3Duration
