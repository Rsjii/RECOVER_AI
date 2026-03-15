const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../.testdata.json');

function loadContext() {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error('Missing test/.testdata.json. Run: node -r dotenv/config test/seed.js');
  }

  const td = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const portArg = process.argv.find((arg, idx) => process.argv[idx - 1] === '--port');
  const port = parseInt(portArg || td.port || '3000', 10);

  return { td, port, dataFile: DATA_FILE };
}

function saveContext(td, dataFile = DATA_FILE) {
  fs.writeFileSync(dataFile, JSON.stringify(td, null, 2));
}

function readCases(fileName) {
  const filePath = path.join(__dirname, `../data/${fileName}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

module.exports = { loadContext, saveContext, readCases };

