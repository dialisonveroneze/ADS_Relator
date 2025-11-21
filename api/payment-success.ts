
// api/payment-success.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import cookie from 'cookie';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { session_id } = req.query;

    if (!session_id || typeof session_id !== 'string') {
        return res.redirect(302, '/');
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        // Modo de Fallback para testes sem chave configurada
        // (Remove isso em produção real para segurança)
        console.warn("Validando pagamento sem chave Stripe (Modo Dev Inseguro)");
        res.setHeader('Set-Cookie', cookie.serialize('subscription_active', 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60 * 24 * 30, // 30 dias
            path: '/',
            sameSite: 'lax',
        }));
        return res.redirect(302, '/');
    }

    try {
        // Recupera a sessão do Stripe para confirmar se foi paga
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status === 'paid') {
            // Pagamento confirmado!
            // Em um app real, aqui você salvaria no banco de dados:
            // db.users.update({ id: userId }, { subscription: 'active', stripeId: session.customer })

            // Como estamos usando Cookies para demonstração:
            res.setHeader('Set-Cookie', cookie.serialize('subscription_active', 'true', {
                httpOnly: true,
                secure: process.env.NODE_ENV !== 'development',
                maxAge: 60 * 60 * 24 * 30, // 30 dias
                path: '/',
                sameSite: 'lax',
            }));
        }

        // Redireciona para o dashboard limpo
        res.redirect(302, '/');

    } catch (error) {
        console.error("Erro ao validar pagamento:", error);
        res.redirect(302, '/?error=payment_validation_failed');
    }
}
