import { Router } from 'express';
import * as creatorController from '../controllers/creatorController';
import { authenticateToken } from '../middlewares/auth';

const router = Router();

router.get('/', creatorController.listCreators);
router.post('/setup', authenticateToken, creatorController.setupProfile);
router.get('/check-username/:username', creatorController.checkUsernameAvailability);
router.get('/dashboard', authenticateToken, creatorController.getDashboard);
router.get('/notifications', authenticateToken, creatorController.getNotifications);
router.patch('/notifications/:id/read', authenticateToken, creatorController.markNotificationAsRead);
router.patch('/profile', authenticateToken, creatorController.updateProfile);
router.post('/upload-avatar', authenticateToken, (creatorController as any).upload.single('avatar'), creatorController.uploadAvatar);
router.post('/payout-number', authenticateToken, creatorController.updatePayoutNumber);
router.post('/change-password', authenticateToken, creatorController.changePassword);
router.get('/:username', creatorController.getProfile);
router.get('/badge/:username', creatorController.getBadge);

export default router;
