import { Request, Response, Router } from 'express';
import { listData, setData, getData, id } from '../firebase';

const router = Router();

// GET all approved accolades
router.get('/', async (req: Request, res: Response) => {
    try {
        const accolades = await listData('accolades');
        const approvedAccolades = accolades.filter(a => a.status === 'approved');
        res.json({ success: true, accolades: approvedAccolades });
    } catch (err) {
        console.error('[Accolades] Get all error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET accolades for a specific student
router.get('/:studentId', async (req: Request, res: Response) => {
    try {
        const { studentId } = req.params;
        const accolades = await listData('accolades');
        const studentAccolades = accolades.filter(a => a.studentId === studentId && a.status === 'approved');
        res.json({ success: true, accolades: studentAccolades });
    } catch (err) {
        console.error('[Accolades] Get for student error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST a new accolade for submission
router.post('/', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }

        const { studentId, title, description, category, evidenceUrl } = req.body;
        if (!studentId || !title || !description || !category) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const student = await getData(`users/${studentId}`);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const accoladeId = id('accolade');
        const newAccolade = {
            id: accoladeId,
            studentId,
            studentName: student.name,
            title,
            description,
            category, // e.g., 'academics', 'sports', 'arts', 'leadership'
            evidenceUrl: evidenceUrl || null,
            status: 'pending', // pending, approved, rejected
            submittedBy: requesterId,
            createdAt: new Date().toISOString(),
        };

        await setData(`accolades/${accoladeId}`, newAccolade);
        res.status(201).json({ success: true, accolade: newAccolade });
    } catch (err) {
        console.error('[Accolades] Submit error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT to approve an accolade
router.put('/:id/approve', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);
        if (!['admin', 'principal', 'teacher'].includes(requester?.role)) {
            return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
        }

        const { id } = req.params;
        const accolade = await getData(`accolades/${id}`);
        if (!accolade) {
            return res.status(404).json({ error: 'Accolade not found' });
        }

        if (accolade.status !== 'pending') {
            return res.status(409).json({ error: `Accolade is already ${accolade.status}` });
        }

        const updatedAccolade = {
            ...accolade,
            status: 'approved',
            approvedBy: requesterId,
            approvedAt: new Date().toISOString(),
        };

        await setData(`accolades/${id}`, updatedAccolade);
        res.json({ success: true, accolade: updatedAccolade });
    } catch (err) {
        console.error('[Accolades] Approve error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT to reject an accolade
router.put('/:id/reject', async (req: Request, res: Response) => {
    try {
        const requesterId = req.headers['x-user-id'] as string;
        if (!requesterId) {
            return res.status(401).json({ error: 'Unauthorized - User ID required' });
        }
        const requester = await getData(`users/${requesterId}`);
        if (!['admin', 'principal', 'teacher'].includes(requester?.role)) {
            return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
        }

        const { id } = req.params;
        const { reason } = req.body;
        const accolade = await getData(`accolades/${id}`);
        if (!accolade) {
            return res.status(404).json({ error: 'Accolade not found' });
        }

        if (accolade.status !== 'pending') {
            return res.status(409).json({ error: `Accolade is already ${accolade.status}` });
        }

        const updatedAccolade = {
            ...accolade,
            status: 'rejected',
            rejectedBy: requesterId,
            rejectionReason: reason || 'No reason provided',
            rejectedAt: new Date().toISOString(),
        };

        await setData(`accolades/${id}`, updatedAccolade);
        res.json({ success: true, accolade: updatedAccolade });
    } catch (err) {
        console.error('[Accolades] Reject error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;