import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../../infrastructure/aws/secrets';
import { getServiceUserId } from '../../infrastructure/supabase/serviceAccount';
import { AuthError } from '../../shared/errors';

export function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AuthError();

    const key = header.slice(7);
    if (key !== getConfig().apiKey) throw new AuthError();

    req.userId = getServiceUserId();
    next();
  } catch (err) {
    next(err);
  }
}
