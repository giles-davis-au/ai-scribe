import { Request, Response, NextFunction } from "express";
import { getSupabaseClient } from "../../infrastructure/supabase/client";
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

    // Verify the JWT and retrieve the user using the shared singleton client.
    const { data, error } = await getSupabaseClient().auth.getUser(accessToken);
    if (error || !data.user) throw new AuthError();

    req.userId = data.user.id;
    next();
  } catch (err) {
    next(err);
  }
}
