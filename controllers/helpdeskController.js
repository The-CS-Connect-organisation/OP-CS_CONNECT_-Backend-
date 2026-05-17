import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getRecord, getRecords, queryRecords, createRecord, updateRecord } from '../utils/firebaseDb.js';
import { getIO } from '../utils/socket.js';
import { generateId } from '../utils/generateId.js';

export const createTicket = asyncHandler(async (req, res) => {
  const { subject, description, category, priority, deviceId, screenshots } = req.body;

  const ticketId = generateId();
  const ticket = {
    id: ticketId,
    subject,
    description,
    category: category || 'general',
    priority: priority || 'medium',
    deviceId: deviceId || null,
    screenshots: screenshots || [],
    status: 'open',
    createdBy: req.user.id,
    createdByName: req.user.name,
    assignedTo: null,
    assignedToName: null,
    notes: [],
    history: [{
      action: 'created',
      by: req.user.name,
      at: new Date().toISOString(),
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await createRecord(`helpdesk_tickets/${ticketId}`, ticket);

  // Notify IT/admin
  const io = getIO();
  if (io) {
    io.emit('helpdesk:new-ticket', { ticketId, subject, priority });
  }

  res.status(201).json({ success: true, ticket });
});

export const getTickets = asyncHandler(async (req, res) => {
  const { status, category, priority, page = 1, limit = 20 } = req.query;

  let tickets = await getRecords('helpdesk_tickets');

  // Filter by role — users only see their own tickets, admins/IT see all
  if (['student', 'teacher', 'parent'].includes(req.user.role)) {
    tickets = tickets.filter(t => t.createdBy === req.user.id);
  }

  if (status) tickets = tickets.filter(t => t.status === status);
  if (category) tickets = tickets.filter(t => t.category === category);
  if (priority) tickets = tickets.filter(t => t.priority === priority);

  tickets.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
  });

  const total = tickets.length;
  const skip = (page - 1) * limit;

  res.json({
    success: true,
    tickets: tickets.slice(skip, skip + limit),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

export const updateTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { status, priority, notes } = req.body;

  const ticket = await getRecord(`helpdesk_tickets/${ticketId}`);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  // Users can only update their own tickets
  if (ticket.createdBy !== req.user.id && !['admin', 'manager'].includes(req.user.role)) {
    throw new ApiError(403, 'Not authorized');
  }

  const updates = {
    ...(status && { status }),
    ...(priority && { priority }),
    ...(notes && { notes: [...(ticket.notes || []), { text: notes, by: req.user.name, at: new Date().toISOString() }] }),
    updatedAt: new Date().toISOString(),
  };

  // Add to history
  const historyEntry = {
    action: status ? `status:${status}` : 'updated',
    by: req.user.name,
    at: new Date().toISOString(),
  };
  updates.history = [...(ticket.history || []), historyEntry];

  await updateRecord(`helpdesk_tickets/${ticketId}`, updates);

  res.json({ success: true, message: 'Ticket updated' });
});

export const assignTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { assignedTo, notes } = req.body;

  const ticket = await getRecord(`helpdesk_tickets/${ticketId}`);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  const assignee = await getRecord(`users/${assignedTo}`);
  if (!assignee) throw new ApiError(404, 'Assignee not found');

  const historyEntry = {
    action: `assigned to ${assignee.name}`,
    by: req.user.name,
    at: new Date().toISOString(),
  };
  if (notes) historyEntry.notes = notes;

  await updateRecord(`helpdesk_tickets/${ticketId}`, {
    assignedTo,
    assignedToName: assignee.name,
    status: 'in_progress',
    history: [...(ticket.history || []), historyEntry],
    updatedAt: new Date().toISOString(),
  });

  // Notify assignee
  const io = getIO();
  if (io) {
    io.to(`user:${assignedTo}`).emit('helpdesk:assigned', { ticketId, subject: ticket.subject });
  }

  res.json({ success: true, message: `Ticket assigned to ${assignee.name}` });
});

export const resolveTicket = asyncHandler(async (req, res) => {
  const { ticketId } = req.params;
  const { resolution, notes } = req.body;

  const ticket = await getRecord(`helpdesk_tickets/${ticketId}`);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  await updateRecord(`helpdesk_tickets/${ticketId}`, {
    status: 'resolved',
    resolution: resolution || null,
    resolvedBy: req.user.id,
    resolvedByName: req.user.name,
    history: [...(ticket.history || []), {
      action: 'resolved',
      by: req.user.name,
      resolution,
      at: new Date().toISOString(),
    }],
    ...(notes && { notes: [...(ticket.notes || []), { text: notes, by: req.user.name, at: new Date().toISOString() }] }),
    updatedAt: new Date().toISOString(),
  });

  res.json({ success: true, message: 'Ticket resolved' });
});

export const getDeviceInventory = asyncHandler(async (req, res) => {
  const devices = await getRecords('devices');
  const totalDevices = devices.length;
  const available = devices.filter(d => d.status === 'available').length;
  const assigned = devices.filter(d => d.status === 'assigned').length;
  const maintenance = devices.filter(d => d.status === 'maintenance').length;

  res.json({
    success: true,
    inventory: {
      total: totalDevices,
      available,
      assigned,
      maintenance,
      devices: devices.slice(0, 50), // Paginate in real implementation
    },
  });
});

export const requestDevice = asyncHandler(async (req, res) => {
  const { deviceType, quantity, reason, requestedDate, classId } = req.body;

  const requestId = generateId();
  const request = {
    id: requestId,
    deviceType: deviceType || 'laptop',
    quantity,
    reason,
    requestedDate,
    classId: classId || null,
    status: 'pending',
    requestedBy: req.user.id,
    requestedByName: req.user.name,
    approvedBy: null,
    createdAt: new Date().toISOString(),
  };

  await createRecord(`device_requests/${requestId}`, request);

  // Notify admins
  const io = getIO();
  if (io) {
    io.emit('helpdesk:device-request', { requestId, deviceType, quantity });
  }

  res.status(201).json({ success: true, request });
});