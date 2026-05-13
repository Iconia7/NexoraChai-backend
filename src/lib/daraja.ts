import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DARAJA_CONSUMER_KEY = process.env.DARAJA_CONSUMER_KEY;
const DARAJA_CONSUMER_SECRET = process.env.DARAJA_CONSUMER_SECRET;
const DARAJA_BUSINESS_SHORTCODE = process.env.DARAJA_BUSINESS_SHORTCODE || '174379';
const DARAJA_PASS_KEY = process.env.DARAJA_PASS_KEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'nexora_secure_webhook_2026';
const DARAJA_CALLBACK_URL = `${process.env.DARAJA_CALLBACK_URL}?token=${WEBHOOK_SECRET}`;

// B2C Specifics
const DARAJA_INITIATOR_NAME = process.env.DARAJA_INITIATOR_NAME;
const DARAJA_SECURITY_CREDENTIAL = process.env.DARAJA_SECURITY_CREDENTIAL;
const DARAJA_B2C_RESULT_URL = `${process.env.DARAJA_B2C_RESULT_URL || `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/webhooks/daraja/b2c-result`}?token=${WEBHOOK_SECRET}`;
const DARAJA_B2C_TIMEOUT_URL = `${process.env.DARAJA_B2C_TIMEOUT_URL || `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/webhooks/daraja/b2c-timeout`}?token=${WEBHOOK_SECRET}`;

const isSandbox = false;
const BASE_URL = isSandbox ? 'https://sandbox.safaricom.co.ke' : 'https://api.safaricom.co.ke';

export const getAccessToken = async () => {
    const auth = Buffer.from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`).toString('base64');
    try {
        const response = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
            headers: { Authorization: `Basic ${auth}` }
        });
        return response.data.access_token;
    } catch (error: any) {
        console.error('Daraja Auth Error:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with Daraja');
    }
};

export const initiateSTKPush = async (data: {
    phoneNumber: string;
    amount: number;
    accountReference: string;
    transactionDesc: string;
}) => {
    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${DARAJA_BUSINESS_SHORTCODE}${DARAJA_PASS_KEY}${timestamp}`).toString('base64');

    let phone = data.phoneNumber.replace('+', '').replace(/\s/g, '');
    if (phone.startsWith('0')) {
        phone = '254' + phone.slice(1);
    } else if (phone.startsWith('7') || phone.startsWith('1')) {
        phone = '254' + phone;
    }

    try {
        const response = await axios.post(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
            BusinessShortCode: DARAJA_BUSINESS_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.round(data.amount),
            PartyA: phone,
            PartyB: DARAJA_BUSINESS_SHORTCODE,
            PhoneNumber: phone,
            CallBackURL: DARAJA_CALLBACK_URL,
            AccountReference: data.accountReference,
            TransactionDesc: data.transactionDesc
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return response.data;
    } catch (error: any) {
        console.error('Daraja STK Push Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.errorMessage || 'Failed to initiate STK Push');
    }
};

export const initiateB2CPayment = async (data: {
    phoneNumber: string;
    amount: number;
    remarks: string;
    occasion: string;
}) => {
    const token = await getAccessToken();

    let phone = data.phoneNumber.replace('+', '').replace(/\s/g, '');
    if (phone.startsWith('0')) {
        phone = '254' + phone.slice(1);
    } else if (phone.startsWith('7') || phone.startsWith('1')) {
        phone = '254' + phone;
    }

    try {
        const response = await axios.post(`${BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
            InitiatorName: DARAJA_INITIATOR_NAME,
            SecurityCredential: DARAJA_SECURITY_CREDENTIAL,
            CommandID: "BusinessPayment",
            Amount: Math.round(data.amount),
            PartyA: DARAJA_BUSINESS_SHORTCODE,
            PartyB: phone,
            Remarks: data.remarks,
            QueueTimeOutURL: DARAJA_B2C_TIMEOUT_URL,
            ResultURL: DARAJA_B2C_RESULT_URL,
            Occasion: data.occasion
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        return response.data;
    } catch (error: any) {
        console.error('Daraja B2C Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.errorMessage || 'Failed to initiate B2C payout');
    }
};
