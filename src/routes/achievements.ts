import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { listData, setData, getData, id, pushData } from '../firebase';

const router = Router();

// GET all achievements
router.get('/', async (req: Request, res: Response) => {
    try {
        const achievements = await listData('achievements');
        res.json({ success: true, achievements: achievements.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
    } catch (err) {
        console.error('[Achievements] Get all error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a new achievement
router.post('/', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);
        if (!['admin', 'principal', 'teacher'].includes(requester?.role)) {
            return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
        }

        const { title, description, imageUrl, studentId, accoladeId } = req.body;
        if (!title || !description) {
            return res.status(400).json({ error: 'Title and description are required' });
        }

        const achievementId = id('achievement');
        const newAchievement = {
            id: achievementId,
            title,
            description,
            imageUrl: imageUrl || null,
            studentId: studentId || null, // Optional: link to a specific student
            accoladeId: accoladeId || null, // Optional: link to a specific accolade
            createdBy: requesterId,
            createdAt: new Date().toISOString(),
            likes: [],
            comments: [],
        };

        await setData(`achievements/${achievementId}`, newAchievement);
        res.status(201).json({ success: true, achievement: newAchievement });
    } catch (err) {
        console.error('[Achievements] Create error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST to like/unlike an achievement
router.post('/:id/like', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }

        const { id } = req.params;
        const achievement = await getData(`achievements/${id}`);
        if (!achievement) {
            return res.status(404).json({ error: 'Achievement not found' });
        }

        const likes = achievement.likes || [];
        const userHasLiked = likes.includes(requesterId);

        if (userHasLiked) {
            // Unlike
            const updatedLikes = likes.filter((userId: string) => userId !== requesterId);
            await setData(`achievements/${id}/likes`, updatedLikes);
        } else {
            // Like
            await pushData(`achievements/${id}/likes`, requesterId);
        }

        const updatedAchievement = await getData(`achievements/${id}`);
        res.json({ success: true, likes: updatedAchievement.likes || [] });
    } catch (err) {
        console.error('[Achievements] Like error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a comment on an achievement
router.post('/:id/comment', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);

        const { id } = req.params;
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const achievement = await getData(`achievements/${id}`);
        if (!achievement) {
            return res.status(404).json({ error: 'Achievement not found' });
        }

        const commentId = uuidv4();
        const newComment = {
            id: commentId,
            userId: requesterId,
            userName: requester.name,
            userAvatar: requester.profileImage || null,
            text,
            createdAt: new Date().toISOString(),
        };

        await pushData(`achievements/${id}/comments`, newComment);
        const updatedAchievement = await getData(`achievements/${id}`);
        res.status(201).json({ success: true, comments: updatedAchievement.comments || [] });
    } catch (err) {
        console.error('[Achievements] Comment error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;