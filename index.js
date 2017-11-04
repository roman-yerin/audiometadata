const id3v1 = require('./id3v1')
const id3v23 = require('./id3v23')
const fs = require('fs')

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
    var metadata = {}
    Object.assign(metadata, metadata_template)
    try {
        var fileHandle = fs.openSync(filename, 'r')
    }
    catch(e){
        
    }
    if (/\.mp3$/.test(filename) && fileHandle) {
        var found = id3v23(fileHandle, metadata)
        console.log(metadata)
    }
}

module.exports = metadataReader