import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://gurumukhahuja3_db_user:I264cAAGxgT9YcQR@cluster0.selr4is.mongodb.net/AI_MALL';

async function run() {
    try {
        await mongoose.connect(MONGO_URI);
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const result = await mongoose.connection.db.collection('users').updateOne(
            { email: 'test_admin@example.com' },
            {
                $set: {
                    name: 'Test Admin',
                    password: hashedPassword,
                    role: 'admin',
                    isVendor: false,
                    isVerified: true,
                    updatedAt: new Date()
                },
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
        );
        console.log('Admin user created/updated:', result);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
