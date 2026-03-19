import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth }           from '../middleware/auth';
import { uploadAudioMiddleware } from '../middleware/upload';
import { createSession }         from '../../application/createSession';
import { listSessions }          from '../../application/listSessions';
import { getSession }            from '../../application/getSession';
import { processSessionAudio }   from '../../application/processSessionAudio';

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

// POST /sessions/:id/audio — upload audio and run the full AI pipeline synchronously.
// Auth is enforced by router.use(requireAuth) above, which runs before multer
// so unauthenticated requests are rejected before any file parsing occurs.
router.post(
  '/:id/audio',
  uploadAudioMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(422).json({ error: 'Missing audio file. Send a multipart/form-data request with field name "audio".' });
        return;
      }
      const session = await processSessionAudio(req.params['id']!, req.userId, req.file);
      res.json(session);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
