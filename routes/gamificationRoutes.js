import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { awardXP, getStudentStats, getLeaderboard, getSubjectHealth } from '../controllers/gamificationController.js';

const router = Router();

router.use(requireAuth);

// Get student gamification stats (XP, level, badges, rank, weekly challenge)
router.get('/stats/:studentId', allowRoles('student', 'teacher', 'admin', 'parent'), getStudentStats);

// Get class leaderboard
router.get('/leaderboard/:classId', allowRoles('student', 'teacher', 'admin'), getLeaderboard);

// Get subject health scores for a student
router.get('/subject-health/:studentId', allowRoles('student', 'teacher', 'admin', 'parent'), getSubjectHealth);

// Award XP (admin/teacher only)
router.post('/award-xp', allowRoles('admin', 'teacher'), awardXP);

export default router;
