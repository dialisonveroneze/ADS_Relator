
// api/create-checkout.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

// Inicializa o Stripe. IMPORTANTE: Adicione STRIPE_SECRET_KEY no seu .env
// Se não tiver a chave, o código vai falhar graciosamente.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16', // Use a versão mais recente disponível
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        console.error("Stripe Secret Key is missing");
        return res.status(500).json({ message: 'Erro de configuração de pagamento (Chave ausente).' });
    }

    try {
        // Determina a URL base para retorno (localhost ou produção)
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const origin = `${protocol}://${host}`;

        // Cria a sessão de checkout
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'], // Adicione 'boleto' ou outros se configurado no Stripe Dashboard
            line_items: [
                {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: 'Assinatura ADS Relator Pro',
                            description: 'Acesso ilimitado ao dashboard e relatórios avançados.',
                        },
                        unit_amount: 1990, // R$ 19,90 (em centavos)
                        recurring: {
                            interval: 'month',
                        },
                    },
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${origin}/api/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/`,
        });

        return res.status(200).json({ url: session.url });

    } catch (error: any) {
        console.error("Stripe Error:", error);
        return res.status(500).json({ message: error.message || 'Erro ao criar sessão de pagamento.' });
    }
}
