const fs = require('fs');
const readline = require('readline');

exports.manage = {
    read : function(filename, callback) {
        const lineReader = readline.createInterface({
            input: fs.createReadStream(filename)
        });
        const data = [];
        lineReader.on('error', function (err) {
            callback(err);
        });
        lineReader.on('line', function (line) {
            data.push(line);
        });
        lineReader.on('close', function() {
            callback(null, data);
        });
    },

    fileExist: function(filename, callback) {
        try {
            fs.statSync(filename).isFile();
            callback(true);
        } catch (err) {
            callback(false);
        }
    },
};
