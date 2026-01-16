import fs from 'fs';
const data = fs.readFileSync('users_full.txt', 'utf16le');
console.log(data);
