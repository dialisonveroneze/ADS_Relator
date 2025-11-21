
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

// A função performCheckout foi removida pois a lógica agora é direta via Link do Stripe gerado no backend.
