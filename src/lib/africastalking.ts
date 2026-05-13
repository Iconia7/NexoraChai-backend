/// <reference path="../types/africastalking.d.ts" />
import AfricasTalking from 'africastalking';

const username = process.env.AFRICASTALKING_USERNAME || 'sandbox';
const apiKey = process.env.AFRICASTALKING_API_KEY || '';

const at = AfricasTalking({
    apiKey,
    username
});

const from = process.env.AFRICASTALKING_SENDER_ID || undefined;

export const sendSMS = async (to: string, message: string) => {
    try {
        const result = await at.SMS.send({
            to: [to],
            message,
            from
        });
        console.log('SMS sent successfully:', result);
        return result;
    } catch (error) {
        console.error('Failed to send SMS:', error);
        throw error;
    }
};
