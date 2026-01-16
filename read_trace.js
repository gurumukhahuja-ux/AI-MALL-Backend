import fs from 'fs';
const data = fs.readFileSync('trace_out.txt', 'utf16le');
console.log(data);
