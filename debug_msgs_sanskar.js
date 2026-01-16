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

const DashboardMessage = mongoose.model('DashboardMessage', new mongoose.Schema({}, { strict: false }));

async function debug() {
    await mongoose.connect(mongoUri);
    const targetId = '6964e021e404b3f5810f08cb';
    const msgs = await DashboardMessage.find({
        $or: [
            { senderId: targetId },
            { recipientId: targetId }
        ]
    });
    console.log(`Found ${msgs.length} messages for ID ${targetId}`);
    msgs.forEach(m => {
        console.log(`- From: ${m.senderId}(${m.senderType}) | To: ${m.recipientId}(${m.recipientType}) | Sub: ${m.subject}`);
    });
    await mongoose.disconnect();
}
debug();
