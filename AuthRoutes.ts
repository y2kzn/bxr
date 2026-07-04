import { Router } from 'express';
import { ping } from '../Controllers/AuthController';

const router = Router();

// PUBLIC ROUTES WITHOUT LOGIN AND WITHOUT TOKEN
router.get('/ping', ping);

export default router;