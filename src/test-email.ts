import dotenv from 'dotenv';
import path from 'path';

// Load env from parent dir
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { verifyTransporter } from './lib/emailService';

async function test() {
    console.log('Testing SMTP connection...');
    console.log('ZOHO_USER:', process.env.ZOHO_USER);
    const success = await verifyTransporter();
    if (success) {
        console.log('✅ SMTP connection successful!');
    } else {
        console.log('❌ SMTP connection failed. Check your credentials and ZOHO_HOST.');
    }
}

test();
