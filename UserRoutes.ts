import { Router } from 'express';
import { 
  userGet, 
  userChangeNick,
  userReport
} from '../Controllers/UserController';
import { validateAppId, authenticateToken } from '../Middleware/Index';

const router = Router();

router.post('/userGet', validateAppId, authenticateToken, userGet);
router.post('/userChangeNick', validateAppId, authenticateToken, userChangeNick);
router.post('/userReport', validateAppId, authenticateToken, userReport);



export default router;