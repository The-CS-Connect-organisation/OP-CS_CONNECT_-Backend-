import { Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';
const router = Router();

router.get('/buildings', async (req, res) => {
  try {
    let data = await listData('buildings');
    const { name, code } = req.query;
    if (name) data = data.filter((d: any) => d.name?.toLowerCase().includes((name as string).toLowerCase()));
    if (code) data = data.filter((d: any) => d.code === code);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch buildings' });
  }
});

router.post('/buildings', async (req, res) => {
  try {
    const { name, code, floors, rooms, address } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code are required' });
    const building = { id: id('bldg'), name, code, floors: floors || 0, rooms: rooms || 0, address: address || '', createdAt: new Date().toISOString() };
    await setData(`buildings/${building.id}`, building);
    res.status(201).json(building);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create building' });
  }
});

router.get('/rooms', async (req, res) => {
  try {
    let data = await listData('rooms');
    const { buildingId, floor, type } = req.query;
    if (buildingId) data = data.filter((d: any) => d.buildingId === buildingId);
    if (floor) data = data.filter((d: any) => d.floor === Number(floor));
    if (type) data = data.filter((d: any) => d.type === type);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

router.post('/rooms', async (req, res) => {
  try {
    const { buildingId, floor, number, capacity, type, equipment } = req.body;
    if (!buildingId || !number) return res.status(400).json({ error: 'BuildingId and number are required' });
    const room = { id: id('room'), buildingId, floor: floor || 0, number, capacity: capacity || 0, type: type || 'classroom', equipment: equipment || [], createdAt: new Date().toISOString() };
    await setData(`rooms/${room.id}`, room);
    res.status(201).json(room);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.put('/rooms/:id', async (req, res) => {
  try {
    const existing = await getData(`rooms/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Room not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`rooms/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update room' });
  }
});

router.get('/work-orders', async (req, res) => {
  try {
    let data = await listData('workOrders');
    const { roomId, category, priority, status } = req.query;
    if (roomId) data = data.filter((d: any) => d.roomId === roomId);
    if (category) data = data.filter((d: any) => d.category === category);
    if (priority) data = data.filter((d: any) => d.priority === priority);
    if (status) data = data.filter((d: any) => d.status === status);
    res.json(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch work orders' });
  }
});

router.post('/work-orders', async (req, res) => {
  try {
    const { roomId, category, description, priority, reportedBy } = req.body;
    if (!roomId || !description) return res.status(400).json({ error: 'RoomId and description are required' });
    const order = { id: id('wo'), roomId, category: category || 'general', description, priority: priority || 'medium', reportedBy: reportedBy || '', status: 'open', createdAt: new Date().toISOString() };
    await setData(`workOrders/${order.id}`, order);
    res.status(201).json(order);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

router.put('/work-orders/:id', async (req, res) => {
  try {
    const existing = await getData(`workOrders/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Work order not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`workOrders/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

router.put('/work-orders/:id/assign', async (req, res) => {
  try {
    const existing = await getData(`workOrders/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Work order not found' });
    existing.assignedTo = req.body.assignedTo;
    existing.assignedAt = new Date().toISOString();
    existing.status = 'assigned';
    await setData(`workOrders/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to assign work order' });
  }
});

router.put('/work-orders/:id/complete', async (req, res) => {
  try {
    const existing = await getData(`workOrders/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Work order not found' });
    existing.completedAt = new Date().toISOString();
    existing.completedBy = req.body.completedBy;
    existing.notes = req.body.notes || '';
    existing.status = 'completed';
    await setData(`workOrders/${req.params.id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: 'Failed to complete work order' });
  }
});

router.get('/inspections', async (req, res) => {
  try {
    let data = await listData('inspections');
    const { roomId, inspector } = req.query;
    if (roomId) data = data.filter((d: any) => d.roomId === roomId);
    if (inspector) data = data.filter((d: any) => d.inspector === inspector);
    res.json(data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch inspections' });
  }
});

router.post('/inspections', async (req, res) => {
  try {
    const { roomId, date, inspector, findings, score, followUp } = req.body;
    if (!roomId || !date) return res.status(400).json({ error: 'RoomId and date are required' });
    const inspection = { id: id('insp'), roomId, date, inspector: inspector || '', findings: findings || '', score: score || 0, followUp: followUp || '', createdAt: new Date().toISOString() };
    await setData(`inspections/${inspection.id}`, inspection);
    res.status(201).json(inspection);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create inspection' });
  }
});

router.get('/energy', async (req, res) => {
  try {
    let data = await listData('energyUsage');
    const { startDate, endDate } = req.query;
    if (startDate) data = data.filter((d: any) => new Date(d.date) >= new Date(startDate as string));
    if (endDate) data = data.filter((d: any) => new Date(d.date) <= new Date(endDate as string));
    res.json(data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch energy records' });
  }
});

router.post('/energy', async (req, res) => {
  try {
    const { date, meterReading, cost, notes } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    const record = { id: id('eng'), date, meterReading: meterReading || 0, cost: cost || 0, notes: notes || '', createdAt: new Date().toISOString() };
    await setData(`energyUsage/${record.id}`, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log energy usage' });
  }
});

router.get('/supply-audit', async (req, res) => {
  try {
    let data = await listData('supplyInventory');
    const { item, location } = req.query;
    if (item) data = data.filter((d: any) => d.item?.toLowerCase().includes((item as string).toLowerCase()));
    if (location) data = data.filter((d: any) => d.location === location);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch supply inventory' });
  }
});

router.post('/supply-audit', async (req, res) => {
  try {
    const { item, quantity, minThreshold, location } = req.body;
    if (!item) return res.status(400).json({ error: 'Item name is required' });
    const entry = { id: id('sup'), item, quantity: quantity || 0, minThreshold: minThreshold || 0, location: location || '', updatedAt: new Date().toISOString() };
    await setData(`supplyInventory/${entry.id}`, entry);
    res.status(201).json(entry);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update supply stock' });
  }
});

router.get('/cleaning', async (req, res) => {
  try {
    let data = await listData('cleaningSchedules');
    const { roomId, assignedTo, day } = req.query;
    if (roomId) data = data.filter((d: any) => d.roomId === roomId);
    if (assignedTo) data = data.filter((d: any) => d.assignedTo === assignedTo);
    if (day) data = data.filter((d: any) => d.day === day);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch cleaning schedules' });
  }
});

router.post('/cleaning', async (req, res) => {
  try {
    const { roomId, frequency, assignedTo, day } = req.body;
    if (!roomId) return res.status(400).json({ error: 'RoomId is required' });
    const schedule = { id: id('cln'), roomId, frequency: frequency || 'daily', assignedTo: assignedTo || '', day: day || '', createdAt: new Date().toISOString() };
    await setData(`cleaningSchedules/${schedule.id}`, schedule);
    res.status(201).json(schedule);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create cleaning schedule' });
  }
});

router.get('/visitors', async (req, res) => {
  try {
    let data = await listData('visitorLogs');
    const { host, organization } = req.query;
    if (host) data = data.filter((d: any) => d.host === host);
    if (organization) data = data.filter((d: any) => d.organization?.toLowerCase().includes((organization as string).toLowerCase()));
    res.json(data.sort((a: any, b: any) => new Date(b.checkIn || b.createdAt).getTime() - new Date(a.checkIn || a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch visitor logs' });
  }
});

router.post('/visitors', async (req, res) => {
  try {
    const { name, organization, host, purpose, checkIn, checkOut, badge } = req.body;
    if (!name) return res.status(400).json({ error: 'Visitor name is required' });
    const visitor = { id: id('vis'), name, organization: organization || '', host: host || '', purpose: purpose || '', checkIn: checkIn || new Date().toISOString(), checkOut: checkOut || '', badge: badge || '', createdAt: new Date().toISOString() };
    await setData(`visitorLogs/${visitor.id}`, visitor);
    res.status(201).json(visitor);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log visitor' });
  }
});

router.get('/emergency-drills', async (req, res) => {
  try {
    let data = await listData('emergencyDrills');
    const { type } = req.query;
    if (type) data = data.filter((d: any) => d.type === type);
    res.json(data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch emergency drills' });
  }
});

router.post('/emergency-drills', async (req, res) => {
  try {
    const { type, date, duration, participants, notes } = req.body;
    if (!type || !date) return res.status(400).json({ error: 'Type and date are required' });
    const drill = { id: id('drill'), type, date, duration: duration || 0, participants: participants || 0, notes: notes || '', createdAt: new Date().toISOString() };
    await setData(`emergencyDrills/${drill.id}`, drill);
    res.status(201).json(drill);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log emergency drill' });
  }
});

router.get('/safety-incidents', async (req, res) => {
  try {
    let data = await listData('safetyIncidents');
    const { type, severity, location } = req.query;
    if (type) data = data.filter((d: any) => d.type === type);
    if (severity) data = data.filter((d: any) => d.severity === severity);
    if (location) data = data.filter((d: any) => d.location?.toLowerCase().includes((location as string).toLowerCase()));
    res.json(data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch safety incidents' });
  }
});

router.post('/safety-incidents', async (req, res) => {
  try {
    const { type, location, date, description, severity, action } = req.body;
    if (!type || !description) return res.status(400).json({ error: 'Type and description are required' });
    const incident = { id: id('saf'), type, location: location || '', date: date || new Date().toISOString().split('T')[0], description, severity: severity || 'low', action: action || '', status: 'reported', createdAt: new Date().toISOString() };
    await setData(`safetyIncidents/${incident.id}`, incident);
    res.status(201).json(incident);
  } catch (e) {
    res.status(500).json({ error: 'Failed to report safety incident' });
  }
});

export default router;
