import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getData, setData, listData, id, removeData, pushData } from '../firebase';

const router = Router();

// GET /api/assignments
router.get('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const user = await getData(`users/${requesterId}`);
    let assignments = await listData('assignments');
    
    if (user?.role === 'student') {
      assignments = assignments.filter(a => 
        a.class === user.class && a.published && new Date(a.dueDate) >= new Date()
      );
    } else if (user?.role === 'teacher') {
      assignments = assignments.filter(a => a.teacherId === requesterId);
    }

    assignments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ success: true, assignments });
  } catch (err) {
    console.error('[Assignments] Get all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/assignments/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const assignment = await getData(`assignments/${id}`);
    
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const submissions = await listData(`assignments/${id}/submissions`);
    res.json({ success: true, assignment, submissions });
  } catch (err) {
    console.error('[Assignments] Get single error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assignments
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

    const { title, description, className, subject, dueDate, points = 100 } = req.body;
    if (!title || !description || !className || !subject || !dueDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const assignmentId = id('assign');
    const newAssignment = {
      id: assignmentId,
      title,
      description,
      class: className,
      subject,
      dueDate,
      points,
      teacherId: requesterId,
      teacherName: requester.name,
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setData(`assignments/${assignmentId}`, newAssignment);
    res.json({ success: true, assignment: newAssignment });
  } catch (err) {
    console.error('[Assignments] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/assignments/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const existing = await getData(`assignments/${id}`);
    
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (existing.teacherId !== requesterId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only update your own assignments' });
      }
    }

    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`assignments/${id}`, updated);
    res.json({ success: true, assignment: updated });
  } catch (err) {
    console.error('[Assignments] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/assignments/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const existing = await getData(`assignments/${id}`);
    
    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (existing.teacherId !== requesterId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only delete your own assignments' });
      }
    }

    await removeData(`assignments/${id}`);
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (err) {
    console.error('[Assignments] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assignments/:id/submit
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const assignment = await getData(`assignments/${id}`);
    
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (!assignment.published) {
      return res.status(400).json({ error: 'Assignment not yet published' });
    }

    const { content, fileUrl = null } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Submission content is required' });
    }

    const existingSubmissions = await listData(`assignments/${id}/submissions`);
    if (existingSubmissions.some(s => s.studentId === requesterId)) {
      return res.status(409).json({ error: 'You have already submitted this assignment' });
    }

    const submitter = await getData(`users/${requesterId}`);
    const submission = {
      id: uuidv4(),
      assignmentId: id,
      studentId: requesterId,
      studentName: submitter?.name || 'Unknown',
      content,
      fileUrl,
      submittedAt: new Date().toISOString(),
      isLate: new Date() > new Date(assignment.dueDate),
      grade: null,
      feedback: null,
      gradedAt: null
    };

    await setData(`assignments/${id}/submissions/${submission.id}`, submission);
    res.json({ success: true, submission });
  } catch (err) {
    console.error('[Assignments] Submit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assignments/:id/grade
router.post('/:id/grade', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const assignment = await getData(`assignments/${id}`);
    
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (assignment.teacherId !== requesterId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only grade your own assignments' });
      }
    }

    const { submissionId, grade, feedback } = req.body;
    if (!submissionId || grade === undefined || !feedback) {
      return res.status(400).json({ error: 'Submission ID, grade, and feedback are required' });
    }

    const submission = await getData(`assignments/${id}/submissions/${submissionId}`);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const gradedSubmission = {
      ...submission,
      grade,
      feedback,
      gradedAt: new Date().toISOString(),
      gradedBy: requesterId
    };

    await setData(`assignments/${id}/submissions/${submissionId}`, gradedSubmission);
    res.json({ success: true, submission: gradedSubmission });
  } catch (err) {
    console.error('[Assignments] Grade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/assignments/:id/publish
router.post('/:id/publish', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const assignment = await getData(`assignments/${id}`);
    
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (assignment.teacherId !== requesterId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only publish your own assignments' });
      }
    }

    if (assignment.published) {
      return res.status(400).json({ error: 'Assignment is already published' });
    }

    const published = { ...assignment, published: true, publishedAt: new Date().toISOString() };
    await setData(`assignments/${id}`, published);

    const classStudents = await listData('users');
    const studentIds = classStudents.filter(u => u.role === 'student' && u.class === assignment.class).map(u => u.id);
    
    if (studentIds.length > 0) {
      try {
        await fetch(`${req.protocol}://${req.get('host')}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
          body: JSON.stringify({
            recipientIds: studentIds,
            title: `New Assignment: ${assignment.title}`,
            message: `A new assignment has been posted for ${assignment.subject}. Due: ${new Date(assignment.dueDate).toLocaleDateString()}`,
            type: 'assignment',
            link: `/assignments/${id}`
          })
        });
      } catch (notifyErr) {
        console.warn('[Assignments] Failed to send notifications:', notifyErr);
      }
    }

    res.json({ success: true, assignment: published });
  } catch (err) {
    console.error('[Assignments] Publish error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/assignments (admin only — clear all seeded assignments)
router.delete('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }
    const requester = await getData(`users/${requesterId}`);
    if (requester?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden - Admin only' });
    }
    const existing = await listData('assignments');
    if (existing && existing.length > 0) {
      for (const a of existing) {
        await removeData(`assignments/${a.id}`);
      }
    }
    res.json({ success: true, message: `Cleared ${existing?.length || 0} assignments` });
  } catch (err) {
    console.error('[Assignments] Clear all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;