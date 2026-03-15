import { Router } from 'express';
import * as ctrl from './prController';
import { requireAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/',                         ctrl.listPRs);
router.get('/:prId',                    ctrl.getPR);
router.get('/:prId/notes',              ctrl.getNotes);
router.post('/:prId/notes',             ctrl.addNote);
router.delete('/:prId/notes/:noteId',   ctrl.deleteNote);

export default router;
