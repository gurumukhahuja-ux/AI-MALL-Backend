import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const makeUserAdmin = async () => {
    try {
        const MONGO_URI = process.env.MONGODB_ATLAS_URI || process.env.MONGO_URI;

        if (!MONGO_URI) {
            throw new Error("MONGO_URI is missing in .env");
        }

        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Update the user to admin role
        const email = 'sanskarsahu1511@gmail.com'; // Change this to your email

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            console.log(`❌ User with email ${email} not found`);
            console.log('\nTrying to find user by partial match...');
            const users = await User.find({}).select('name email role');
            console.log('\nAll users in database:');
            users.forEach(u => console.log(`  - ${u.email} (${u.name}) - Role: ${u.role}`));
            process.exit(1);
        }

        console.log(`\nFound user: ${user.name} (${user.email})`);
        console.log(`Current role: ${user.role}`);

        user.role = 'admin';
        await user.save();

        console.log(`✅ Successfully updated ${user.email} to admin role!`);
        console.log('\nYou can now access the admin dashboard and view vendor requests.');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

makeUserAdmin();
