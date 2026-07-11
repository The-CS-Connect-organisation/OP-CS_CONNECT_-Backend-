import { Request, Response, Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// GET /api/bus/routes - Get all bus routes
router.get('/routes', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const allRoutes = await listData('busRoutes');
    res.json({
      success: true,
      routes: allRoutes.sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (err) {
    console.error('[Bus] Get routes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bus/assignments - Get all bus assignments
router.get('/assignments', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'transport'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const allAssignments = await listData('busAssignments');
    res.json({
      success: true,
      assignments: allAssignments.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    });
  } catch (err) {
    console.error('[Bus] Get assignments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bus/assignments - Create new bus assignment
router.post('/assignments', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'transport'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { studentId, routeId, pickupStop, dropoffStop } = req.body;
    if (!studentId || !routeId || !pickupStop || !dropoffStop) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const student = await getData(`users/${studentId}`);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const route = await getData(`busRoutes/${routeId}`);
    if (!route) {
      return res.status(404).json({ error: 'Bus route not found' });
    }

    // Check if student already has an assignment
    const existingAssignments = await listData('busAssignments');
    const duplicate = existingAssignments.find(a => a.studentId === studentId);
    if (duplicate) {
      return res.status(409).json({ error: 'Student already has a bus assignment' });
    }

    const assignmentId = id('bus-assignment');
    const assignment = {
      id: assignmentId,
      studentId,
      studentName: student.name,
      routeId,
      routeName: route.name,
      pickupStop,
      dropoffStop,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: requesterId
    };

    await setData(`busAssignments/${assignmentId}`, assignment);
    // Update student's bus assignment
    await setData(`users/${studentId}`, { ...student, busAssignmentId: assignmentId });

    // Send notification to student
    try {
      await fetch(`${req.protocol}://${req.get('host')}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': requesterId },
        body: JSON.stringify({
          recipientIds: [studentId],
          title: 'Bus Assignment Created',
          message: `You have been assigned to bus route ${route.name}. Pickup: ${pickupStop}, Dropoff: ${dropoffStop}`,
          type: 'bus',
          link: '/bus-tracking'
        })
      });
    } catch (notifyErr) {
      console.warn('[Bus] Failed to send notification:', notifyErr);
    }

    res.json({ success: true, assignment });
  } catch (err) {
    console.error('[Bus] Create assignment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bus/assignments/:id - Update bus assignment
router.put('/assignments/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'transport'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const existing = await getData(`busAssignments/${id}`);
    if (!existing) {
      return res.status(404).json({ error: 'Bus assignment not found' });
    }

    const { studentId, routeId, pickupStop, dropoffStop, status, students } = req.body;

    // If updating students list on a bus route (used by AdminBusAssignment page)
    if (students !== undefined) {
      // This is a route-level update (adding/removing students from a bus)
      const route = await getData(`busRoutes/${id}`);
      if (route) {
        await setData(`busRoutes/${id}`, { ...route, students, studentCount: Array.isArray(students) ? students.length : 0 });
        return res.json({ success: true, route: { ...route, students, studentCount: Array.isArray(students) ? students.length : 0 } });
      }
      const legacyRoute = await getData(`routes/${id}`);
      if (legacyRoute) {
        await setData(`routes/${id}`, { ...legacyRoute, students });
        return res.json({ success: true, route: { ...legacyRoute, students } });
      }
      return res.status(404).json({ error: 'Route not found for student update' });
    }

    const updates: any = {};
    if (studentId) updates.studentId = studentId;
    if (routeId) {
      const route = await getData(`busRoutes/${routeId}`);
      if (route) {
        updates.routeId = routeId;
        updates.routeName = route.name;
      }
    }
    if (pickupStop) updates.pickupStop = pickupStop;
    if (dropoffStop) updates.dropoffStop = dropoffStop;
    if (status) updates.status = status;

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await setData(`busAssignments/${id}`, updated);
    res.json({ success: true, assignment: updated });
  } catch (err) {
    console.error('[Bus] Update assignment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bus/assignments/:id - Delete bus assignment
router.delete('/assignments/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'transport'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const assignment = await getData(`busAssignments/${id}`);
    if (!assignment) {
      return res.status(404).json({ error: 'Bus assignment not found' });
    }

    await setData(`busAssignments/${id}`, null);
    // Remove from student profile
    const student = await getData(`users/${assignment.studentId}`);
    if (student) {
      await setData(`users/${assignment.studentId}`, { ...student, busAssignmentId: null });
    }

    res.json({ success: true, message: 'Bus assignment deleted successfully' });
  } catch (err) {
    console.error('[Bus] Delete assignment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bus/location/:routeId - Get current bus location for a route
router.get('/location/:routeId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { routeId } = req.params;
    const route = await getData(`busRoutes/${routeId}`);
    if (!route) {
      return res.status(404).json({ error: 'Bus route not found' });
    }

    // Check if user is assigned to this route
    const userAssignments = await listData('busAssignments');
    const userAssignment = userAssignments.find(a => 
      (a.studentId === requesterId || a.driverId === requesterId) && a.routeId === routeId
    );
    const requesterUser = await getData(`users/${requesterId}`);
    if (!userAssignment && !['admin', 'principal', 'transport'].includes(requesterUser?.role)) {
      return res.status(403).json({ error: 'Forbidden - Not assigned to this route' });
    }

    const currentLocation = await getData(`busLocations/${routeId}`);
    res.json({
      success: true,
      route: { id: routeId, name: route.name },
      currentLocation: currentLocation || { lat: null, lng: null, lastUpdated: null, isActive: false }
    });
  } catch (err) {
    console.error('[Bus] Get location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bus/location/:routeId - Update bus location (for drivers)
router.post('/location/:routeId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { routeId } = req.params;
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Verify user is the driver for this route
    const route = await getData(`busRoutes/${routeId}`);
    if (!route) {
      return res.status(404).json({ error: 'Bus route not found' });
    }
    if (route.driverId !== requesterId) {
      return res.status(403).json({ error: 'Forbidden - Only the assigned driver can update location' });
    }

    const locationData = {
      lat,
      lng,
      lastUpdated: new Date().toISOString(),
      isActive: true
    };
    await setData(`busLocations/${routeId}`, locationData);

    res.json({ success: true, location: locationData });
  } catch (err) {
    console.error('[Bus] Update location error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/bus/student/:studentId - Get bus assignment for a specific student (for parents)
router.get('/student/:studentId', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const { studentId } = req.params;
    // Verify requester is the parent of this student
    const student = await getData(`users/${studentId}`);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    if (student.parentId !== requesterId) {
      const requester = await getData(`users/${requesterId}`);
      if (!['admin', 'principal', 'transport'].includes(requester?.role)) {
        return res.status(403).json({ error: 'Forbidden - Can only view your child\'s bus information' });
      }
    }

    const allAssignments = await listData('busAssignments');
    const assignment = allAssignments.find(a => a.studentId === studentId);
    if (!assignment) {
      return res.json({ success: true, assignment: null, message: 'No bus assignment found' });
    }

    // Get current bus location for the route
    const currentLocation = await getData(`busLocations/${assignment.routeId}`);
    res.json({
      success: true,
      assignment,
      currentLocation
    });
  } catch (err) {
    console.error('[Bus] Get student bus error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/bus/routes - Create new bus route
router.post('/routes', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'transport'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { name, driverId, vehicleNumber, stops } = req.body;
    if (!name || !driverId || !vehicleNumber || !Array.isArray(stops)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const driver = await getData(`users/${driverId}`);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({ error: 'Valid driver not found' });
    }

    const routeId = id('bus-route');
    const route = {
      id: routeId,
      name,
      driverId,
      driverName: driver.name,
      vehicleNumber,
      stops,
      studentCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: requesterId
    };

    await setData(`busRoutes/${routeId}`, route);
    res.json({ success: true, route });
  } catch (err) {
    console.error('[Bus] Create route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/bus/routes/:id - Update bus route
router.put('/routes/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'transport'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const route = await getData(`busRoutes/${id}`);
    if (!route) {
      return res.status(404).json({ error: 'Bus route not found' });
    }

    const { name, driverId, vehicleNumber, stops, isActive } = req.body;
    const updates: any = {};
    if (name) updates.name = name;
    if (driverId) {
      const driver = await getData(`users/${driverId}`);
      if (!driver || driver.role !== 'driver') {
        return res.status(404).json({ error: 'Valid driver not found' });
      }
      updates.driverId = driverId;
      updates.driverName = driver.name;
    }
    if (vehicleNumber) updates.vehicleNumber = vehicleNumber;
    if (stops) updates.stops = stops;
    if (isActive !== undefined) updates.isActive = isActive;

    const updatedRoute = { ...route, ...updates, updatedAt: new Date().toISOString() };
    await setData(`busRoutes/${id}`, updatedRoute);

    res.json({ success: true, route: updatedRoute });
  } catch (err) {
    console.error('[Bus] Update route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/bus/routes/:id - Delete bus route
router.delete('/routes/:id', async (req: Request, res: Response) => {
  try {
    const requesterId = req.headers['x-user-id'] as string;
    if (!requesterId) {
      return res.status(401).json({ error: 'Unauthorized - User ID required' });
    }

    const requester = await getData(`users/${requesterId}`);
    if (!['admin', 'principal', 'transport'].includes(requester?.role)) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    const { id } = req.params;
    const route = await getData(`busRoutes/${id}`);
    if (!route) {
      return res.status(404).json({ error: 'Bus route not found' });
    }

    // Check if any students are assigned to this route
    const assignments = await listData('busAssignments');
    const hasAssignments = assignments.some(a => a.routeId === id);
    if (hasAssignments) {
      return res.status(400).json({ error: 'Cannot delete route with active student assignments' });
    }

    await setData(`busRoutes/${id}`, null);
    await setData(`busLocations/${id}`, null);
    res.json({ success: true, message: 'Bus route deleted successfully' });
  } catch (err) {
    console.error('[Bus] Delete route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;