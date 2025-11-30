// const binding = require("./build/Release/binding.node");
// const binding = require("./build/Release/JSClang.node");

// const input = [0, 2.3, 3];
// const result = binding.multiplyByTwo(input);

// console.log("Input:", input);
// console.log("Result:", result);

const addon = require("./build/Release/JSClang.node");

// Load the model first
addon.loadModel("policy.pt");

//array of 54 zeros
const input = Array(54).fill(0);
const output = addon.runModel(input);
console.log("Output:", output);
