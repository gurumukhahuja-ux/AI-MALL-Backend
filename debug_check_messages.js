import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
let mongoUri = '';

try {
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/MONGODB_ATLAS_URI=(.*)/);
        if (match) {
            mongoUri = match[1].trim().replace(/^["'](.*)["']$/, '$1');
        }
    }
} catch (e) {
    console.log("Error reading .env:", e);
}

if (!mongoUri) mongoUri = "mongodb://localhost:27017/ai-mall";

const messageSchema = new mongoose.Schema({
    senderType: String,
    recipientType: String,
    recipientId: String, // We changed this to String
    subject: String,
    message: String,
}, { strict: false });

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    isVendor: Boolean
}, { strict: false });

const DashboardMessage = mongoose.model('DashboardMessage', messageSchema);
const User = mongoose.model('User', userSchema);

console.log("Connecting...");
await mongoose.connect(mongoUri);
console.log("Connected.");

console.log(`\n--- SEARCHING FOR "sanskar" ---`);
const sanskar = await User.findOne({ name: { $regex: /sanskar/i } });
if (sanskar) {
    console.log(`User Found: ${sanskar.name}`);
    console.log(`   ID: ${sanskar._id.toString()}`);
} else {
    console.log("User 'sanskar' not found.");
}

console.log("\n--- ALL VENDORS COMPACT ---");
const vendors = await User.find({ isVendor: true }).select('name _id');
vendors.forEach(v => console.log(`${v.name}: ${v._id}`));

console.log("\n--- MESSAGES ---");
const messages = await DashboardMessage.find({}).sort({ createdAt: -1 });
if (messages.length === 0) console.log("No messages found.");
messages.forEach(m => {
    console.log(`Msg: "${m.subject}"`);
    console.log(`   Recipient: ${m.recipientId}`);
});

await mongoose.disconnect();
