
// api/create-checkout.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const origin = `${protocol}://${host}`;

    // MODO SIMULAÇÃO (FALLBACK)
    // Se não houver chave do Stripe configurada, simula o fluxo para não quebrar a aplicação.
    if (!process.env.STRIPE_SECRET_KEY) {
        console.warn("Stripe Key ausente. Usando modo de simulação.");
        
        // Retorna uma URL que vai direto para o sucesso, simulando o pagamento
        return res.status(200).json({ 
            url: `${origin}/api/payment-success?session_id=mock_session_id_dev` 
        });
    }

    try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });

        // Cria a sessão de checkout real
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'], 
            line_items: [
                {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: 'Assinatura ADS Relator Pro',
                            description: 'Acesso ilimitado ao dashboard e relatórios avançados.',
                        },
                        unit_amount: 1990, // R$ 19,90
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
        // Retorna o erro JSON para o frontend tratar em vez de estourar 500 genérico
        return res.status(500).json({ message: error.message || 'Erro ao criar sessão de pagamento.' });
    }
}
