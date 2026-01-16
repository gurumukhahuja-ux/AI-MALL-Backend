import mongoose from 'mongoose';
import SupportChat from './models/SupportChat.js';
import Notification from './models/Notification.js';
import dotenv from 'dotenv';

dotenv.config();

const verifyChat = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_ATLAS_URI);
        console.log("Connected to DB");

        // Find chat with the message "jy"
        const chats = await SupportChat.find({ "messages.text": "jy" });
        console.log(`Found ${chats.length} chats with message "jy"`);

        if (chats.length > 0) {
            console.log("Chat ID:", chats[0]._id);
            console.log("Messages:", JSON.stringify(chats[0].messages.slice(-3), null, 2));

            // Check notifications
            const notifs = await Notification.find({ targetId: chats[0]._id }).sort({ createdAt: -1 });
            console.log("Related Notifications:", notifs.map(n => ({ msg: n.message, role: n.role })));
        } else {
            console.log("No chat found with that message.");
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

verifyChat();
