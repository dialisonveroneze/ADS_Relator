
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const expireOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        maxAge: -1, // Expire immediately
        path: '/',
        sameSite: 'lax' as const,
    };

    res.setHeader('Set-Cookie', [
        cookie.serialize('meta_token', '', expireOptions),
        cookie.serialize('google_access_token', '', expireOptions),
        cookie.serialize('google_refresh_token', '', expireOptions)
    ]);

    res.status(200).json({ message: 'Logout realizado com sucesso.' });
}
