import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const checkVendors = async () => {
    try {
        const MONGO_URI = process.env.MONGODB_ATLAS_URI || process.env.MONGO_URI;

        if (!MONGO_URI) {
            throw new Error("MONGO_URI is missing in .env");
        }

        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all vendors
        const vendors = await User.find({ isVendor: true })
            .select('name email companyName companyType vendorStatus vendorRegisteredAt');

        console.log(`📊 Total vendors in database: ${vendors.length}\n`);

        if (vendors.length === 0) {
            console.log('❌ No vendor data found in the database!');
            console.log('\nThis means:');
            console.log('  1. The vendor registration form may not be saving data correctly');
            console.log('  2. Or the vendor was registered to a different database');
            console.log('  3. Or the vendor registration was never completed\n');
        } else {
            console.log('Vendor Details:');
            console.log('═'.repeat(80));
            vendors.forEach((vendor, index) => {
                console.log(`\n${index + 1}. ${vendor.name}`);
                console.log(`   Email: ${vendor.email}`);
                console.log(`   Company: ${vendor.companyName || 'N/A'}`);
                console.log(`   Type: ${vendor.companyType || 'N/A'}`);
                console.log(`   Status: ${vendor.vendorStatus || 'N/A'}`);
                console.log(`   Registered: ${vendor.vendorRegisteredAt || 'N/A'}`);
            });
            console.log('\n' + '═'.repeat(80));
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

checkVendors();
