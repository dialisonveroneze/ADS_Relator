
// api/payment-success.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import cookie from 'cookie';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { session_id } = req.query;

    // Função auxiliar para ativar a assinatura via cookie
    const activateSubscription = () => {
        res.setHeader('Set-Cookie', cookie.serialize('subscription_active', 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60 * 24 * 30, // 30 dias
            path: '/',
            sameSite: 'lax',
        }));
    };

    if (!session_id || typeof session_id !== 'string') {
        return res.redirect(302, '/');
    }

    // 1. Verifica se é uma sessão simulada (Mock)
    if (session_id === 'mock_session_id_dev') {
        activateSubscription();
        return res.redirect(302, '/');
    }

    // 2. Verifica pagamento real no Stripe
    if (process.env.STRIPE_SECRET_KEY) {
        try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
                apiVersion: '2023-10-16',
            });

            const session = await stripe.checkout.sessions.retrieve(session_id);

            if (session.payment_status === 'paid') {
                activateSubscription();
            }
            
            return res.redirect(302, '/');

        } catch (error) {
            console.error("Erro ao validar pagamento:", error);
            return res.redirect(302, '/?error=payment_validation_failed');
        }
    } else {
        // Se chegou aqui com um ID real mas sem chave configurada, libera por segurança (fallback dev)
        activateSubscription();
        return res.redirect(302, '/');
    }
}
