import { Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';
const router = Router();

router.get('/menus', async (req, res) => {
  try {
    let data = await listData('foodMenus');
    const { date, mealType } = req.query;
    if (date) data = data.filter((d: any) => d.date === date);
    if (mealType) data = data.filter((d: any) => d.mealType === mealType);
    res.json(data.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch menus' });
  }
});

router.post('/menus', async (req, res) => {
  try {
    const { date, mealType, items, description, nutritionalInfo } = req.body;
    if (!date || !mealType) return res.status(400).json({ error: 'Date and mealType are required' });
    const menu = { id: id('menu'), date, mealType, items: items || [], description: description || '', nutritionalInfo: nutritionalInfo || {}, createdAt: new Date().toISOString() };
    await setData(`foodMenus/${menu.id}`, menu);
    res.status(201).json(menu);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create menu' });
  }
});

router.put('/menus/:id', async (req, res) => {
  try {
    const existing = await getData(`foodMenus/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Menu not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`foodMenus/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update menu' });
  }
});

router.get('/preorders', async (req, res) => {
  try {
    let data = await listData('mealPreorders');
    const { studentId, date, mealType } = req.query;
    if (studentId) data = data.filter((d: any) => d.studentId === studentId);
    if (date) data = data.filter((d: any) => d.date === date);
    if (mealType) data = data.filter((d: any) => d.mealType === mealType);
    res.json(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch preorders' });
  }
});

router.post('/preorders', async (req, res) => {
  try {
    const { studentId, date, mealType, menuId, items } = req.body;
    if (!studentId || !date || !mealType) return res.status(400).json({ error: 'StudentId, date, and mealType are required' });
    const preorder = { id: id('po'), studentId, date, mealType, menuId: menuId || '', items: items || [], status: 'confirmed', createdAt: new Date().toISOString() };
    await setData(`mealPreorders/${preorder.id}`, preorder);
    res.status(201).json(preorder);
  } catch (e) {
    res.status(500).json({ error: 'Failed to place preorder' });
  }
});

router.get('/pos', async (req, res) => {
  try {
    let data = await listData('posTransactions');
    const { studentId, paymentMethod, startDate, endDate } = req.query;
    if (studentId) data = data.filter((d: any) => d.studentId === studentId);
    if (paymentMethod) data = data.filter((d: any) => d.paymentMethod === paymentMethod);
    if (startDate) data = data.filter((d: any) => new Date(d.date) >= new Date(startDate as string));
    if (endDate) data = data.filter((d: any) => new Date(d.date) <= new Date(endDate as string));
    res.json(data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch POS transactions' });
  }
});

router.post('/pos', async (req, res) => {
  try {
    const { studentId, items, total, paymentMethod } = req.body;
    if (!items || !total) return res.status(400).json({ error: 'Items and total are required' });
    const transaction = { id: id('pos'), studentId: studentId || '', items, total, paymentMethod: paymentMethod || 'cash', date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString() };
    await setData(`posTransactions/${transaction.id}`, transaction);
    res.status(201).json(transaction);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create POS transaction' });
  }
});

router.get('/inventory', async (req, res) => {
  try {
    let data = await listData('foodInventory');
    const { category, name } = req.query;
    if (category) data = data.filter((d: any) => d.category === category);
    if (name) data = data.filter((d: any) => d.name?.toLowerCase().includes((name as string).toLowerCase()));
    const now = new Date();
    data = data.map((i: any) => ({ ...i, expired: i.expiryDate ? new Date(i.expiryDate) < now : false, expiringSoon: i.expiryDate ? (new Date(i.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 7 : false }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch food inventory' });
  }
});

router.post('/inventory', async (req, res) => {
  try {
    const { name, category, quantity, unit, expiryDate, supplier } = req.body;
    if (!name) return res.status(400).json({ error: 'Item name is required' });
    const item = { id: id('finv'), name, category: category || 'general', quantity: quantity || 0, unit: unit || 'pieces', expiryDate: expiryDate || '', supplier: supplier || '', createdAt: new Date().toISOString() };
    await setData(`foodInventory/${item.id}`, item);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
});

router.put('/inventory/:id', async (req, res) => {
  try {
    const existing = await getData(`foodInventory/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Inventory item not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`foodInventory/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

router.get('/recipes', async (req, res) => {
  try {
    let data = await listData('foodRecipes');
    const { name } = req.query;
    if (name) data = data.filter((d: any) => d.name?.toLowerCase().includes((name as string).toLowerCase()));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

router.post('/recipes', async (req, res) => {
  try {
    const { name, ingredients, instructions, servings, nutritionalInfo } = req.body;
    if (!name || !ingredients) return res.status(400).json({ error: 'Name and ingredients are required' });
    const recipe = { id: id('rec'), name, ingredients, instructions: instructions || '', servings: servings || 1, nutritionalInfo: nutritionalInfo || {}, createdAt: new Date().toISOString() };
    await setData(`foodRecipes/${recipe.id}`, recipe);
    res.status(201).json(recipe);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

router.get('/meal-accounts/:studentId', async (req, res) => {
  try {
    const account = await getData(`mealAccounts/${req.params.studentId}`);
    res.json(account || { studentId: req.params.studentId, balance: 0, transactions: [] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch meal account' });
  }
});

router.post('/meal-accounts/:studentId/topup', async (req, res) => {
  try {
    const { amount, method } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
    const account = await getData(`mealAccounts/${req.params.studentId}`) || { studentId: req.params.studentId, balance: 0, transactions: [] };
    account.balance += amount;
    account.transactions.push({ type: 'topup', amount, method: method || 'cash', balance: account.balance, date: new Date().toISOString() });
    await setData(`mealAccounts/${req.params.studentId}`, account);
    res.json(account);
  } catch (e) {
    res.status(500).json({ error: 'Failed to top up meal account' });
  }
});

router.post('/meal-accounts/:studentId/charge', async (req, res) => {
  try {
    const { amount, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
    const account = await getData(`mealAccounts/${req.params.studentId}`) || { studentId: req.params.studentId, balance: 0, transactions: [] };
    if (account.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });
    account.balance -= amount;
    account.transactions.push({ type: 'charge', amount: -amount, description: description || 'meal purchase', balance: account.balance, date: new Date().toISOString() });
    await setData(`mealAccounts/${req.params.studentId}`, account);
    res.json(account);
  } catch (e) {
    res.status(500).json({ error: 'Failed to charge meal account' });
  }
});

router.get('/dietary', async (req, res) => {
  try {
    let data = await listData('dietaryRestrictions');
    const { studentId } = req.query;
    if (studentId) data = data.filter((d: any) => d.studentId === studentId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch dietary restrictions' });
  }
});

router.get('/fsm-eligibility', async (req, res) => {
  try {
    let data = await listData('fsmEligibility');
    const { studentId, eligible } = req.query;
    if (studentId) data = data.filter((d: any) => d.studentId === studentId);
    if (eligible !== undefined) data = data.filter((d: any) => d.eligible === (eligible === 'true'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch FSM eligibility' });
  }
});

router.post('/fsm-eligibility', async (req, res) => {
  try {
    const { studentId, eligible, reason, expiryDate } = req.body;
    if (!studentId) return res.status(400).json({ error: 'StudentId is required' });
    const record = { id: id('fsm'), studentId, eligible: eligible ?? false, reason: reason || '', expiryDate: expiryDate || '', updatedAt: new Date().toISOString() };
    await setData(`fsmEligibility/${record.id}`, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: 'Failed to set FSM eligibility' });
  }
});

router.get('/waste', async (req, res) => {
  try {
    let data = await listData('foodWasteLogs');
    const { mealType, startDate, endDate } = req.query;
    if (mealType) data = data.filter((d: any) => d.mealType === mealType);
    if (startDate) data = data.filter((d: any) => new Date(d.date) >= new Date(startDate as string));
    if (endDate) data = data.filter((d: any) => new Date(d.date) <= new Date(endDate as string));
    res.json(data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch food waste logs' });
  }
});

router.post('/waste', async (req, res) => {
  try {
    const { date, mealType, item, quantity, reason } = req.body;
    if (!date || !item) return res.status(400).json({ error: 'Date and item are required' });
    const log = { id: id('wst'), date, mealType: mealType || '', item, quantity: quantity || 0, unit: 'kg', reason: reason || '', createdAt: new Date().toISOString() };
    await setData(`foodWasteLogs/${log.id}`, log);
    res.status(201).json(log);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log food waste' });
  }
});

export default router;
