import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.resolve('.env');
let mongoUri = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/MONGODB_ATLAS_URI=(.*)/);
    if (match) {
        mongoUri = match[1].trim().replace(/^["'](.*)["']$/, '$1');
    }
} catch (e) {
    console.log("Error reading env:", e.message);
}

if (!mongoUri) mongoUri = "mongodb://localhost:27017/ai-mall";

const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
const DashboardMessage = mongoose.model('DashboardMessage', new mongoose.Schema({}, { strict: false }));

async function debug() {
    console.log("Connecting to:", mongoUri.substring(0, 30));
    await mongoose.connect(mongoUri);
    console.log("Connected.");

    const users = await User.find({});
    console.log(`Total Users: ${users.length}`);
    users.forEach(u => {
        if (u.isVendor || u.role === 'admin') {
            console.log(`- ${u.name} | Role: ${u.role} | VendorStatus: ${u.vendorStatus} | ID: ${u._id}`);
        }
    });

    const messages = await DashboardMessage.find({});
    console.log(`Total Messages: ${messages.length}`);
    messages.forEach(m => {
        console.log(`- From: ${m.senderType}(${m.senderId}) | To: ${m.recipientType}(${m.recipientId}) | Subject: ${m.subject}`);
    });

    await mongoose.disconnect();
}

debug();
