import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Chart of Accounts (Phase 2) ---
router.post('/accounts', async (req, res) => {
  try {
    const acct = { id: id('acct'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`chartOfAccounts/${acct.id}`, acct);
    res.status(201).json(acct);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create account' });
  }
});

router.get('/accounts', async (_req, res) => {
  try {
    const accounts = await listData('chartOfAccounts');
    res.json(accounts);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// --- General Ledger (Phase 2) ---
router.post('/journal-entries', async (req, res) => {
  try {
    const entry = { id: id('je'), ...req.body, status: 'draft', createdAt: new Date().toISOString() };
    await setData(`journalEntries/${entry.id}`, entry);
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

router.put('/journal-entries/:id/post', async (req, res) => {
  try {
    const entry = await getData(`journalEntries/${req.params.id}`);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    entry.status = 'posted';
    entry.postedAt = new Date().toISOString();
    entry.postedBy = req.body.postedBy;
    // Post to GL
    for (const line of entry.lines || []) {
      const glEntry = { id: id('gl'), journalId: entry.id, ...line, postedAt: entry.postedAt };
      await setData(`generalLedger/${glEntry.id}`, glEntry);
    }
    await setData(`journalEntries/${req.params.id}`, entry);
    res.json(entry);
  } catch (e) {
    res.status(500).json({ error: 'Failed to post entry' });
  }
});

router.get('/general-ledger', async (req, res) => {
  try {
    const gl = await listData('generalLedger');
    const { accountCode, fromDate, toDate } = req.query;
    let filtered = gl;
    if (accountCode) filtered = filtered.filter((e: any) => e.accountCode === accountCode);
    if (fromDate) filtered = filtered.filter((e: any) => new Date(e.postedAt) >= new Date(fromDate as string));
    if (toDate) filtered = filtered.filter((e: any) => new Date(e.postedAt) <= new Date(toDate as string));
    res.json(filtered.sort((a: any, b: any) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch GL' });
  }
});

// --- Budgets (Phase 2) ---
router.post('/budgets', async (req, res) => {
  try {
    const budget = { id: id('bdgt'), ...req.body, status: 'draft', createdAt: new Date().toISOString() };
    await setData(`budgets/${budget.id}`, budget);
    res.status(201).json(budget);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

router.get('/budgets', async (req, res) => {
  try {
    let budgets = await listData('budgets');
    const { department, fiscalYear } = req.query;
    if (department) budgets = budgets.filter((b: any) => b.department === department);
    if (fiscalYear) budgets = budgets.filter((b: any) => b.fiscalYear === fiscalYear);
    res.json(budgets);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

router.put('/budgets/:id/approve', async (req, res) => {
  try {
    const budget = await getData(`budgets/${req.params.id}`);
    if (!budget) return res.status(404).json({ error: 'Not found' });
    budget.status = 'approved';
    budget.approvedBy = req.body.approvedBy;
    budget.approvedAt = new Date().toISOString();
    await setData(`budgets/${req.params.id}`, budget);
    res.json(budget);
  } catch (e) {
    res.status(500).json({ error: 'Failed to approve budget' });
  }
});

// --- Professional Invoices (Phase 2) ---
router.post('/invoices', async (req, res) => {
  try {
    const items = await listData('invoices');
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(items.length + 1).padStart(4, '0')}`;
    const { clientName, clientEmail, items: lineItems, taxRate = 0, notes, dueDate, createdBy } = req.body;
    const subTotal = (lineItems || []).reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const taxTotal = subTotal * (taxRate / 100);
    const total = subTotal + taxTotal;
    const invoice = {
      id: id('inv'), invoiceNumber, clientName, clientEmail, items: lineItems || [],
      subTotal, taxRate, taxTotal, total, notes, dueDate,
      status: 'draft', paymentStatus: 'unpaid',
      createdBy, createdAt: new Date().toISOString(),
    };
    await setData(`invoices/${invoice.id}`, invoice);
    res.status(201).json(invoice);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    let invoices = await listData('invoices');
    const { status, paymentStatus, clientEmail } = req.query;
    if (status) invoices = invoices.filter((i: any) => i.status === status);
    if (paymentStatus) invoices = invoices.filter((i: any) => i.paymentStatus === paymentStatus);
    if (clientEmail) invoices = invoices.filter((i: any) => i.clientEmail === clientEmail);
    res.json(invoices.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

router.get('/invoices/:id', async (req, res) => {
  try {
    const invoice = await getData(`invoices/${req.params.id}`);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

router.put('/invoices/:id', async (req, res) => {
  try {
    const existing = await getData(`invoices/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    if (req.body.items) {
      updated.subTotal = req.body.items.reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
      updated.taxTotal = updated.subTotal * (updated.taxRate || 0) / 100;
      updated.total = updated.subTotal + updated.taxTotal;
    }
    await setData(`invoices/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

router.post('/invoices/:id/send', async (req, res) => {
  try {
    const invoice = await getData(`invoices/${req.params.id}`);
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    invoice.status = 'sent';
    invoice.sentAt = new Date().toISOString();
    await setData(`invoices/${req.params.id}`, invoice);
    res.json({ success: true, message: 'Invoice sent' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

router.get('/invoices/:id/pdf', async (req, res) => {
  try {
    const invoice = await getData(`invoices/${req.params.id}`);
    if (!invoice) return res.status(404).json({ error: 'Not found' });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:Arial;padding:40px;}
    h1{color:#333;border-bottom:2px solid #4f46e5;padding-bottom:10px;}
    table{width:100%;border-collapse:collapse;margin:20px 0;}
    th,td{border:1px solid #ddd;padding:8px;text-align:left;}
    th{background:#4f46e5;color:white;}
    .total{font-size:18px;font-weight:bold;text-align:right;margin-top:20px;}
    .footer{margin-top:40px;color:#666;font-size:12px;}</style></head><body>
    <h1>INVOICE ${invoice.invoiceNumber}</h1>
    <p><strong>Client:</strong> ${invoice.clientName}</p>
    <p><strong>Email:</strong> ${invoice.clientEmail}</p>
    <p><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
    <p><strong>Due Date:</strong> ${invoice.dueDate || 'N/A'}</p>
    <table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
    ${(invoice.items || []).map((i: any) => `<tr><td>${i.description || i.itemName}</td><td>${i.quantity}</td><td>${i.unitPrice}</td><td>${(i.quantity * i.unitPrice).toFixed(2)}</td></tr>`).join('')}
    </table>
    <p><strong>Subtotal:</strong> ${invoice.subTotal.toFixed(2)}</p>
    <p><strong>Tax (${invoice.taxRate}%):</strong> ${invoice.taxTotal.toFixed(2)}</p>
    <p class="total">TOTAL: ${invoice.total.toFixed(2)}</p>
    ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
    <div class="footer"><p>Generated by Cornerstone International School</p></div>
    </body></html>`;
    try {
      const pdf = require('html-pdf');
      pdf.create(html, { format: 'A4' }).toBuffer((err: any, buffer: Buffer) => {
        if (err) return res.json({ html, error: 'PDF gen failed, showing HTML' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
        res.send(buffer);
      });
    } catch {
      res.json({ html });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// --- Quotes (Phase 2) ---
router.post('/quotes', async (req, res) => {
  try {
    const items = await listData('quotes');
    const quoteNumber = `QTE-${new Date().getFullYear()}-${String(items.length + 1).padStart(4, '0')}`;
    const { clientName, clientEmail, items: lineItems, taxRate = 0, notes, validUntil, createdBy } = req.body;
    const subTotal = (lineItems || []).reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const taxTotal = subTotal * (taxRate / 100);
    const total = subTotal + taxTotal;
    const quote = {
      id: id('qte'), quoteNumber, clientName, clientEmail, items: lineItems || [],
      subTotal, taxRate, taxTotal, total, notes, validUntil,
      status: 'draft', createdBy, createdAt: new Date().toISOString(),
    };
    await setData(`quotes/${quote.id}`, quote);
    res.status(201).json(quote);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

router.get('/quotes', async (req, res) => {
  try {
    let quotes = await listData('quotes');
    const { status } = req.query;
    if (status) quotes = quotes.filter((q: any) => q.status === status);
    res.json(quotes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

router.post('/quotes/:id/convert', async (req, res) => {
  try {
    const quote = await getData(`quotes/${req.params.id}`);
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    quote.status = 'converted';
    await setData(`quotes/${req.params.id}`, quote);
    // Create invoice from quote
    const items = await listData('invoices');
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(items.length + 1).padStart(4, '0')}`;
    const invoice = {
      id: id('inv'), invoiceNumber, clientName: quote.clientName, clientEmail: quote.clientEmail,
      items: quote.items, subTotal: quote.subTotal, taxRate: quote.taxRate,
      taxTotal: quote.taxTotal, total: quote.total,
      status: 'draft', paymentStatus: 'unpaid', quoteId: quote.id,
      createdBy: req.body.createdBy, createdAt: new Date().toISOString(),
    };
    await setData(`invoices/${invoice.id}`, invoice);
    res.status(201).json({ invoice, quote });
  } catch (e) {
    res.status(500).json({ error: 'Failed to convert quote' });
  }
});

// --- Payments (Phase 2) ---
router.post('/payments', async (req, res) => {
  try {
    const items = await listData('payments');
    const paymentNumber = `PAY-${String(items.length + 1).padStart(4, '0')}`;
    const { invoiceId, clientName, amount, paymentMode, reference, notes, createdBy } = req.body;
    const payment = {
      id: id('pay'), paymentNumber, invoiceId, clientName, amount,
      paymentMode: paymentMode || 'cash', reference, notes,
      createdBy, createdAt: new Date().toISOString(),
    };
    await setData(`payments/${payment.id}`, payment);
    // Update invoice payment status
    if (invoiceId) {
      const invoice = await getData(`invoices/${invoiceId}`);
      if (invoice) {
        const allPayments = await listData('payments');
        const invoicePayments = allPayments.filter((p: any) => p.invoiceId === invoiceId);
        const totalPaid = invoicePayments.reduce((s: number, p: any) => s + p.amount, 0) + amount;
        invoice.paymentStatus = totalPaid >= invoice.total ? 'paid' : 'partial';
        invoice.lastPaymentAt = new Date().toISOString();
        await setData(`invoices/${invoiceId}`, invoice);
      }
    }
    res.status(201).json(payment);
  } catch (e) {
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

router.get('/payments', async (req, res) => {
  try {
    let payments = await listData('payments');
    const { invoiceId, paymentMode } = req.query;
    if (invoiceId) payments = payments.filter((p: any) => p.invoiceId === invoiceId);
    if (paymentMode) payments = payments.filter((p: any) => p.paymentMode === paymentMode);
    res.json(payments.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// --- Expenses (Phase 2) ---
router.post('/expenses', async (req, res) => {
  try {
    const expense = { id: id('exp'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`expenses/${expense.id}`, expense);
    res.status(201).json(expense);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

router.get('/expenses', async (req, res) => {
  try {
    let expenses = await listData('expenses');
    const { category, fromDate, toDate } = req.query;
    if (category) expenses = expenses.filter((e: any) => e.category === category);
    if (fromDate) expenses = expenses.filter((e: any) => new Date(e.date) >= new Date(fromDate as string));
    if (toDate) expenses = expenses.filter((e: any) => new Date(e.date) <= new Date(toDate as string));
    res.json(expenses.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// --- Expense Categories (Phase 2) ---
router.post('/expense-categories', async (req, res) => {
  try {
    const cat = { id: id('expcat'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`expenseCategories/${cat.id}`, cat);
    res.status(201).json(cat);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.get('/expense-categories', async (_req, res) => {
  try {
    const cats = await listData('expenseCategories');
    res.json(cats);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// --- Concessions / Discounts (Phase 2) ---
router.post('/concessions', async (req, res) => {
  try {
    const concession = { id: id('con'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`concessions/${concession.id}`, concession);
    res.status(201).json(concession);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create concession' });
  }
});

router.get('/concessions', async (req, res) => {
  try {
    let cons = await listData('concessions');
    const { studentId, type } = req.query;
    if (studentId) cons = cons.filter((c: any) => c.studentId === studentId);
    if (type) cons = cons.filter((c: any) => c.type === type);
    res.json(cons);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch concessions' });
  }
});

// --- Payment Plans (Phase 2) ---
router.post('/payment-plans', async (req, res) => {
  try {
    const plan = { id: id('pp'), ...req.body, status: 'active', createdAt: new Date().toISOString() };
    await setData(`paymentPlans/${plan.id}`, plan);
    res.status(201).json(plan);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create payment plan' });
  }
});

router.get('/payment-plans', async (req, res) => {
  try {
    let plans = await listData('paymentPlans');
    const { studentId, status } = req.query;
    if (studentId) plans = plans.filter((p: any) => p.studentId === studentId);
    if (status) plans = plans.filter((p: any) => p.status === status);
    res.json(plans);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// --- Financial Aid (Phase 2) ---
router.post('/financial-aid', async (req, res) => {
  try {
    const aid = { id: id('faid'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`financialAid/${aid.id}`, aid);
    res.status(201).json(aid);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

router.get('/financial-aid', async (req, res) => {
  try {
    let aidList = await listData('financialAid');
    const { studentId, status } = req.query;
    if (studentId) aidList = aidList.filter((a: any) => a.studentId === studentId);
    if (status) aidList = aidList.filter((a: any) => a.status === status);
    res.json(aidList);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// --- Late Fees (Phase 2) ---
router.post('/late-fees/calculate', async (req, res) => {
  try {
    const { invoiceId } = req.body;
    const invoice = await getData(`invoices/${invoiceId}`);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.paymentStatus === 'paid') return res.json({ lateFee: 0, message: 'Already paid' });
    const dueDate = new Date(invoice.dueDate);
    const now = new Date();
    if (now <= dueDate) return res.json({ lateFee: 0, message: 'Not yet due' });
    const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = (req.body.dailyRate || 0.001);
    const lateFee = invoice.total * dailyRate * daysLate;
    const fee = { id: id('lf'), invoiceId, daysLate, lateFee: Math.round(lateFee * 100) / 100, calculatedAt: new Date().toISOString() };
    await setData(`lateFees/${fee.id}`, fee);
    res.json(fee);
  } catch (e) {
    res.status(500).json({ error: 'Failed to calculate late fee' });
  }
});

// --- Tax Management (Phase 2) ---
router.post('/taxes', async (req, res) => {
  try {
    const tax = { id: id('tax'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`taxes/${tax.id}`, tax);
    res.status(201).json(tax);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create tax' });
  }
});

router.get('/taxes', async (_req, res) => {
  try {
    const taxes = await listData('taxes');
    res.json(taxes);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch taxes' });
  }
});

// --- Payment Modes (Phase 2) ---
router.post('/payment-modes', async (req, res) => {
  try {
    const mode = { id: id('pm'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`paymentModes/${mode.id}`, mode);
    res.status(201).json(mode);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create payment mode' });
  }
});

router.get('/payment-modes', async (_req, res) => {
  try {
    const modes = await listData('paymentModes');
    res.json(modes);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch payment modes' });
  }
});

// --- Transport Billing (Phase 2) ---
router.post('/transport-billing', async (req, res) => {
  try {
    const bill = { id: id('tb'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`transportBilling/${bill.id}`, bill);
    res.status(201).json(bill);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create transport bill' });
  }
});

router.get('/transport-billing', async (req, res) => {
  try {
    let bills = await listData('transportBilling');
    const { studentId, status } = req.query;
    if (studentId) bills = bills.filter((b: any) => b.studentId === studentId);
    if (status) bills = bills.filter((b: any) => b.status === status);
    res.json(bills);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch transport bills' });
  }
});

// --- Procurement (Phase 2) ---
router.post('/procurement/requisitions', async (req, res) => {
  try {
    const reqData = { id: id('prq'), ...req.body, status: 'pending', createdAt: new Date().toISOString() };
    await setData(`procurementRequisitions/${reqData.id}`, reqData);
    res.status(201).json(reqData);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create requisition' });
  }
});

router.get('/procurement/requisitions', async (req, res) => {
  try {
    let reqs = await listData('procurementRequisitions');
    const { status, department } = req.query;
    if (status) reqs = reqs.filter((r: any) => r.status === status);
    if (department) reqs = reqs.filter((r: any) => r.department === department);
    res.json(reqs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch requisitions' });
  }
});

router.post('/procurement/purchase-orders', async (req, res) => {
  try {
    const po = { id: id('po'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`purchaseOrders/${po.id}`, po);
    res.status(201).json(po);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create PO' });
  }
});

router.get('/procurement/purchase-orders', async (req, res) => {
  try {
    let pos = await listData('purchaseOrders');
    const { status, vendorId } = req.query;
    if (status) pos = pos.filter((p: any) => p.status === status);
    if (vendorId) pos = pos.filter((p: any) => p.vendorId === vendorId);
    res.json(pos);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch POs' });
  }
});

router.post('/procurement/vendors', async (req, res) => {
  try {
    const vendor = { id: id('ven'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`vendors/${vendor.id}`, vendor);
    res.status(201).json(vendor);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

router.get('/procurement/vendors', async (_req, res) => {
  try {
    const vendors = await listData('vendors');
    res.json(vendors);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// --- Recurring Invoices (Phase 2) ---
router.post('/recurring-invoices', async (req, res) => {
  try {
    const ri = { id: id('ri'), ...req.body, status: 'active', createdAt: new Date().toISOString() };
    await setData(`recurringInvoices/${ri.id}`, ri);
    res.status(201).json(ri);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create recurring invoice' });
  }
});

router.get('/recurring-invoices', async (_req, res) => {
  try {
    const ris = await listData('recurringInvoices');
    res.json(ris);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch recurring invoices' });
  }
});

// --- Spending Analytics (Phase 2) ---
router.get('/spending-analytics', async (req, res) => {
  try {
    const expenses = await listData('expenses');
    const categories = await listData('expenseCategories');
    const { fromDate, toDate } = req.query;
    let filtered = expenses;
    if (fromDate) filtered = filtered.filter((e: any) => new Date(e.date) >= new Date(fromDate as string));
    if (toDate) filtered = filtered.filter((e: any) => new Date(e.date) <= new Date(toDate as string));
    const totalSpent = filtered.reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const byCategory: Record<string, number> = {};
    for (const e of filtered) {
      byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
    }
    // Budget vs Actuals
    const budgets = await listData('budgets');
    const budgetVsActual = budgets.map((b: any) => ({
      department: b.department, budgeted: b.amount || 0,
      actual: filtered.filter((e: any) => e.department === b.department).reduce((s: number, e: any) => s + (e.amount || 0), 0),
      remaining: (b.amount || 0) - filtered.filter((e: any) => e.department === b.department).reduce((s: number, e: any) => s + (e.amount || 0), 0),
    }));
    res.json({ totalSpent, byCategory, budgetVsActual, count: filtered.length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// --- Fee Automation (Phase 2) ---
router.post('/fee-automation/rules', async (req, res) => {
  try {
    const rule = { id: id('far'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`feeAutomationRules/${rule.id}`, rule);
    res.status(201).json(rule);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

router.get('/fee-automation/rules', async (_req, res) => {
  try {
    const rules = await listData('feeAutomationRules');
    res.json(rules);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

router.post('/fee-automation/run', async (req, res) => {
  try {
    const rules = await listData('feeAutomationRules');
    const students = await listData('users');
    const studentList = students.filter((u: any) => u.role === 'student');
    let generated = 0;
    for (const rule of rules) {
      if (!rule.active) continue;
      const targetStudents = rule.class ? studentList.filter((s: any) => s.class === rule.class) : studentList;
      for (const student of targetStudents) {
        const existingInvoices = await listData('invoices');
        const hasInvoice = existingInvoices.some((i: any) =>
          i.clientEmail === student.email && i.items?.some((it: any) => it.description === rule.description));
        if (!hasInvoice) {
          const items = await listData('invoices');
          const invoiceNumber = `AUTO-${new Date().getFullYear()}-${String(items.length + 1).padStart(4, '0')}`;
          const invoice = {
            id: id('inv'), invoiceNumber, clientName: student.name, clientEmail: student.email,
            items: [{ description: rule.description, quantity: 1, unitPrice: rule.amount }],
            subTotal: rule.amount, taxRate: 0, taxTotal: 0, total: rule.amount,
            status: 'sent', paymentStatus: 'unpaid', dueDate: rule.dueDate,
            autoGenerated: true, createdAt: new Date().toISOString(),
          };
          await setData(`invoices/${invoice.id}`, invoice);
          generated++;
        }
      }
    }
    res.json({ success: true, generated, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: 'Failed to run automation' });
  }
});

// --- Summary endpoint ---
router.get('/dashboard/summary', async (_req, res) => {
  try {
    const invoices = await listData('invoices');
    const payments = await listData('payments');
    const expenses = await listData('expenses');
    const totalInvoiced = invoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
    const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const outstanding = totalInvoiced - totalPaid;
    const overdue = invoices.filter((i: any) => i.paymentStatus !== 'paid' && i.dueDate && new Date(i.dueDate) < new Date());
    res.json({ totalInvoiced, totalPaid, totalExpenses, outstanding, overdueCount: overdue.length, overdueAmount: overdue.reduce((s: number, i: any) => s + ((i.total || 0) - 0), 0) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// --- Frontend-compatible aliases ---

// GET /finance/journal — list all journal entries
router.get('/journal', async (_req, res) => {
  try {
    const entries = await listData('journalEntries');
    res.json(entries.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

// POST /finance/journal — create journal entry
router.post('/journal', async (req, res) => {
  try {
    const entry = { id: id('je'), ...req.body, status: 'draft', createdAt: new Date().toISOString() };
    await setData(`journalEntries/${entry.id}`, entry);
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

// GET /finance/late-fees — list all late fees
router.get('/late-fees', async (_req, res) => {
  try {
    const fees = await listData('lateFees');
    res.json(fees);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch late fees' });
  }
});

// POST /finance/late-fees — create late fee
router.post('/late-fees', async (req, res) => {
  try {
    const existing = await listData('lateFees');
    const fee = { id: id('lf'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`lateFees/${fee.id}`, fee);
    res.status(201).json(fee);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create late fee' });
  }
});

export default router;
