const fs = require('fs')

module.exports = function (fh, meta) {
	var buffer = Buffer.alloc(128)
	fs.readSync(fh, buffer, 0, 128, -128)
	console.log(buffer.toString())
}