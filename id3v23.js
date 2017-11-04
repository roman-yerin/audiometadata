const fs = require('fs')
const encDetect = require('encdetect')
const iconv = require('iconv-lite')

var enc = { confidence: 0, encoding: 'UTF16-LE', isUnicode: true }

const handlers = {
	'TALB': function (meta, data) {
		var copy = Buffer.from(data.slice(1))
		var charset = encDetect(copy)
		enc.isUnicode = data.readUInt8(0)
		if (charset.confidence > enc.confidence && charset.encoding != 'ascii' && charset.confidence > 0.2) Object.assign(enc, charset)
		meta.album = copy
	},
	'TIT2': function (meta, data) {
		var copy = Buffer.from(data.slice(1))
		var charset = encDetect(copy)
		enc.isUnicode = data.readUInt8(0)
		if (charset.confidence > enc.confidence && charset.encoding != 'ascii' && charset.confidence > 0.2) Object.assign(enc, charset)
		meta.title = copy
	},
	'TYER': function (meta, data) {
		var copy = Buffer.from(data.slice(1))
		meta.year = copy.toString()
	},
	'TLEN': function (meta, data) {
		var copy = Buffer.from(data.slice(1))
		meta.duration = copy.toString()
	},
	'TPE1': function (meta, data) {
		var copy = Buffer.from(data.slice(1))
		var charset = encDetect(copy)
		enc.isUnicode = data.readUInt8(0)
		if (charset.confidence > enc.confidence && charset.encoding != 'ascii' && charset.confidence > 0.2) Object.assign(enc, charset)
		meta.artist.push(copy)
	}
}

function recode(obj, enc) {
	for(var i in obj) {
		if (typeof obj[i] === 'object') recode(obj[i], enc)
		if (Buffer.isBuffer(obj[i]) && !obj[i + '_prevent']) obj[i] = iconv.decode(obj[i], enc)
	}
}

module.exports = function (fh, meta) {
	enc = { confidence: 0, encoding: 'UTF16-LE', isUnicode: true }
	var buffer = Buffer.allocUnsafe(10)
	fs.readSync(fh, buffer, 0, 10, 0)
	if (!buffer.includes('ID3')) return false
	if (!buffer.includes(parseInt('0x0300'),3)) return false
	var flags = buffer.readUInt8(5)
	var s4 = buffer.readUInt8(6)
	var s3 = buffer.readUInt8(7)
	var s2 = buffer.readUInt8(8)
	var s1 = buffer.readUInt8(9)
	var size = s4<<21 | s3<<14 | s2<<7 | s1
	buffer = null
	buffer = Buffer.allocUnsafe(size)
	fs.readSync(fh, buffer, 0, size, 10)
	var offset = 0
	if (flags & 0b01000000){
		// Extended header
		offset = offset + 10
	}
	while (offset+10 < size) {
		// reading frames till the end
		var frame_name = buffer.slice(offset, offset+4).toString()
		if (!frame_name) { offset = offset + 10; continue; }
		var s4 = buffer.readUInt8(offset + 4)
		var s3 = buffer.readUInt8(offset + 5)
		var s2 = buffer.readUInt8(offset + 6)
		var s1 = buffer.readUInt8(offset + 7)
		var frame_size = s4<<21 | s3<<14 | s2<<7 | s1
		var frame_flags = buffer.readUInt16LE(offset + 8)
		var frame_data = Buffer.from(buffer.slice(offset + 10, offset + 10 + frame_size))
		offset = offset + frame_size + 10
		if (handlers[frame_name]) handlers[frame_name](meta, frame_data)
	}
	if (enc.encoding.match(/UTF/) && !enc.isUnicode) enc.encoding = 'ascii'
	if (!enc.encoding.match(/UTF/) && enc.isUnicode) enc.encoding = 'utf16-le'
	recode(meta, enc.encoding)
	return size + 10
}
