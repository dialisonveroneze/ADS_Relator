// api/logout.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import cookie from 'cookie';

export default function handler(req: VercelRequest, res: VercelResponse) {
    // Para fazer logout, instruímos o navegador a "expirar" o cookie.
    // Definimos maxAge como -1, o que faz com que o navegador o exclua imediatamente.
    res.setHeader('Set-Cookie', cookie.serialize('meta_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        maxAge: -1, // Expira o cookie
        path: '/',
        sameSite: 'lax',
    }));

    res.status(200).json({ message: 'Logout realizado com sucesso.' });
}
