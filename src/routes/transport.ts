import { Router } from 'express';
import { getData, setData, listData, id, safeUser } from '../firebase';
const router = Router();

router.get('/routes', async (req, res) => {
  try {
    let data = await listData('transportRoutes');
    const { name, driver, vehicle } = req.query;
    if (name) data = data.filter((d: any) => d.name?.toLowerCase().includes((name as string).toLowerCase()));
    if (driver) data = data.filter((d: any) => d.driver === driver);
    if (vehicle) data = data.filter((d: any) => d.vehicle === vehicle);
    const routesWithMeta = data.map((r: any) => ({
      ...r,
      stopCount: r.stops?.length || 0,
      studentCount: r.students?.length || 0,
    }));
    res.json(routesWithMeta);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

router.post('/routes', async (req, res) => {
  try {
    const { name, stops, driver, vehicle, schedule } = req.body;
    if (!name) return res.status(400).json({ error: 'Route name is required' });
    const route = { id: id('tr'), name, stops: stops || [], driver: driver || '', vehicle: vehicle || '', schedule: schedule || '', status: 'active', students: [], createdAt: new Date().toISOString() };
    await setData(`transportRoutes/${route.id}`, route);
    res.status(201).json(route);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create route' });
  }
});

router.put('/routes/:id', async (req, res) => {
  try {
    const existing = await getData(`transportRoutes/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Route not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`transportRoutes/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update route' });
  }
});

router.get('/vehicles', async (req, res) => {
  try {
    let data = await listData('fleetVehicles');
    const { status, model } = req.query;
    if (status) data = data.filter((d: any) => d.status === status);
    if (model) data = data.filter((d: any) => d.model?.toLowerCase().includes((model as string).toLowerCase()));
    const now = new Date();
    data = data.map((v: any) => ({ ...v, insuranceExpired: v.insuranceExpiry ? new Date(v.insuranceExpiry) < now : false }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

router.post('/vehicles', async (req, res) => {
  try {
    const { registration, model, capacity, year, insuranceExpiry } = req.body;
    if (!registration) return res.status(400).json({ error: 'Registration number is required' });
    const vehicle = { id: id('veh'), registration, model: model || '', capacity: capacity || 0, year: year || new Date().getFullYear(), insuranceExpiry: insuranceExpiry || '', status: 'active', createdAt: new Date().toISOString() };
    await setData(`fleetVehicles/${vehicle.id}`, vehicle);
    res.status(201).json(vehicle);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

router.put('/vehicles/:id', async (req, res) => {
  try {
    const existing = await getData(`fleetVehicles/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Vehicle not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`fleetVehicles/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

router.get('/maintenance', async (req, res) => {
  try {
    let data = await listData('fleetMaintenance');
    const { vehicleId, type, vendor } = req.query;
    if (vehicleId) data = data.filter((d: any) => d.vehicleId === vehicleId);
    if (type) data = data.filter((d: any) => d.type === type);
    if (vendor) data = data.filter((d: any) => d.vendor?.toLowerCase().includes((vendor as string).toLowerCase()));
    res.json(data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch maintenance records' });
  }
});

router.post('/maintenance', async (req, res) => {
  try {
    const { vehicleId, date, type, description, cost, vendor, nextDue } = req.body;
    if (!vehicleId || !type) return res.status(400).json({ error: 'VehicleId and type are required' });
    const record = { id: id('mnt'), vehicleId, date: date || new Date().toISOString().split('T')[0], type, description: description || '', cost: cost || 0, vendor: vendor || '', nextDue: nextDue || '', status: 'completed', createdAt: new Date().toISOString() };
    await setData(`fleetMaintenance/${record.id}`, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log maintenance' });
  }
});

router.get('/drivers', async (req, res) => {
  try {
    let data = await listData('transportDrivers');
    const { status, name } = req.query;
    if (status) data = data.filter((d: any) => d.status === status);
    if (name) data = data.filter((d: any) => d.name?.toLowerCase().includes((name as string).toLowerCase()));
    const now = new Date();
    data = data.map((d: any) => ({ ...d, licenseExpired: d.expiryDate ? new Date(d.expiryDate) < now : false }));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

router.post('/drivers', async (req, res) => {
  try {
    const { name, license, contact, expiryDate } = req.body;
    if (!name || !license) return res.status(400).json({ error: 'Name and license are required' });
    const driver = { id: id('drv'), name, license, contact: contact || '', expiryDate: expiryDate || '', status: 'active', createdAt: new Date().toISOString() };
    await setData(`transportDrivers/${driver.id}`, driver);
    res.status(201).json(driver);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add driver' });
  }
});

router.put('/drivers/:id', async (req, res) => {
  try {
    const existing = await getData(`transportDrivers/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Driver not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`transportDrivers/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update driver' });
  }
});

router.get('/tracking/:vehicleId', async (req, res) => {
  try {
    const data = await getData(`vehicleTracking/${req.params.vehicleId}`);
    res.json(data || {});
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch tracking data' });
  }
});

router.post('/tracking/:vehicleId', async (req, res) => {
  try {
    const { lat, lng, speed } = req.body;
    if (lat === undefined || lng === undefined) return res.status(400).json({ error: 'Latitude and longitude are required' });
    const position = { lat, lng, speed: speed || 0, timestamp: new Date().toISOString() };
    await setData(`vehicleTracking/${req.params.vehicleId}`, position);
    res.status(201).json(position);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update GPS position' });
  }
});

router.get('/ridership', async (req, res) => {
  try {
    let data = await listData('ridershipRecords');
    const { routeId, studentId, startDate, endDate } = req.query;
    if (routeId) data = data.filter((d: any) => d.routeId === routeId);
    if (studentId) data = data.filter((d: any) => d.studentId === studentId);
    if (startDate) data = data.filter((d: any) => new Date(d.date) >= new Date(startDate as string));
    if (endDate) data = data.filter((d: any) => new Date(d.date) <= new Date(endDate as string));
    res.json(data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch ridership records' });
  }
});

router.post('/ridership', async (req, res) => {
  try {
    const { routeId, studentId, date, boarded, alighted, time } = req.body;
    if (!routeId || !date) return res.status(400).json({ error: 'RouteId and date are required' });
    const record = { id: id('ride'), routeId, studentId: studentId || '', date, boarded: boarded || false, alighted: alighted || false, time: time || '', createdAt: new Date().toISOString() };
    await setData(`ridershipRecords/${record.id}`, record);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log ridership' });
  }
});

router.get('/geofences', async (req, res) => {
  try {
    let data = await listData('geofenceZones');
    const { name } = req.query;
    if (name) data = data.filter((d: any) => d.name?.toLowerCase().includes((name as string).toLowerCase()));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch geofences' });
  }
});

router.post('/geofences', async (req, res) => {
  try {
    const { name, coordinates, radius, alertOnEntry, alertOnExit } = req.body;
    if (!name || !coordinates) return res.status(400).json({ error: 'Name and coordinates are required' });
    const geofence = { id: id('geo'), name, coordinates, radius: radius || 100, alertOnEntry: alertOnEntry ?? true, alertOnExit: alertOnExit ?? true, createdAt: new Date().toISOString() };
    await setData(`geofenceZones/${geofence.id}`, geofence);
    res.status(201).json(geofence);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create geofence' });
  }
});

router.get('/delays', async (req, res) => {
  try {
    let data = await listData('delayReports');
    const { routeId, reason } = req.query;
    if (routeId) data = data.filter((d: any) => d.routeId === routeId);
    if (reason) data = data.filter((d: any) => d.reason?.toLowerCase().includes((reason as string).toLowerCase()));
    res.json(data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch delay reports' });
  }
});

router.post('/delays', async (req, res) => {
  try {
    const { routeId, date, delayMinutes, reason } = req.body;
    if (!routeId || delayMinutes === undefined) return res.status(400).json({ error: 'RouteId and delayMinutes are required' });
    const report = { id: id('del'), routeId, date: date || new Date().toISOString().split('T')[0], delayMinutes, reason: reason || '', notified: false, createdAt: new Date().toISOString() };
    await setData(`delayReports/${report.id}`, report);
    res.status(201).json(report);
  } catch (e) {
    res.status(500).json({ error: 'Failed to report delay' });
  }
});

router.get('/route-changes', async (req, res) => {
  try {
    let data = await listData('routeChangeRequests');
    const { studentId, status } = req.query;
    if (studentId) data = data.filter((d: any) => d.studentId === studentId);
    if (status) data = data.filter((d: any) => d.status === status);
    res.json(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch route change requests' });
  }
});

router.post('/route-changes', async (req, res) => {
  try {
    const { studentId, fromRoute, toRoute, reason } = req.body;
    if (!studentId || !fromRoute || !toRoute) return res.status(400).json({ error: 'StudentId, fromRoute, and toRoute are required' });
    const request = { id: id('rc'), studentId, fromRoute, toRoute, reason: reason || '', status: 'pending', createdAt: new Date().toISOString() };
    await setData(`routeChangeRequests/${request.id}`, request);
    res.status(201).json(request);
  } catch (e) {
    res.status(500).json({ error: 'Failed to request route change' });
  }
});

router.put('/route-changes/:id/:action', async (req, res) => {
  try {
    const { id, action } = req.params;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Action must be approve or reject' });
    const existing = await getData(`routeChangeRequests/${id}`);
    if (!existing) return res.status(404).json({ error: 'Route change request not found' });
    existing.status = action === 'approve' ? 'approved' : 'rejected';
    existing[action === 'approve' ? 'approvedAt' : 'rejectedAt'] = new Date().toISOString();
    existing.handledBy = req.body.handledBy || '';
    existing.comments = req.body.comments || '';
    await setData(`routeChangeRequests/${id}`, existing);
    res.json(existing);
  } catch (e) {
    res.status(500).json({ error: `Failed to ${req.params.action} route change` });
  }
});

export default router;
