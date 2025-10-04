const request = require('supertest');
const mongoose = require('mongoose');
const createTestApp = require('../../testApp');
const User = require('../../models/User');
const Housing = require('../../models/Housing');

let app; let token; let landlordId;

beforeAll(async () => {
  app = await createTestApp();
  // Créer un propriétaire
  const landlord = new User({ name: 'Owner', email: 'owner@example.com', password: 'secret123', role: 'landlord' });
  await landlord.save();
  landlordId = landlord._id;
  // Login pour récupérer token
  await request(app).post('/api/auth/register').send({ name: 'Tenant', email: 'tenant@example.com', password: 'secret123', role: 'tenant' });
  const loginRes = await request(app).post('/api/auth/login').send({ email: 'tenant@example.com', password: 'secret123' });
  token = loginRes.body.token;

  // Insérer logements avec variantes
  await Housing.insertMany([
    { title: 'Logement A', description: 'Desc A', price: 500, location:{ address:'a1', city:'Paris', zipCode:'75001' }, type:'studio', landlord: landlordId, aplEligible: true, furnished: true },
    { title: 'Logement B', description: 'Desc B', price: 600, location:{ address:'b1', city:'Paris', zipCode:'75002' }, type:'T1', landlord: landlordId, aplEligible: false, furnished: true },
    { title: 'Logement C', description: 'Desc C', price: 700, location:{ address:'c1', city:'Lyon', zipCode:'69001' }, type:'T2', landlord: landlordId, aplEligible: true, furnished: false }
  ]);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Housing filters aplEligible & furnished', () => {
  test('Filter list aplEligible=true', async () => {
    const res = await request(app).get('/api/housing?aplEligible=true').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every(h => h.aplEligible === true)).toBe(true);
  });

  test('Filter list furnished=false', async () => {
    const res = await request(app).get('/api/housing?furnished=false').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every(h => h.furnished === false)).toBe(true);
  });
});
