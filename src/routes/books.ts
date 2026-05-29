import { Request, Response, Router } from 'express';
import { getData, setData, listData, id, removeData } from '../firebase';

const router = Router();

// GET /api/books
router.get('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    let books = await listData('books');
    
    if (req.query.available === 'true') {
      books = books.filter(b => b.availableCopies > 0);
    }
    
    if (req.query.search) {
      const search = (req.query.search as string).toLowerCase();
      books = books.filter(b => 
        b.title.toLowerCase().includes(search) || 
        b.author.toLowerCase().includes(search) ||
        b.isbn.includes(search)
      );
    }

    res.json({ success: true, books: books.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  } catch (err) {
    console.error('[Books] Get all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/books/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { id } = req.params;
    const book = await getData(`books/${id}`);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const transactions = await listData('bookTransactions');
    const bookTransactions = transactions.filter(t => t.bookId === id);
    
    res.json({ success: true, book, transactionHistory: bookTransactions });
  } catch (err) {
    console.error('[Books] Get single error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/books
router.post('/', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'librarian'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { title, author, isbn, totalCopies, category, description = '' } = req.body;
    if (!title || !author || !isbn || totalCopies === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bookId = id('book');
    const newBook = {
      id: bookId,
      title,
      author,
      isbn,
      totalCopies,
      availableCopies: totalCopies,
      category,
      description,
      createdAt: new Date().toISOString(),
      createdBy: requesterId
    };

    await setData(`books/${bookId}`, newBook);
    res.json({ success: true, book: newBook });
  } catch (err) {
    console.error('[Books] Create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/books/issue
router.post('/issue', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'librarian'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { bookId, studentId, dueDate } = req.body;
    if (!bookId || !studentId || !dueDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const book = await getData(`books/${bookId}`);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.availableCopies <= 0) {
      return res.status(400).json({ error: 'No available copies to issue' });
    }

    const student = await getData(`users/${studentId}`);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const transactions = await listData('bookTransactions');
    const activeIssuance = transactions.find(t => 
      t.bookId === bookId && t.studentId === studentId && t.status === 'issued'
    );
    if (activeIssuance) {
      return res.status(409).json({ error: 'Student already has this book issued' });
    }

    const transactionId = id('btx');
    const transaction = {
      id: transactionId,
      bookId,
      bookTitle: book.title,
      studentId,
      studentName: student.name,
      issueDate: new Date().toISOString(),
      dueDate,
      returnDate: null,
      status: 'issued',
      issuedBy: requesterId,
      fine: 0
    };

    await setData(`bookTransactions/${transactionId}`, transaction);
    await setData(`books/${bookId}`, { ...book, availableCopies: book.availableCopies - 1 });

    try {
      await fetch(`${req.protocol}://${req.get('host')}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
        body: JSON.stringify({
          recipientIds: [studentId],
          title: 'Book Issued',
          message: `You have issued "${book.title}". Due date: ${new Date(dueDate).toLocaleDateString()}`,
          type: 'library',
          link: '/library'
        })
      });
    } catch (notifyErr) {
      console.warn('[Books] Failed to send notification:', notifyErr);
    }

    res.json({ success: true, transaction, book: { ...book, availableCopies: book.availableCopies - 1 } });
  } catch (err) {
    console.error('[Books] Issue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/books/return
router.post('/return', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'librarian'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { transactionId } = req.body;
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const transaction = await getData(`bookTransactions/${transactionId}`);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status === 'returned') {
      return res.status(400).json({ error: 'Book already returned' });
    }

    const book = await getData(`books/${transaction.bookId}`);
    if (!book) {
      return res.status(404).json({ error: 'Associated book not found' });
    }

    const today = new Date();
    const dueDate = new Date(transaction.dueDate);
    let fine = 0;
    if (today > dueDate) {
      const daysLate = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      fine = daysLate * 5;
    }

    const updatedTransaction = {
      ...transaction,
      returnDate: new Date().toISOString(),
      status: 'returned',
      fine
    };

    await setData(`bookTransactions/${transactionId}`, updatedTransaction);
    await setData(`books/${transaction.bookId}`, { ...book, availableCopies: book.availableCopies + 1 });

    res.json({ 
      success: true, 
      transaction: updatedTransaction, 
      book: { ...book, availableCopies: book.availableCopies + 1 },
      fineApplied: fine 
    });
  } catch (err) {
    console.error('[Books] Return error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/books/student/:studentId
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { studentId } = req.params;
    if (requesterId !== studentId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal', 'librarian', 'teacher'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only view your own transactions' });
      }
    }

    const transactions = await listData('bookTransactions');
    const studentTransactions = transactions.filter(t => t.studentId === studentId);
    const activeIssuances = studentTransactions.filter(t => t.status === 'issued');
    const history = studentTransactions.filter(t => t.status === 'returned');

    res.json({
      success: true,
      studentId,
      activeIssuances,
      returnHistory: history.sort((a, b) => b.returnDate.localeCompare(a.returnDate))
    });
  } catch (err) {
    console.error('[Books] Student transactions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/books/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'librarian'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const existing = await getData(`books/${id}`);
    if (!existing) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    if (req.body.totalCopies !== undefined && req.body.totalCopies > existing.totalCopies) {
      const newCopies = req.body.totalCopies - existing.totalCopies;
      updated.availableCopies = existing.availableCopies + newCopies;
    }
    await setData(`books/${id}`, updated);
    res.json({ success: true, book: updated });
  } catch (err) {
    console.error('[Books] Update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/books/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'librarian'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const existing = await getData(`books/${id}`);
    if (!existing) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const transactions = await listData('bookTransactions');
    const active = transactions.find(t => t.bookId === id && t.status === 'issued');
    if (active) {
      return res.status(400).json({ error: 'Cannot delete book with active issuances' });
    }

    await removeData(`books/${id}`);
    res.json({ success: true, message: 'Book deleted successfully' });
  } catch (err) {
    console.error('[Books] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;