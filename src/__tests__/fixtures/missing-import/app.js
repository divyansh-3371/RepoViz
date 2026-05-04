// This file imports from a path that doesn't exist
// Should be handled gracefully without crashing

const { nonExistent } = require('./path/that/does/not/exist');
const express = require('express');

function main() {
  console.log('App running');
}
