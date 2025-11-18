
// api/subscription.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const cookies = cookie.parse(req.headers.cookie || '');
    
    // 1. Check for "Payment" simulation (In a real app, check database for 'subscription_status')
    const isPaid = cookies.subscription_active === 'true';

    if (isPaid) {
        return res.status(200).json({
            status: 'active'
        });
    }

    // 2. Logic for Trial (15 Days)
    let trialStart = cookies.trial_start;
    const now = new Date();

    if (!trialStart) {
        // First time user seen? Set the trial start cookie
        // In a real app, this would be the user's 'created_at' date in DB
        const newTrialStart = now.toISOString();
        
        res.setHeader('Set-Cookie', cookie.serialize('trial_start', newTrialStart, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60 * 24 * 365, // 1 year persistence
            path: '/',
            sameSite: 'lax',
        }));

        return res.status(200).json({
            status: 'trial_active',
            daysRemaining: 15,
            trialEndDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString()
        });
    }

    // Calculate remaining days
    const startDate = new Date(trialStart);
    const diffTime = Math.abs(now.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const trialLength = 15;

    if (diffDays > trialLength) {
        return res.status(200).json({
            status: 'expired',
            daysRemaining: 0
        });
    }

    return res.status(200).json({
        status: 'trial_active',
        daysRemaining: trialLength - diffDays,
        trialEndDate: new Date(startDate.getTime() + trialLength * 24 * 60 * 60 * 1000).toISOString()
    });
}
