import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "../../infrastructure/aws/secrets";
import { AuthError } from "../../shared/errors";

// Extend Express Request to carry the authenticated user id
declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new AuthError();

    const accessToken = header.slice(7);
    const { supabaseUrl, supabaseServiceKey } = getConfig();

    // Create a request-scoped Supabase client with the incoming JWT so we can
    // resolve the authenticated user for this request.
    const client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });

    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new AuthError();

    req.userId = data.user.id;
    next();
  } catch (err) {
    next(err);
  }
}
