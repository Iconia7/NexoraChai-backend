import { Router } from 'express';
import { setupProfile, checkUsernameAvailability, getProfile, getDashboard, updateProfile, changePassword, updatePayoutNumber, listCreators, getNotifications, markNotificationAsRead } from '../controllers/creatorController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.get('/', listCreators);
router.post('/setup', authenticateToken, setupProfile);
router.get('/check-username/:username', checkUsernameAvailability);
router.get('/dashboard', authenticateToken, getDashboard);
router.get('/notifications', authenticateToken, getNotifications);
router.patch('/notifications/:id/read', authenticateToken, markNotificationAsRead);
router.patch('/profile', authenticateToken, updateProfile);
router.post('/payout-number', authenticateToken, updatePayoutNumber);
router.post('/change-password', authenticateToken, changePassword);
router.get('/:username', getProfile);

export default router;
