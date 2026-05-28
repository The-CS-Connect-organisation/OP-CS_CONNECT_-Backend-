import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Client/CRM Management (Phase 2) ---
router.post('/clients', async (req, res) => {
  try {
    const client = { id: id('cli'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`clients/${client.id}`, client);
    res.status(201).json(client);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create client' });
  }
});

router.get('/clients', async (req, res) => {
  try {
    let clients = await listData('clients');
    const { search, status } = req.query;
    if (search) clients = clients.filter((c: any) =>
      c.name?.toLowerCase().includes((search as string).toLowerCase()) ||
      c.email?.toLowerCase().includes((search as string).toLowerCase()) ||
      c.phone?.includes(search as string));
    if (status) clients = clients.filter((c: any) => c.status === status);
    res.json(clients);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

router.put('/clients/:id', async (req, res) => {
  try {
    const existing = await getData(`clients/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`clients/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// --- Leads Pipeline (Phase 2) ---
router.post('/leads', async (req, res) => {
  try {
    const lead = { id: id('ld'), ...req.body, status: 'new', createdAt: new Date().toISOString() };
    await setData(`leads/${lead.id}`, lead);
    res.status(201).json(lead);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.get('/leads', async (req, res) => {
  try {
    let leads = await listData('leads');
    const { status, source, assignedTo } = req.query;
    if (status) leads = leads.filter((l: any) => l.status === status);
    if (source) leads = leads.filter((l: any) => l.source === source);
    if (assignedTo) leads = leads.filter((l: any) => l.assignedTo === assignedTo);
    res.json(leads.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.put('/leads/:id/status', async (req, res) => {
  try {
    const lead = await getData(`leads/${req.params.id}`);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    lead.status = req.body.status;
    lead.updatedAt = new Date().toISOString();
    if (req.body.status === 'converted' && req.body.clientId) {
      lead.clientId = req.body.clientId;
      lead.convertedAt = new Date().toISOString();
    }
    await setData(`leads/${req.params.id}`, lead);
    res.json(lead);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// --- Products Catalogue (Phase 2) ---
router.post('/products', async (req, res) => {
  try {
    const product = { id: id('prd'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`products/${product.id}`, product);
    res.status(201).json(product);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.get('/products', async (req, res) => {
  try {
    let products = await listData('products');
    const { category, search } = req.query;
    if (category) products = products.filter((p: any) => p.category === category);
    if (search) products = products.filter((p: any) =>
      p.name?.toLowerCase().includes((search as string).toLowerCase()) ||
      p.sku?.toLowerCase().includes((search as string).toLowerCase()));
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.put('/products/:id/inventory', async (req, res) => {
  try {
    const product = await getData(`products/${req.params.id}`);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    product.stockQuantity = req.body.quantity;
    product.updatedAt = new Date().toISOString();
    await setData(`products/${req.params.id}`, product);
    res.json(product);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// --- Sales Orders (Phase 2) ---
router.post('/orders', async (req, res) => {
  try {
    const itemsCount = (await listData('orders')).length;
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(itemsCount + 1).padStart(4, '0')}`;
    const { clientId, clientName, items, notes, createdBy } = req.body;
    const total = (items || []).reduce((s: number, i: any) => s + ((i.unitPrice || 0) * (i.quantity || 0)), 0);
    const order = {
      id: id('ord'), orderNumber, clientId, clientName, items: items || [],
      total, notes, status: 'pending',
      createdBy, createdAt: new Date().toISOString(),
    };
    await setData(`orders/${order.id}`, order);
    res.status(201).json(order);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    let orders = await listData('orders');
    const { status, clientId } = req.query;
    if (status) orders = orders.filter((o: any) => o.status === status);
    if (clientId) orders = orders.filter((o: any) => o.clientId === clientId);
    res.json(orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.put('/orders/:id/status', async (req, res) => {
  try {
    const order = await getData(`orders/${req.params.id}`);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    order.status = req.body.status;
    order.updatedAt = new Date().toISOString();
    await setData(`orders/${req.params.id}`, order);
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// --- Company Settings (Phase 2) ---
router.get('/company-settings', async (_req, res) => {
  try {
    const settings = await getData('companySettings');
    res.json(settings || {});
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/company-settings', async (req, res) => {
  try {
    const existing = await getData('companySettings') || {};
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData('companySettings', updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// --- Money Format Settings (Phase 2) ---
router.get('/money-format', async (_req, res) => {
  try {
    const format = await getData('moneyFormat');
    res.json(format || { symbol: '$', position: 'before', decimal: '.', thousand: ',', precision: 2 });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch format' });
  }
});

router.put('/money-format', async (req, res) => {
  try {
    const existing = await getData('moneyFormat') || {};
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData('moneyFormat', updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update format' });
  }
});

export default router;
