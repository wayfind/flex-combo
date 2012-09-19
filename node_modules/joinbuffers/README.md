#joinBuffers [![Build Status](https://secure.travis-ci.org/Bonuspunkt/joinbuffers.png)](http://travis-ci.org/Bonuspunkt/joinbuffers)
takes an array of small buffers and copies them into a single big one

##installation
    npm install joinbuffers

## example

    var joinBuffers = require('joinbuffers')
    var smallBuffers = [new Buffer('1'), new Buffer('2')];
    var bigBuffer = joinBuffers(smallBuffers);
    console.log(bigBuffer.toString('utf8')); // prints 12

## license
public domain