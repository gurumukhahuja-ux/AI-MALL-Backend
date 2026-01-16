import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Load env
const envPath = path.resolve('AI-MALL-Backend', '.env');
let mongoUri = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/MONGODB_ATLAS_URI=(.*)/);
    if (match) {
        mongoUri = match[1].trim().replace(/^["'](.*)["']$/, '$1');
    }
} catch (e) { }

if (!mongoUri) mongoUri = "mongodb://localhost:27017/ai-mall";

const messageSchema = new mongoose.Schema({}, { strict: false });
const DashboardMessage = mongoose.model('DashboardMessage', messageSchema, 'dashboardmessages');

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

async function debug() {
    await mongoose.connect(mongoUri);
    console.log("Connected to DB");

    const users = await User.find({ role: { $in: ['vendor', 'admin'] } });
    console.log("--- USERS ---");
    users.forEach(u => {
        console.log(`ID: ${u._id} | Name: ${u.name} | Role: ${u.role} | Email: ${u.email}`);
    });

    const messages = await DashboardMessage.find({});
    console.log("\n--- MESSAGES ---");
    messages.forEach(m => {
        console.log(`ID: ${m._id} | From: ${m.senderId} (${m.senderType}) | To: ${m.recipientId} (${m.recipientType}) | Subject: ${m.subject}`);
    });

    await mongoose.disconnect();
}

debug();
