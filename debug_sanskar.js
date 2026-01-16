import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
let mongoUri = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/MONGODB_ATLAS_URI=(.*)/);
    if (match) {
        mongoUri = match[1].trim().replace(/^["'](.*)["']$/, '$1');
    }
} catch (e) { }

if (!mongoUri) mongoUri = "mongodb://localhost:27017/ai-mall";

const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

async function debug() {
    await mongoose.connect(mongoUri);
    const u = await User.findOne({ name: /sanskar/i });
    if (u) {
        console.log(`FOUND: ${u.name}`);
        console.log(`Status: ${u.vendorStatus}`);
        console.log(`isVendor: ${u.isVendor}`);
        console.log(`ID: ${u._id}`);
        console.log(`Role: ${u.role}`);
    } else {
        console.log("Sanskar not found");
    }
    await mongoose.disconnect();
}
debug();
