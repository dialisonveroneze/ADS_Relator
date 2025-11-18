
import { UserSubscription } from '../types';

const handleApiResponse = async (response: Response) => {
    if (response.ok) {
        return response.json();
    }
    const errorData = await response.json().catch(() => ({ message: 'Erro na verificação de assinatura.' }));
    throw new Error(errorData.message || `Erro ${response.status}`);
};

export const getSubscriptionStatus = async (): Promise<UserSubscription> => {
    const response = await fetch('/api/subscription');
    return handleApiResponse(response);
};

export const performCheckout = async (method: 'credit_card' | 'pix', details: any): Promise<void> => {
    // In a real app, you would send 'details' to your backend to create a Stripe Session or Pix Code
    const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, details })
    });
    return handleApiResponse(response);
};
