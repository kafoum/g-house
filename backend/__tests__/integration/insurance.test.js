const request = require('supertest');
const appFactory = require('../../testApp');
const mongoose = require('mongoose');
const Housing = require('../../models/Housing');

let app; let token; let housingId;

async function registerAndLogin(email) {
  await request(app).post('/api/register').send({ name: 'Owner', email, password: 'Passw0rd!' });
  const login = await request(app).post('/api/login').send({ email, password: 'Passw0rd!' });
  return login.body.token;
}

describe('Insurance Policies', () => {
  beforeAll(async () => {
    app = await appFactory();
    token = await registerAndLogin('landlord@example.com');
    const landlordUser = await mongoose.connection.db.collection('users').findOne({ email: 'landlord@example.com'});
    const housing = await Housing.create({
      title: 'Studio Test',
      description: 'Desc',
      price: 500,
      location: { address: '123 Rue Test', city: 'Paris', zipCode: '75000' },
      type: 'studio',
      landlord: landlordUser._id
    });
    housingId = housing._id;
  });

  test('Create policy ok then reject overlapping', async () => {
    const start = new Date();
    const end = new Date(Date.now()+86400000);
    const res = await request(app)
      .post('/api/insurance/policies')
      .set('Authorization', `Bearer ${token}`)
      .send({ housing: housingId.toString(), provider: 'AXA', coverageType: 'basic', startDate: start.toISOString(), endDate: end.toISOString(), priceMonthly: 20 });
    expect(res.statusCode).toBe(201);
    expect(res.body.policy.provider).toBe('AXA');

    const overlapRes = await request(app)
      .post('/api/insurance/policies')
      .set('Authorization', `Bearer ${token}`)
      .send({ housing: housingId.toString(), provider: 'Allianz', coverageType: 'premium', startDate: start.toISOString(), endDate: new Date(Date.now()+3*86400000).toISOString(), priceMonthly: 30 });
    expect(overlapRes.statusCode).toBe(400);
  });
});
