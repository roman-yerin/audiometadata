const id3v1 = require('./id3v1')
const id3v23 = require('./id3v23')
const fs = require('fs')
const mp3duration = require('./mp3duration')

var metadata_template = {
    title: '',
    artist: [],
    albumartist: [],
    album: '',
    year: '',
    track: { no: 0, of: 0 },
    genre: [],
    disk: { no: 0, of: 0 },
    picture: [],
    duration: 0
}

function metadataReader(filename) {
    return new Promise(function (resolve, reject) {
        var metadata = {}
        metadata = JSON.parse(JSON.stringify(metadata_template))
        try {
            var fileHandle = fs.openSync(filename, 'r')
        }
        catch(e){
            reject(e)
        }
        if (/\.mp3$/.test(filename) && fileHandle) {
            var found = id3v23(fileHandle, metadata)
            if (found) { 
                mp3duration(fileHandle, found).then(function (duration) {
                    metadata.duration = duration
                    fs.closeSync(fileHandle)
                    resolve(metadata)
                })
            } else {
                fs.closeSync(fileHandle)
            }
        }
    })
}

module.exports = metadataReader