var assert = require('assert');
var joinBuffers = require('./index');

var buffer1 = new Buffer('a');
var buffer2 = new Buffer('b');
var buffer3 = new Buffer('c');

var test1 = joinBuffers([
    buffer1,
    buffer2,
    buffer3
]);


assert.equal(test1[0], buffer1[0]);
assert.equal(test1[1], buffer2[0]);
assert.equal(test1[2], buffer3[0]);
assert.equal(test1.length, 3);