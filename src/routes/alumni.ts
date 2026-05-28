import { Router } from 'express';
import { getData, setData, listData, id } from '../firebase';

const router = Router();

// --- Alumni Profiles ---
router.get('/profiles', async (req, res) => {
  try {
    let profiles = await listData('alumniProfiles');
    const { graduationYear, profession, currentInstitution } = req.query;
    if (graduationYear) profiles = profiles.filter((p: any) => p.graduationYear == graduationYear);
    if (profession) profiles = profiles.filter((p: any) => p.profession?.toLowerCase().includes((profession as string).toLowerCase()));
    if (currentInstitution) profiles = profiles.filter((p: any) => p.currentInstitution?.toLowerCase().includes((currentInstitution as string).toLowerCase()));
    res.json(profiles);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch alumni profiles' });
  }
});

router.post('/profiles', async (req, res) => {
  try {
    const profile = { id: id('alp'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`alumniProfiles/${profile.id}`, profile);
    res.status(201).json(profile);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create alumni profile' });
  }
});

router.put('/profiles/:id', async (req, res) => {
  try {
    const existing = await getData(`alumniProfiles/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Profile not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`alumniProfiles/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update alumni profile' });
  }
});

// --- Directory ---
router.get('/directory', async (req, res) => {
  try {
    let profiles = await listData('alumniProfiles');
    const { search, graduationYear, profession } = req.query;
    if (search) {
      const q = (search as string).toLowerCase();
      profiles = profiles.filter((p: any) =>
        p.name?.toLowerCase().includes(q) ||
        p.profession?.toLowerCase().includes(q) ||
        p.currentInstitution?.toLowerCase().includes(q));
    }
    if (graduationYear) profiles = profiles.filter((p: any) => p.graduationYear == graduationYear);
    if (profession) profiles = profiles.filter((p: any) => p.profession?.toLowerCase().includes((profession as string).toLowerCase()));
    res.json(profiles);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch directory' });
  }
});

// --- Alumni News ---
router.get('/news', async (req, res) => {
  try {
    let news = await listData('alumniNews');
    const { authorId, tag } = req.query;
    if (authorId) news = news.filter((n: any) => n.authorId === authorId);
    if (tag) news = news.filter((n: any) => n.tags?.includes(tag));
    res.json(news.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch alumni news' });
  }
});

router.post('/news', async (req, res) => {
  try {
    const newsItem = { id: id('aln'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`alumniNews/${newsItem.id}`, newsItem);
    res.status(201).json(newsItem);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create alumni news' });
  }
});

// --- Fundraising Campaigns ---
router.get('/campaigns', async (req, res) => {
  try {
    let campaigns = await listData('alumniCampaigns');
    const { status } = req.query;
    if (status) campaigns = campaigns.filter((c: any) => c.status === status);
    res.json(campaigns);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    const campaign = { id: id('alc'), ...req.body, raised: req.body.raised || 0, createdAt: new Date().toISOString() };
    await setData(`alumniCampaigns/${campaign.id}`, campaign);
    res.status(201).json(campaign);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

router.put('/campaigns/:id', async (req, res) => {
  try {
    const existing = await getData(`alumniCampaigns/${req.params.id}`);
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    await setData(`alumniCampaigns/${req.params.id}`, updated);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// --- Community Groups ---
router.get('/groups', async (req, res) => {
  try {
    let groups = await listData('alumniGroups');
    const { category, isPublic } = req.query;
    if (category) groups = groups.filter((g: any) => g.category === category);
    if (isPublic !== undefined) groups = groups.filter((g: any) => String(g.isPublic) === isPublic);
    res.json(groups);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const group = { id: id('alg'), ...req.body, members: [], createdAt: new Date().toISOString() };
    await setData(`alumniGroups/${group.id}`, group);
    res.status(201).json(group);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.post('/groups/:id/members', async (req, res) => {
  try {
    const group = await getData(`alumniGroups/${req.params.id}`);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const members = group.members || [];
    if (!members.find((m: any) => m.userId === req.body.userId)) {
      members.push({ userId: req.body.userId, joinedAt: new Date().toISOString() });
    }
    group.members = members;
    await setData(`alumniGroups/${req.params.id}`, group);
    res.json(group);
  } catch (e) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

router.delete('/groups/:id/members/:userId', async (req, res) => {
  try {
    const group = await getData(`alumniGroups/${req.params.id}`);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    group.members = (group.members || []).filter((m: any) => m.userId !== req.params.userId);
    await setData(`alumniGroups/${req.params.id}`, group);
    res.json(group);
  } catch (e) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// --- Community Polls ---
router.get('/polls', async (req, res) => {
  try {
    let polls = await listData('alumniPolls');
    const { createdBy } = req.query;
    if (createdBy) polls = polls.filter((p: any) => p.createdBy === createdBy);
    const now = new Date();
    polls = polls.map((p: any) => ({
      ...p,
      isExpired: p.expiresAt ? new Date(p.expiresAt) < now : false,
    }));
    res.json(polls);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

router.post('/polls', async (req, res) => {
  try {
    const options = (req.body.options || []).map((o: string) => ({ id: id('alpo'), text: o, votes: [] }));
    const poll = { id: id('alp'), question: req.body.question, options, createdBy: req.body.createdBy, expiresAt: req.body.expiresAt, createdAt: new Date().toISOString() };
    await setData(`alumniPolls/${poll.id}`, poll);
    res.status(201).json(poll);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

router.post('/polls/:id/vote', async (req, res) => {
  try {
    const poll = await getData(`alumniPolls/${req.params.id}`);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) return res.status(400).json({ error: 'Poll has expired' });
    const option = poll.options.find((o: any) => o.id === req.body.option);
    if (!option) return res.status(404).json({ error: 'Option not found' });
    if (option.votes.includes(req.body.userId)) return res.status(409).json({ error: 'Already voted' });
    option.votes.push(req.body.userId);
    await setData(`alumniPolls/${req.params.id}`, poll);
    res.json(poll);
  } catch (e) {
    res.status(500).json({ error: 'Failed to cast vote' });
  }
});

// --- Community Events ---
router.get('/events', async (req, res) => {
  try {
    let events = await listData('alumniEvents');
    const { organizerId } = req.query;
    if (organizerId) events = events.filter((e: any) => e.organizerId === organizerId);
    res.json(events.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const event = { id: id('ale'), ...req.body, attendees: [], createdAt: new Date().toISOString() };
    await setData(`alumniEvents/${event.id}`, event);
    res.status(201).json(event);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.post('/events/:id/rsvp', async (req, res) => {
  try {
    const event = await getData(`alumniEvents/${req.params.id}`);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const attendees = event.attendees || [];
    if (event.maxAttendees && attendees.length >= event.maxAttendees) return res.status(400).json({ error: 'Event is full' });
    if (!attendees.find((a: any) => a.userId === req.body.userId)) {
      attendees.push({ userId: req.body.userId, rsvpAt: new Date().toISOString(), status: req.body.status || 'confirmed' });
    }
    event.attendees = attendees;
    await setData(`alumniEvents/${req.params.id}`, event);
    res.json(event);
  } catch (e) {
    res.status(500).json({ error: 'Failed to RSVP to event' });
  }
});

// --- Parent Engagement ---
router.get('/engagement/:parentId', async (req, res) => {
  try {
    const surveys = await listData('parentSurveys');
    const responses = await listData('parentSurveyResponses');
    const conferences = await listData('ptConferences');
    const parentResponses = responses.filter((r: any) => r.parentId === req.params.parentId);
    const parentConferences = conferences.filter((c: any) => c.parentId === req.params.parentId);
    const score = {
      parentId: req.params.parentId,
      surveysCompleted: parentResponses.length,
      totalSurveys: surveys.length,
      conferencesAttended: parentConferences.filter((c: any) => c.status === 'completed').length,
      conferencesBooked: parentConferences.length,
      engagementRate: surveys.length > 0 ? Math.round((parentResponses.length / surveys.length) * 100) : 0,
    };
    res.json(score);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch engagement score' });
  }
});

// --- Parent Surveys ---
router.get('/surveys', async (req, res) => {
  try {
    const surveys = await listData('parentSurveys');
    res.json(surveys);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch surveys' });
  }
});

router.post('/surveys', async (req, res) => {
  try {
    const survey = { id: id('ps'), ...req.body, createdAt: new Date().toISOString() };
    await setData(`parentSurveys/${survey.id}`, survey);
    res.status(201).json(survey);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create survey' });
  }
});

router.post('/surveys/:id/response', async (req, res) => {
  try {
    const survey = await getData(`parentSurveys/${req.params.id}`);
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    const response = { id: id('psr'), surveyId: req.params.id, ...req.body, submittedAt: new Date().toISOString() };
    await setData(`parentSurveyResponses/${response.id}`, response);
    res.status(201).json(response);
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit survey response' });
  }
});

// --- Parent-Teacher Conferences ---
router.get('/pt-conferences', async (req, res) => {
  try {
    let conferences = await listData('ptConferences');
    const { teacherId, parentId, status } = req.query;
    if (teacherId) conferences = conferences.filter((c: any) => c.teacherId === teacherId);
    if (parentId) conferences = conferences.filter((c: any) => c.parentId === parentId);
    if (status) conferences = conferences.filter((c: any) => c.status === status);
    res.json(conferences.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch PT conferences' });
  }
});

router.post('/pt-conferences', async (req, res) => {
  try {
    const booking = { id: id('ptc'), ...req.body, status: req.body.status || 'booked', createdAt: new Date().toISOString() };
    await setData(`ptConferences/${booking.id}`, booking);
    res.status(201).json(booking);
  } catch (e) {
    res.status(500).json({ error: 'Failed to create PT conference booking' });
  }
});

export default router;
