import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// MANUAL .env reading because 'dotenv' module might not be globally installed or behaving oddly in this context
// and I want to avoid ERR_MODULE_NOT_FOUND issues with imports if possible.

const envPath = path.resolve('.env');
let mongoUri = '';

try {
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/MONGODB_ATLAS_URI=(.*)/);
        if (match) {
            mongoUri = match[1].trim();
            mongoUri = mongoUri.replace(/^["'](.*)["']$/, '$1'); // strip quotes
        }
    }
} catch (e) {
    console.log("Error reading .env:", e);
}

// Fallback if local
if (!mongoUri) {
    console.log("Warning: No URI found, trying generic local...");
    mongoUri = "mongodb://localhost:27017/ai-mall";
}

// Inline schema
const userSchema = new mongoose.Schema({
    isVendor: Boolean,
    vendorStatus: String,
    name: String,
    email: String
}, { strict: false }); // Strict false to read whatever is there

const User = mongoose.model('User', userSchema);

console.log("Connecting...");
await mongoose.connect(mongoUri);
console.log("Connected.");

try {
    const vendors = await User.find({ isVendor: true });
    console.log(`Total Vendors Found: ${vendors.length}`);

    const pending = vendors.filter(v => v.vendorStatus === 'pending').length;
    const approved = vendors.filter(v => v.vendorStatus === 'approved').length;
    const rejected = vendors.filter(v => v.vendorStatus === 'rejected').length;
    const other = vendors.length - pending - approved - rejected;

    console.log(`Pending: ${pending}`);
    console.log(`Approved: ${approved}`);
    console.log(`Rejected: ${rejected}`);
    console.log(`Other/Undefined: ${other}`);

    vendors.forEach(v => {
        console.log(`- ${v.name} (${v._id}): ${v.vendorStatus}`);
    });

    console.log("--- Checking for Admins ---");
    const admins = await User.find({ role: 'admin' });
    console.log(`Found ${admins.length} admins.`);
    admins.forEach(a => {
        console.log(`Admin: ${a.email} (${a._id})`);
    });

} catch (e) {
    console.error(e);
}

await mongoose.disconnect();
