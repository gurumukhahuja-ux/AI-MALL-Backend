import fs from 'fs';
const data = fs.readFileSync('debug_out_v3.txt', 'utf16le');
const targetId = '6964e021e404b3f5810f08cb';
data.split('\n').forEach(line => {
    if (line.includes(targetId)) {
        console.log(line);
    }
});
