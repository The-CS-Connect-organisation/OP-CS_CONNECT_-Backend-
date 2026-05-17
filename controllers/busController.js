import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildPaginatedResponse, parsePagination } from '../utils/pagination.js';
import { getRecord, getRecords, queryRecords, updateRecord, deleteRecord } from '../utils/firebaseDb.js';
import { generateId } from '../utils/generateId.js';

// ── Create Bus ──
export const createBus = asyncHandler(async (req, res) => {
  const busId = generateId();
  const bus = {
    id: busId,
    bus_number: req.body.busNumber || req.body.bus_number,
    license_plate: req.body.licensePlate || req.body.license_plate,
    capacity: req.body.capacity,
    driver_id: req.body.driverId || req.body.driver_id,
    route_id: req.body.routeId || req.body.route_id,
    status: req.body.status || 'active',
    current_location: req.body.currentLocation || req.body.current_location || null,
    last_updated: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`buses/${busId}`, bus);
  res.status(201).json({ success: true, bus });
});

// ── List Buses ──
export const listBuses = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let buses = await getRecords('buses');

  // Apply filters
  if (req.query.status) {
    buses = buses.filter(b => b.status === req.query.status);
  }
  if (req.query.routeId) {
    buses = buses.filter(b => b.route_id === req.query.routeId);
  }
  if (req.query.driverId) {
    buses = buses.filter(b => b.driver_id === req.query.driverId);
  }

  // Sort by created_at descending
  buses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const total = buses.length;
  const items = buses.slice(skip, skip + limit);

  res.json({ success: true, ...buildPaginatedResponse({ items, total, page, limit }) });
});

// ── Get Bus ──
export const getBus = asyncHandler(async (req, res) => {
  const bus = await getRecord(`buses/${req.params.busId}`);
  if (!bus) throw new ApiError(404, 'Bus not found');
  res.json({ success: true, bus });
});

// ── Update Bus ──
export const updateBus = asyncHandler(async (req, res) => {
  const existing = await getRecord(`buses/${req.params.busId}`);
  if (!existing) throw new ApiError(404, 'Bus not found');

  const updated = {
    ...existing,
    ...(req.body.busNumber !== undefined && { bus_number: req.body.busNumber }),
    ...(req.body.license_plate !== undefined && { license_plate: req.body.license_plate }),
    ...(req.body.capacity !== undefined && { capacity: req.body.capacity }),
    ...(req.body.driverId !== undefined && { driver_id: req.body.driverId }),
    ...(req.body.routeId !== undefined && { route_id: req.body.routeId }),
    ...(req.body.status !== undefined && { status: req.body.status }),
    ...(req.body.currentLocation !== undefined && { current_location: req.body.currentLocation }),
    ...(req.body.current_location !== undefined && { current_location: req.body.current_location }),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`buses/${req.params.busId}`, updated);
  res.json({ success: true, bus: updated });
});

// ── Delete Bus ──
export const deleteBus = asyncHandler(async (req, res) => {
  const existing = await getRecord(`buses/${req.params.busId}`);
  if (!existing) throw new ApiError(404, 'Bus not found');

  await deleteRecord(`buses/${req.params.busId}`);
  res.json({ success: true, message: 'Bus deleted successfully' });
});

// ── Create Route ──
export const createRoute = asyncHandler(async (req, res) => {
  const routeId = generateId();
  const route = {
    id: routeId,
    name: req.body.name,
    description: req.body.description || '',
    stops: req.body.stops || [],
    start_time: req.body.startTime || req.body.start_time,
    end_time: req.body.endTime || req.body.end_time,
    total_distance: req.body.totalDistance || req.body.total_distance || 0,
    estimated_duration: req.body.estimatedDuration || req.body.estimated_duration || 0,
    status: req.body.status || 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await updateRecord(`routes/${routeId}`, route);
  res.status(201).json({ success: true, route });
});

// ── List Routes ──
export const listRoutes = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  let routes = await getRecords('routes');

  // Apply filters
  if (req.query.status) {
    routes = routes.filter(r => r.status === req.query.status);
  }

  // Sort by created_at descending
  routes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const total = routes.length;
  const items = routes.slice(skip, skip + limit);

  res.json({ success: true, ...buildPaginatedResponse({ items, total, page, limit }) });
});

// ── Get Route ──
export const getRoute = asyncHandler(async (req, res) => {
  const route = await getRecord(`routes/${req.params.routeId}`);
  if (!route) throw new ApiError(404, 'Route not found');
  res.json({ success: true, route });
});

// ── Update Route ──
export const updateRoute = asyncHandler(async (req, res) => {
  const existing = await getRecord(`routes/${req.params.routeId}`);
  if (!existing) throw new ApiError(404, 'Route not found');

  const updated = {
    ...existing,
    ...(req.body.name !== undefined && { name: req.body.name }),
    ...(req.body.description !== undefined && { description: req.body.description }),
    ...(req.body.stops !== undefined && { stops: req.body.stops }),
    ...(req.body.startTime !== undefined && { start_time: req.body.startTime }),
    ...(req.body.start_time !== undefined && { start_time: req.body.start_time }),
    ...(req.body.endTime !== undefined && { end_time: req.body.endTime }),
    ...(req.body.end_time !== undefined && { end_time: req.body.end_time }),
    ...(req.body.totalDistance !== undefined && { total_distance: req.body.totalDistance }),
    ...(req.body.total_distance !== undefined && { total_distance: req.body.total_distance }),
    ...(req.body.estimatedDuration !== undefined && { estimated_duration: req.body.estimatedDuration }),
    ...(req.body.estimated_duration !== undefined && { estimated_duration: req.body.estimated_duration }),
    ...(req.body.status !== undefined && { status: req.body.status }),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`routes/${req.params.routeId}`, updated);
  res.json({ success: true, route: updated });
});

// ── Delete Route ──
export const deleteRoute = asyncHandler(async (req, res) => {
  const existing = await getRecord(`routes/${req.params.routeId}`);
  if (!existing) throw new ApiError(404, 'Route not found');

  await deleteRecord(`routes/${req.params.routeId}`);
  res.json({ success: true, message: 'Route deleted successfully' });
});

// ── Update Bus Location (Real-time) ──
export const updateBusLocation = asyncHandler(async (req, res) => {
  const { busId } = req.params;
  const { latitude, longitude, speed, heading } = req.body;

  if (!latitude || !longitude) {
    throw new ApiError(400, 'Latitude and longitude are required');
  }

  const existing = await getRecord(`buses/${busId}`);
  if (!existing) throw new ApiError(404, 'Bus not found');

  const location = {
    latitude: Number(latitude),
    longitude: Number(longitude),
    speed: speed ? Number(speed) : 0,
    heading: heading ? Number(heading) : 0,
    timestamp: new Date().toISOString(),
  };

  const updated = {
    ...existing,
    current_location: location,
    last_updated: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await updateRecord(`buses/${busId}`, updated);

  // Emit real-time update via Socket.io
  if (req.io) {
    req.io.emit('bus:location-updated', {
      busId,
      location,
      routeId: existing.route_id,
    });
  }

  res.json({ success: true, bus: updated });
});

// ── Get Bus Location History ──
export const getBusLocationHistory = asyncHandler(async (req, res) => {
  const { busId } = req.params;
  const { startDate, endDate } = req.query;

  // For now, return current location. In production, you'd store location history
  const bus = await getRecord(`buses/${busId}`);
  if (!bus) throw new ApiError(404, 'Bus not found');

  res.json({
    success: true,
    busId,
    currentLocation: bus.current_location,
    lastUpdated: bus.last_updated,
  });
});

// ── Get Active Buses on Route ──
export const getActiveBusesOnRoute = asyncHandler(async (req, res) => {
  const { routeId } = req.params;

  const buses = await queryRecords('buses', (b) => 
    b.route_id === routeId && b.status === 'active'
  );

  res.json({ success: true, routeId, buses });
});
