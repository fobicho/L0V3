const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'cartas.json');

function load() {
  if (!fs.existsSync(DB_PATH)) return { letters: [], history: [] };
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { load, save, DB_PATH };
