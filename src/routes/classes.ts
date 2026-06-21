import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();


router.get('/detailed', async (req, res) => {
  try {
    const classes = await listData('classes');
    const sections = await listData('sections');
    const subjects = await listData('subjects');
    const users = await listData('users');

    const result = (classes || []).map((cls: any) => {
      const clsSections = (sections || []).filter((s: any) => s.classId === cls.id);
      const clsSubjects = (subjects || []).filter((s: any) => s.classId === cls.id);
      
      const studentsInClass = (users || []).filter((u: any) => u.role === 'student' && u.classId === cls.id);

      return {
        ...cls,
        sections: clsSections,
        subjects: clsSubjects,
        sectionCount: clsSections.length,
        studentCount: studentsInClass.length
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch detailed classes' });
  }
});

router.get('/', async (req, res) => {
  try {
    const classes = await listData('classes');
    res.json(classes || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

router.post('/', async (req, res) => {
  try {
    const newClass = { id: id('cls'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`classes/${newClass.id}`, newClass);
    res.status(201).json(newClass);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create class' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await getData(`classes/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body };
    await setData(`classes/${req.params.id}`, updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update class' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await setData(`classes/${req.params.id}`, null);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

export default router;
