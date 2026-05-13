import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

export const createSubaccount = async (data: {
  business_name: string;
  bank_code: string;
  account_number: string;
  percentage_charge: number;
}) => {
  try {
    const response = await paystack.post('/subaccount', data);
    return response.data;
  } catch (error: any) {
    console.error('Paystack Create Subaccount Error:', error.response?.data || error.message);
    throw error;
  }
};

export const listBanks = async (country: string = 'kenya') => {
  try {
    const response = await paystack.get(`/bank?country=${country}`);
    return response.data;
  } catch (error: any) {
    console.error('Paystack List Banks Error:', error.response?.data || error.message);
    throw error;
  }
};

export const initializeTransaction = async (data: {
  email: string;
  amount: number;
  currency?: string;
  reference?: string;
  subaccount?: string;
  bearer?: 'subaccount' | 'account' | 'all';
  callback_url?: string;
  metadata?: any;
}) => {
  try {
    const response = await paystack.post('/transaction/initialize', data);
    return response.data;
  } catch (error: any) {
    console.error('Paystack Initialize Transaction Error:', error.response?.data || error.message);
    throw error;
  }
};

export const verifyTransaction = async (reference: string) => {
  try {
    const response = await paystack.get(`/transaction/verify/${reference}`);
    return response.data;
  } catch (error: any) {
    console.error('Paystack Verify Transaction Error:', error.response?.data || error.message);
    throw error;
  }
};

export default paystack;
