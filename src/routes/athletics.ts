import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Programmes / Seasons ---
router.get('/programmes', async (_req, res) => {
  try {
    const programmes = await listData('athleticsProgrammes');
    res.json(programmes);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch programmes' });
  }
});

router.post('/programmes', async (req, res) => {
  try {
    const programme = { id: id('ap'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`athleticsProgrammes/${programme.id}`, programme);
    res.status(201).json(programme);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create programme' });
  }
});

router.put('/programmes/:id', async (req, res) => {
  try {
    const existing = await getData(`athleticsProgrammes/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Programme not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`athleticsProgrammes/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update programme' });
  }
});

// --- Teams ---
router.get('/teams', async (req, res) => {
  try {
    let teams = await listData('athleticsTeams');
    const { programmeId, coachId, division } = req.query;
    if (programmeId) teams = teams.filter((t: any) => t.programmeId === programmeId);
    if (coachId) teams = teams.filter((t: any) => t.coachId === coachId);
    if (division) teams = teams.filter((t: any) => t.division === division);
    res.json(teams);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

router.post('/teams', async (req, res) => {
  try {
    const team = { id: id('at'), ...req.body, roster: [], createdAt: new Date().toISOString() };
    await setData(`athleticsTeams/${team.id}`, team);
    res.status(201).json(team);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create team' });
  }
});

router.put('/teams/:id', async (req, res) => {
  try {
    const existing = await getData(`athleticsTeams/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Team not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`athleticsTeams/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update team' });
  }
});

router.post('/teams/:id/roster', async (req, res) => {
  try {
    const team = await getData(`athleticsTeams/${req.params.id}`);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const roster = team.roster || [];
    const entry = { studentId: req.body.studentId, position: req.body.position, jerseyNumber: req.body.jerseyNumber, addedAt: new Date().toISOString() };
    roster.push(entry);
    team.roster = roster;
    await setData(`athleticsTeams/${req.params.id}`, team);
    res.status(201).json(team);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add player to roster' });
  }
});

router.delete('/teams/:id/roster/:studentId', async (req, res) => {
  try {
    const team = await getData(`athleticsTeams/${req.params.id}`);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    team.roster = (team.roster || []).filter((r: any) => r.studentId !== req.params.studentId);
    await setData(`athleticsTeams/${req.params.id}`, team);
    res.json(team);
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove player from roster' });
  }
});

// --- Games / Matches ---
router.get('/games', async (req, res) => {
  try {
    let games = await listData('athleticsGames');
    const { teamId, status, date } = req.query;
    if (teamId) games = games.filter((g: any) => g.homeTeamId === teamId || g.awayTeamId === teamId);
    if (status) games = games.filter((g: any) => g.status === status);
    if (date) games = games.filter((g: any) => g.date === date);
    res.json(games.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

router.post('/games', async (req, res) => {
  try {
    const game = { id: id('ag'), ...req.body, status: req.body.status || 'scheduled', createdAt: new Date().toISOString() };
    await setData(`athleticsGames/${game.id}`, game);
    res.status(201).json(game);
  } catch (e) {
    res.status(500).json({ error: 'Failed to schedule game' });
  }
});

router.put('/games/:id', async (req, res) => {
  try {
    const existing = await getData(`athleticsGames/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Game not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`athleticsGames/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update game' });
  }
});

router.put('/games/:id/result', async (req, res) => {
  try {
    const game = await getData(`athleticsGames/${req.params.id}`);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    game.homeScore = req.body.homeScore;
    game.awayScore = req.body.awayScore;
    game.winner = req.body.winner;
    game.notes = req.body.notes;
    game.status = 'completed';
    game.resultRecordedAt = new Date().toISOString();
    await setData(`athleticsGames/${req.params.id}`, game);
    res.json(game);
  } catch (e) {
    res.status(500).json({ error: 'Failed to record game result' });
  }
});

// --- Coaches ---
router.get('/coaches', async (req, res) => {
  try {
    let coaches = await listData('athleticsCoaches');
    const { sport, status } = req.query;
    if (sport) coaches = coaches.filter((c: any) => c.sport === sport);
    if (status) coaches = coaches.filter((c: any) => c.status === status);
    res.json(coaches);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch coaches' });
  }
});

router.post('/coaches', async (req, res) => {
  try {
    const coach = { id: id('ac'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`athleticsCoaches/${coach.id}`, coach);
    res.status(201).json(coach);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add coach' });
  }
});

// --- Equipment ---
router.get('/equipment', async (req, res) => {
  try {
    let equipment = await listData('athleticsEquipment');
    const { category, condition, location } = req.query;
    if (category) equipment = equipment.filter((e: any) => e.category === category);
    if (condition) equipment = equipment.filter((e: any) => e.condition === condition);
    if (location) equipment = equipment.filter((e: any) => e.location === location);
    res.json(equipment);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

router.post('/equipment', async (req, res) => {
  try {
    const item = { id: id('aeq'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`athleticsEquipment/${item.id}`, item);
    res.status(201).json(item);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add equipment' });
  }
});

router.put('/equipment/:id', async (req, res) => {
  try {
    const existing = await getData(`athleticsEquipment/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Equipment not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`athleticsEquipment/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// --- Injuries ---
router.get('/injuries', async (req, res) => {
  try {
    let injuries = await listData('athleticsInjuries');
    const { studentId, sport, severity } = req.query;
    if (studentId) injuries = injuries.filter((i: any) => i.studentId === studentId);
    if (sport) injuries = injuries.filter((i: any) => i.sport === sport);
    if (severity) injuries = injuries.filter((i: any) => i.severity === severity);
    res.json(injuries.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch injuries' });
  }
});

router.post('/injuries', async (req, res) => {
  try {
    const injury = { id: id('ainj'), ...req.body, cleared: false, loggedAt: new Date().toISOString() };
    await setData(`athleticsInjuries/${injury.id}`, injury);
    res.status(201).json(injury);
  } catch (e) {
    res.status(500).json({ error: 'Failed to log injury' });
  }
});

router.put('/injuries/:id/clear', async (req, res) => {
  try {
    const injury = await getData(`athleticsInjuries/${req.params.id}`);
    if (!injury) return res.status(404).json({ error: 'Injury record not found' });
    injury.cleared = true;
    injury.clearedAt = new Date().toISOString();
    injury.clearedBy = req.body.clearedBy;
    await setData(`athleticsInjuries/${req.params.id}`, injury);
    res.json(injury);
  } catch (e) {
    res.status(500).json({ error: 'Failed to clear injury' });
  }
});

// --- Medical Clearance ---
router.get('/medical-clearance', async (req, res) => {
  try {
    let clearances = await listData('athleticsMedicalClearance');
    const { studentId, sport } = req.query;
    if (studentId) clearances = clearances.filter((c: any) => c.studentId === studentId);
    if (sport) clearances = clearances.filter((c: any) => c.sport === sport);
    res.json(clearances);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch medical clearances' });
  }
});

router.post('/medical-clearance', async (req, res) => {
  try {
    const clearance = { id: id('amc'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`athleticsMedicalClearance/${clearance.id}`, clearance);
    res.status(201).json(clearance);
  } catch (e) {
    res.status(500).json({ error: 'Failed to add medical clearance' });
  }
});

// --- Stats ---
router.get('/stats/:teamId', async (req, res) => {
  try {
    const team = await getData(`athleticsTeams/${req.params.teamId}`);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const games = await listData('athleticsGames');
    const teamGames = games.filter((g: any) => g.homeTeamId === req.params.teamId || g.awayTeamId === req.params.teamId);
    const wins = teamGames.filter((g: any) => g.winner === req.params.teamId).length;
    const losses = teamGames.filter((g: any) => g.winner && g.winner !== req.params.teamId).length;
    const totalScored = teamGames.reduce((s: number, g: any) => s + (g.homeTeamId === req.params.teamId ? (g.homeScore || 0) : (g.awayScore || 0)), 0);
    const totalConceded = teamGames.reduce((s: number, g: any) => s + (g.homeTeamId === req.params.teamId ? (g.awayScore || 0) : (g.homeScore || 0)), 0);
    res.json({ teamId: req.params.teamId, teamName: team.name, gamesPlayed: teamGames.length, wins, losses, totalScored, totalConceded });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch team stats' });
  }
});

router.get('/stats/:teamId/players/:studentId', async (req, res) => {
  try {
    const team = await getData(`athleticsTeams/${req.params.teamId}`);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const player = (team.roster || []).find((r: any) => r.studentId === req.params.studentId);
    if (!player) return res.status(404).json({ error: 'Player not found in team' });
    res.json({ teamId: req.params.teamId, studentId: req.params.studentId, position: player.position, jerseyNumber: player.jerseyNumber, ...req.query });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

export default router;
