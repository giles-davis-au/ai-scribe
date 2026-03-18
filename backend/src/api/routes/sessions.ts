import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { createSession } from '../../application/createSession';
import { listSessions }  from '../../application/listSessions';
import { getSession }    from '../../application/getSession';

const router = Router();

// All session routes require authentication
router.use(requireAuth);

// POST /sessions — create a new session
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await createSession(req.userId);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// GET /sessions — list current user's sessions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await listSessions(req.userId);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// GET /sessions/:id — get a single session
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await getSession(req.params['id']!, req.userId);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

export default router;
