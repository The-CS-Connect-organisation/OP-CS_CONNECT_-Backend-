import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Book Catalogue (Phase 2) ---
router.post('/books/catalogue', async (req, res) => {
  try {
    const book = { id: id('bk'), ...req.body, addedAt: new Date().toISOString() };
    await setData(`bookCatalogue/${book.id}`, book);
    res.status(201).json(book);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add book' });
  }
});

router.get('/books/catalogue', async (req, res) => {
  try {
    let books = await listData('bookCatalogue');
    const { search, category, author, isbn } = req.query;
    if (search) books = books.filter((b: any) =>
      b.title?.toLowerCase().includes((search as string).toLowerCase()) ||
      b.author?.toLowerCase().includes((search as string).toLowerCase()) ||
      b.isbn?.includes(search as string));
    if (category) books = books.filter((b: any) => b.category === category);
    if (author) books = books.filter((b: any) => b.author?.toLowerCase().includes((author as string).toLowerCase()));
    if (isbn) books = books.filter((b: any) => b.isbn === isbn);
    res.json(books);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch catalogue' });
  }
});

// --- Book Holds / Reservations (Phase 2) ---
router.post('/books/hold', async (req, res) => {
  try {
    const { bookId, studentId, studentName } = req.body;
    const book = await getData(`bookCatalogue/${bookId}`);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    // Check existing holds
    const holds = await listData(`bookHolds/${bookId}`);
    if (holds.some((h: any) => h.studentId === studentId && h.status === 'active')) {
      return res.status(409).json({ error: 'You already have a hold on this book' });
    }
    const hold = {
      id: id('bh'), bookId, studentId, studentName, bookTitle: book.title,
      status: 'active', placedAt: new Date().toISOString(), position: holds.filter((h: any) => h.status === 'active').length + 1,
    };
    await setData(`bookHolds/${bookId}/${hold.id}`, hold);
    await setData(`studentHolds/${studentId}/${hold.id}`, hold);
    res.status(201).json(hold);
  } catch (e) {
    res.status(500).json({ error: 'Failed to place hold' });
  }
});

router.get('/books/holds/:bookId', async (req, res) => {
  try {
    const holds = await listData(`bookHolds/${req.params.bookId}`);
    res.json(holds.filter((h: any) => h.status === 'active').sort((a: any, b: any) => a.position - b.position));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch holds' });
  }
});

router.put('/books/holds/:bookId/:holdId/fulfill', async (req, res) => {
  try {
    const hold = await getData(`bookHolds/${req.params.bookId}/${req.params.holdId}`);
    if (!hold) return res.status(404).json({ error: 'Hold not found' });
    hold.status = 'fulfilled';
    hold.fulfilledAt = new Date().toISOString();
    await setData(`bookHolds/${req.params.bookId}/${req.params.holdId}`, hold);
    // Update student holds
    const studentHold = await getData(`studentHolds/${hold.studentId}/${req.params.holdId}`);
    if (studentHold) studentHold.status = 'fulfilled';
    await setData(`studentHolds/${hold.studentId}/${req.params.holdId}`, studentHold);
    // Create borrow record
    const borrow = {
      id: id('bb'), bookId: req.params.bookId, bookTitle: hold.bookTitle,
      studentId: hold.studentId, studentName: hold.studentName,
      borrowedDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'borrowed',
    };
    await setData(`borrowedBooks/${borrow.id}`, borrow);
    res.json({ hold, borrow });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fulfill hold' });
  }
});

// --- Book Fines (Phase 2) ---
router.get('/books/fines/:studentId', async (req, res) => {
  try {
    const fines = await listData('bookFines');
    const studentFines = fines.filter((f: any) => f.studentId === req.params.studentId);
    const total = studentFines.filter((f: any) => f.status === 'unpaid').reduce((s: number, f: any) => s + (f.amount || 0), 0);
    res.json({ fines: studentFines, totalUnpaid: total });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch fines' });
  }
});

router.post('/books/fines/calculate', async (req, res) => {
  try {
    const { bookId, studentId } = req.body;
    const books = await listData('borrowedBooks');
    const borrowed = books.find((b: any) => b.bookId === bookId && b.studentId === studentId && b.status === 'borrowed');
    if (!borrowed) return res.status(404).json({ error: 'No active borrow record found' });
    const dueDate = new Date(borrowed.dueDate);
    const now = new Date();
    if (now <= dueDate) return res.json({ fine: 0, message: 'Not overdue' });
    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = req.body.dailyRate || 1;
    const fine = daysOverdue * dailyRate;
    const fineRecord = {
      id: id('bf'), bookId, studentId, bookTitle: borrowed.bookTitle,
      daysOverdue, dailyRate, amount: fine, status: 'unpaid',
      calculatedAt: new Date().toISOString(),
    };
    await setData(`bookFines/${fineRecord.id}`, fineRecord);
    res.json(fineRecord);
  } catch (e) {
    res.status(500).json({ error: 'Failed to calculate fine' });
  }
});

router.put('/books/fines/:id/pay', async (req, res) => {
  try {
    const fine = await getData(`bookFines/${req.params.id}`);
    if (!fine) return res.status(404).json({ error: 'Fine not found' });
    fine.status = 'paid';
    fine.paidAt = new Date().toISOString();
    fine.paidBy = req.body.paidBy;
    await setData(`bookFines/${req.params.id}`, fine);
    res.json(fine);
  } catch (e) {
    res.status(500).json({ error: 'Failed to pay fine' });
  }
});

// --- Class Sets (Phase 2) ---
router.post('/books/class-sets', async (req, res) => {
  try {
    const set = { id: id('cs'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`classSets/${set.id}`, set);
    res.status(201).json(set);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create class set' });
  }
});

router.get('/books/class-sets', async (req, res) => {
  try {
    let sets = await listData('classSets');
    const { class: className } = req.query;
    if (className) sets = sets.filter((s: any) => s.class === className);
    res.json(sets);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch class sets' });
  }
});

// --- Reading Logs (Phase 2) ---
router.post('/reading-logs', async (req, res) => {
  try {
    const log = { id: id('rl'), ...req.body, loggedAt: new Date().toISOString() };
    await setData(`readingLogs/${log.id}`, log);
    res.status(201).json(log);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log reading' });
  }
});

router.get('/reading-logs', async (req, res) => {
  try {
    let logs = await listData('readingLogs');
    const { studentId, bookId } = req.query;
    if (studentId) logs = logs.filter((l: any) => l.studentId === studentId);
    if (bookId) logs = logs.filter((l: any) => l.bookId === bookId);
    res.json(logs.sort((a: any, b: any) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// --- Reading Programmes (Phase 2) ---
router.post('/reading-programmes', async (req, res) => {
  try {
    const prog = { id: id('rp'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`readingProgrammes/${prog.id}`, prog);
    res.status(201).json(prog);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create programme' });
  }
});

router.get('/reading-programmes', async (_req, res) => {
  try {
    const programmes = await listData('readingProgrammes');
    res.json(programmes);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch programmes' });
  }
});

// --- Book Reviews (Phase 2) ---
router.post('/books/reviews', async (req, res) => {
  try {
    const review = { id: id('br'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`bookReviews/${review.id}`, review);
    res.status(201).json(review);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

router.get('/books/:bookId/reviews', async (req, res) => {
  try {
    const reviews = await listData('bookReviews');
    res.json(reviews.filter((r: any) => r.bookId === req.params.bookId));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// --- Interlibrary Loans (Phase 2) ---
router.post('/interlibrary-loans', async (req, res) => {
  try {
    const loan = { id: id('ill'), ...req.body, status: 'requested', createdAt: new Date().toISOString() };
    await setData(`interlibraryLoans/${loan.id}`, loan);
    res.status(201).json(loan);
  } catch (e) {
    res.status(500).json({ error: 'Failed to request ILL' });
  }
});

router.get('/interlibrary-loans', async (req, res) => {
  try {
    let loans = await listData('interlibraryLoans');
    const { status, libraryFrom } = req.query;
    if (status) loans = loans.filter((l: any) => l.status === status);
    if (libraryFrom) loans = loans.filter((l: any) => l.libraryFrom === libraryFrom);
    res.json(loans);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch ILLs' });
  }
});

// --- Library Categories ---
router.post('/library/categories', async (req, res) => {
  try {
    const cat = { id: id('lc'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`libraryCategories/${cat.id}`, cat);
    res.status(201).json(cat);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.get('/library/categories', async (_req, res) => {
  try {
    const cats = await listData('libraryCategories');
    res.json(cats);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// --- Library Locations (branches) ---
router.post('/library/locations', async (req, res) => {
  try {
    const loc = { id: id('ll'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`libraryLocations/${loc.id}`, loc);
    res.status(201).json(loc);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create location' });
  }
});

router.get('/library/locations', async (_req, res) => {
  try {
    const locs = await listData('libraryLocations');
    res.json(locs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

export default router;
