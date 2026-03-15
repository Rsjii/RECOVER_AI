import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { handleSearch } from './searchController';

const router = Router();
router.post('/', requireAuth, handleSearch);
export default router;
