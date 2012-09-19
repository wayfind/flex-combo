module.exports = function(bufferStore) {
    var length = bufferStore.reduce(function(previous, current) {
        return previous + current.length;
    }, 0);

    var data = new Buffer(length);
    var startPos = 0;
    bufferStore.forEach(function(buffer){
        buffer.copy(data, startPos);
        startPos += buffer.length;
    });
    return data;
};