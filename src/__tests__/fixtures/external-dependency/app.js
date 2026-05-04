// External dependency example
// This imports from npm packages (express, lodash)

const express = require('express');
const { map, filter } = require('lodash');
const axios = require('axios');

const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

module.exports = app;
