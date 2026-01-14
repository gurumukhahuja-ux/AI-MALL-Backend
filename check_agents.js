import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const AgentSchema = new mongoose.Schema({}, { strict: false, collection: 'agents' });
const Agent = mongoose.model('Agent', AgentSchema);

async function verifyAgents() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_ATLAS_URI);
        console.log('Connected.');

        const agents = await Agent.find({});
        console.log(`Found ${agents.length} agents remaining in database.`);

        agents.forEach(a => {
            console.log(`- Name: ${a.agentName}, ID: ${a._id}, Owner: ${a.owner}, Status: ${a.status}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

verifyAgents();
