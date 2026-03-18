import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Validation failed', details: err.flatten().fieldErrors });
    return;
  }

  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
}
