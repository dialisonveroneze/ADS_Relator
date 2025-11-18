
// api/subscribe.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Simulate Payment Processing...
    // In a real app, you would validate the Stripe/Pix webhook here.

    // Set a cookie to mark the user as "Paid/Active"
    res.setHeader('Set-Cookie', cookie.serialize('subscription_active', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        maxAge: 60 * 60 * 24 * 30, // 30 Days Subscription
        path: '/',
        sameSite: 'lax',
    }));

    return res.status(200).json({ success: true });
}
