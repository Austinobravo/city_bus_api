
import axios from 'axios';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export const initializePayment = async (email: string, amount: number, reference: string, callbackUrl: string, metadata?: any) => {
    try {
        const response = await axios.post(
            `${PAYSTACK_BASE_URL}/transaction/initialize`,
            {
                email,
                amount: Math.round(amount * 100), // Convert to kobo
                reference,
                callback_url: callbackUrl,
                metadata
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return { success: true, data: response.data.data };
    } catch (error: any) {
        console.error("Paystack Initialize Error:", error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
};

export const verifyPayment = async (reference: string) => {
    try {
        const response = await axios.get(
            `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
                }
            }
        );
        return { success: true, data: response.data.data };
    } catch (error: any) {
        console.error("Paystack Verify Error:", error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
};
