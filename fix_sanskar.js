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
const DashboardMessage = mongoose.model('DashboardMessage', new mongoose.Schema({
    recipientId: String
}, { strict: false }));

async function run() {
    await mongoose.connect(mongoUri);
    console.log("Connected.");

    const sanskarId = '6964e021e404b3f5810f08cb';
    const devanshId = '6964d3a6f6314dcd49e200f1';

    // 1. Promote Sanskar
    const sanskar = await User.findById(sanskarId);
    if (sanskar) {
        console.log("Promoting Sanskar...");
        sanskar.role = 'vendor';
        sanskar.isVendor = true;
        sanskar.vendorStatus = 'approved';
        await sanskar.save();
        console.log("Sanskar is now an Approved Vendor.");
    }

    // 2. Move messages from Devansh to Sanskar (if they were intended for Sanskar)
    const result = await DashboardMessage.updateMany(
        { recipientId: devanshId },
        { recipientId: sanskarId }
    );
    console.log(`Moved ${result.modifiedCount} messages from Devansh to Sanskar.`);

    await mongoose.disconnect();
}
run();
