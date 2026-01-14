import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ai-mall";

async function promote() {
    try {
        await mongoose.connect(MONGO_URI);
        const email = "abhajatav18@gmail.com";
        const res = await User.updateOne({ email }, { $set: { role: 'admin' } });
        console.log(`Promoted ${email}:`, res);
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
promote();
