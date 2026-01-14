import axios from 'axios';
import mongoose from 'mongoose';

// --- CONFIG ---
const API_URL = 'http://localhost:5000/api';
// MongoDB URI - Assuming local default or getting from env if possible, 
// but for this script we'll use the one likely used in the backend
// Actually we will mainly test via API to be "black box" like the frontend.

// Colors for console
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

const log = (msg) => console.log(`${cyan}[TEST] ${msg}${reset}`);
const success = (msg) => console.log(`${green}[PASS] ${msg}${reset}`);
const fail = (msg) => console.error(`${red}[FAIL] ${msg}${reset}`);

async function runTest() {
    let userToken = '';
    let adminToken = '';
    let userId = '';
    let chatId = '';

    try {
        log("1. Creating Test User...");
        const userEmail = `testuser_${Date.now()}@example.com`;
        const userPass = 'password123';

        await axios.post(`${API_URL}/auth/signup`, {
            name: 'Test User',
            email: userEmail,
            password: userPass
        });

        const userLogin = await axios.post(`${API_URL}/auth/login`, {
            email: userEmail,
            password: userPass
        });
        userToken = userLogin.data.token;
        // Decode token or get ID from response if available? 
        // Usually login returns { token, user: { id, ... } }
        // Let's assume standard response structure or fetch profile
        if (userLogin.data.user && userLogin.data.user.id) {
            userId = userLogin.data.user.id;
        } else {
            // Fetch profile to be sure
            const profile = await axios.get(`${API_URL}/user/profile`, {
                headers: { Authorization: `Bearer ${userToken}` }
            });
            userId = profile.data._id || profile.data.id;
        }
        success(`User Created & Logged In: ${userEmail} (${userId})`);


        log("2. Creating Test Admin...");
        const adminEmail = `testadmin_${Date.now()}@example.com`;
        // We might need to manually promote this user in DB if we can't signup as admin
        // OR we can try to use an existing admin if we knew credentials.
        // Let's create a user and then try to use the 'verify_admin.js' logic (direct DB access) to promote them
        // Wait, I can't run 'verify_admin.js' logic inside this node script easily without connecting to DB.
        // I will connect to Mongoose to promote this user.

        await axios.post(`${API_URL}/auth/signup`, {
            name: 'Test Admin',
            email: adminEmail,
            password: userPass
        });

        // Connect to DB to promote
        await mongoose.connect('mongodb://127.0.0.1:27017/ai-mall');
        const User = mongoose.connection.collection('users');
        await User.updateOne({ email: adminEmail }, { $set: { role: 'admin' } });
        success("Promoted Test Admin via DB");

        const adminLogin = await axios.post(`${API_URL}/auth/login`, {
            email: adminEmail,
            password: userPass
        });
        adminToken = adminLogin.data.token;
        success(`Admin Logged In: ${adminEmail}`);


        log("3. User: Fetch/Create Chat Session...");
        const chatRes = await axios.get(`${API_URL}/support-chat/my-chat`, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        chatId = chatRes.data._id;
        if (!chatId) throw new Error("No chat ID returned");
        success(`Chat Session Established: ${chatId}`);


        log("4. User: Send Message...");
        const userMsgText = "Hello Admin, this is a test.";
        await axios.post(`${API_URL}/support-chat/${chatId}/message`,
            { text: userMsgText },
            { headers: { Authorization: `Bearer ${userToken}` } }
        );
        success("User message sent");


        log("5. Admin: Check Active Chats...");
        // Delay slightly for polling simulation/latency
        await new Promise(r => setTimeout(r, 1000));

        const adminChatsRes = await axios.get(`${API_URL}/support-chat/admin/active`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const foundChat = adminChatsRes.data.find(c => c._id === chatId);

        if (!foundChat) throw new Error("Chat not found in Admin Active List");
        const lastMsg = foundChat.messages[foundChat.messages.length - 1];
        if (lastMsg.text !== userMsgText) throw new Error("Message content mismatch");
        success("Admin received user message");


        log("6. Admin: Reply to User...");
        const adminReplyText = "Hello User, I hear you loud and clear.";
        await axios.post(`${API_URL}/support-chat/${chatId}/message`,
            { text: adminReplyText },
            { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        success("Admin reply sent");


        log("7. User: Verify Reply...");
        // Delay for polling
        await new Promise(r => setTimeout(r, 1000));

        const userChatCheck = await axios.get(`${API_URL}/support-chat/my-chat`, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        const messages = userChatCheck.data.messages;
        const lastUserMsg = messages[messages.length - 1];

        if (lastUserMsg.text !== adminReplyText) throw new Error("User did not receive admin reply");
        success("User received admin reply");

        console.log("\n---------------------------------------------------");
        console.log(`${green}✅ FULL E2E CHAT FLOW VERIFIED SUCCESSFULLY${reset}`);
        console.log("---------------------------------------------------");

    } catch (error) {
        fail(`Test Failed: ${error.message}`);
        if (error.response) {
            console.error("Response Data:", error.response.data);
            console.error("Response Status:", error.response.status);
        }
    } finally {
        await mongoose.disconnect();
    }
}

runTest();
