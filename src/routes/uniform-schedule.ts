import { Request, Response, Router } from 'express';
import { listData, setData, getData, id } from '../firebase';

const router = Router();

// GET all uniform schedules
router.get('/', async (req: Request, res: Response) => {
    try {
        const schedules = await listData('uniformSchedules');
        res.json({ success: true, schedules: schedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek) });
    } catch (err) {
        console.error('[Uniform] Get all schedules error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET today's uniform schedule for a class
router.get('/today', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);
        if (!requester) {
            return res.status(404).json({ error: 'User not found' });
        }

        const dayOfWeek = new Date().getDay(); // Sunday = 0, Monday = 1, etc.
        const schedules = await listData('uniformSchedules');
        const relevantSchedule = schedules.find(s => s.dayOfWeek === dayOfWeek && (!s.classId || s.classId === requester.classId));
        
        if (!relevantSchedule) {
            return res.json({ success: true, uniform: 'No specific uniform scheduled for today.' });
        }

        res.json({ success: true, uniform: relevantSchedule });
    } catch (err) {
        console.error("[Uniform] Get today's schedule error:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// POST a new uniform schedule
router.post('/', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);
        if (!['admin', 'principal'].includes(requester?.role)) {
            return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
        }

        const { dayOfWeek, uniformType, description, classId } = req.body; // dayOfWeek: 0-6
        if (dayOfWeek === undefined || !uniformType) {
            return res.status(400).json({ error: 'Missing required fields: dayOfWeek and uniformType' });
        }

        const scheduleId = id('uniform');
        const newSchedule = {
            id: scheduleId,
            dayOfWeek,
            uniformType,
            description: description || '',
            classId: classId || null, // Can be null for a general school-wide schedule
            createdAt: new Date().toISOString(),
            createdBy: requesterId
        };

        await setData(`uniformSchedules/${scheduleId}`, newSchedule);
        res.status(201).json({ success: true, schedule: newSchedule });
    } catch (err) {
        console.error('[Uniform] Create schedule error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT to update a uniform schedule
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);
        if (!['admin', 'principal'].includes(requester?.role)) {
            return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
        }

        const { id } = req.params;
        const existingSchedule = await getData(`uniformSchedules/${id}`);
        if (!existingSchedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        const { dayOfWeek, uniformType, description, classId } = req.body;
        const updatedSchedule = {
            ...existingSchedule,
            dayOfWeek: dayOfWeek ?? existingSchedule.dayOfWeek,
            uniformType: uniformType ?? existingSchedule.uniformType,
            description: description ?? existingSchedule.description,
            classId: classId ?? existingSchedule.classId,
            updatedAt: new Date().toISOString(),
            updatedBy: requesterId
        };

        await setData(`uniformSchedules/${id}`, updatedSchedule);
        res.json({ success: true, schedule: updatedSchedule });
    } catch (err) {
        console.error('[Uniform] Update schedule error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE a uniform schedule
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);
        if (!['admin', 'principal'].includes(requester?.role)) {
            return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
        }

        const { id } = req.params;
        const existingSchedule = await getData(`uniformSchedules/${id}`);
        if (!existingSchedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        await setData(`uniformSchedules/${id}`, null); // Soft delete
        res.json({ success: true, message: 'Schedule deleted successfully' });
    } catch (err) {
        console.error('[Uniform] Delete schedule error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;