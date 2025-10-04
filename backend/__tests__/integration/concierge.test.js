const request = require('supertest');
jest.setTimeout(45000);
const appFactory = require('../../testApp');
const mongoose = require('mongoose');
const User = require('../../models/User');
const ProfileDoc = require('../../models/ProfileDoc');
const Housing = require('../../models/Housing');

let app; let token; let userId;

beforeAll(async () => {
  app = await appFactory();
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connection.asPromise();
  }
  const user = await User.create({ name: 'Etudiant', email: 'etu@example.com', password: 'Pass1234!' });
  userId = user._id;
  await ProfileDoc.create({ user: user._id, docType: 'identity_card', docUrl: 'http://x/id.png' });
  await ProfileDoc.create({ user: user._id, docType: 'visale_guarantee', docUrl: 'http://x/visale.pdf' });
  const res = await request(app).post('/api/login').send({ email: 'etu@example.com', password: 'Pass1234!' });
  token = res.body.token;
});

afterAll(async () => { /* cleanup global handled in jest.setup */ });

describe('Concierge Requests', () => {
  it('create concierge request', async () => {
    const payload = {
      budgetMonthly: 800,
      depositBudget: 1000,
      desiredTypes: ['studio','T1'],
      zone: { lat: 48.8566, lon: 2.3522, radiusKm: 4 }
    };
    const res = await request(app).post('/api/concierge/requests')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(201);
    expect(res.body.request.upfrontDeposit).toBeGreaterThanOrEqual(50);
    expect(res.body.request.zoneRadiusKm).toBe(4);
  });

  it('radius search returns inserted housing with geo point', async () => {
    // Créer un housing avec point géo (simulate landlord role override)
    const landlord = await User.create({ name: 'Land', email: 'land@example.com', password: 'Pass1234!', role: 'landlord' });
    await Housing.create({
      title: 'Geo Test', description: 'H1', price: 700,
      location: { address: '1 rue X', city: 'Paris', zipCode: '75000' },
      type: 'studio', landlord: landlord._id,
      locationPoint: { type: 'Point', coordinates: [ 2.3522, 48.8566 ] }
    });
    const res = await request(app)
      .get('/api/housing/search/radius?lat=48.8566&lon=2.3522&radiusKm=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('suggestions endpoint returns list', async () => {
    // créer request
    const payload = { budgetMonthly: 900, depositBudget: 800, desiredTypes: ['studio'], zone: { lat: 48.8566, lon: 2.3522, radiusKm: 3 } };
    const createRes = await request(app).post('/api/concierge/requests')
      .set('Authorization', `Bearer ${token}`)
      .send(payload).expect(201);
    const id = createRes.body.request._id;
    // Ajouter un housing qui match
    const landlord = await User.create({ name: 'L2', email: 'land2@example.com', password: 'Pass1234!', role: 'landlord' });
    await Housing.create({ title: 'Studio Paris', description: 'S', price: 850, location: { address: '2 r Y', city: 'Paris', zipCode: '75000' }, type: 'studio', landlord: landlord._id, locationPoint: { type: 'Point', coordinates: [2.3523, 48.8567] } });
    const resSug = await request(app).get(`/api/concierge/requests/${id}/suggestions`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(resSug.body.count).toBeGreaterThanOrEqual(1);
  });

  it('update status works', async () => {
    const payload = { budgetMonthly: 700, depositBudget: 500, desiredTypes: [], zone: { lat: 48.8566, lon: 2.3522, radiusKm: 2 } };
    const createRes = await request(app).post('/api/concierge/requests').set('Authorization', `Bearer ${token}`).send(payload).expect(201);
    const id = createRes.body.request._id;
    const up = await request(app).patch(`/api/concierge/requests/${id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'in_progress' }).expect(200);
    expect(up.body.request.status).toBe('in_progress');
  });
});

describe('Auto user verification recompute', () => {
  it('sets user verified after docs upload', async () => {
    const u = await User.create({ name: 'Docs U', email: 'docs@example.com', password: 'Pass1234!' });
    // initial unverified
    const fresh = await User.findById(u._id);
    expect(fresh.verification.status).toBe('unverified');
    await ProfileDoc.create({ user: u._id, docType: 'identity_card', docUrl: 'http://x/id2.png' });
    await ProfileDoc.create({ user: u._id, docType: 'proof_of_income', docUrl: 'http://x/inc.pdf' });
    // laisser un micro tick async
    await new Promise(r=> setTimeout(r, 20));
    const updated = await User.findById(u._id);
    expect(['pending','verified']).toContain(updated.verification.status);
    // ajout visale pour forcer verified
    await ProfileDoc.create({ user: u._id, docType: 'visale_guarantee', docUrl: 'http://x/visale2.pdf' });
    await new Promise(r=> setTimeout(r, 20));
    const updated2 = await User.findById(u._id);
    expect(updated2.verification.status).toBe('verified');
  });
});
