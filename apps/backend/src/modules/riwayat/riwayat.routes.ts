import { Router } from 'express';
import { getRiwayat } from './riwayat.controller';
import { authGuard } from '../../middlewares/authGuard';

const router = Router();

router.get('/', authGuard, getRiwayat);

export default router;
