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
const DashboardMessage = mongoose.model('DashboardMessage', new mongoose.Schema({}, { strict: false }));

async function debug() {
    await mongoose.connect(mongoUri);
    const users = await User.find({});
    users.forEach(u => {
        console.log(`USER: ${u.name} | isVendor: ${u.isVendor} | Role: ${u.role} | ID: ${u._id}`);
    });

    const messages = await DashboardMessage.find({});
    messages.forEach(m => {
        console.log(`MSG: To:${m.recipientId} | Sub:${m.subject} | ID:${m._id}`);
    });
    await mongoose.disconnect();
}
debug();
