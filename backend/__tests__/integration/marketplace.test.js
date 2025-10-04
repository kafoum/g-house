const request = require('supertest');
const mongoose = require('mongoose');
require('dotenv').config();
const appFactory = require('../../testApp');
const User = require('../../models/User');
const MarketplaceItem = require('../../modules/marketplace/MarketplaceItem');

let app;
let tokenOwner;
let tokenTenant;

async function createUser(name,email,role='tenant') {
  const res = await request(app).post('/api/register').send({ name, email, password: 'Passw0rd!', role });
  return res;
}

async function login(email) {
  const res = await request(app).post('/api/login').send({ email, password: 'Passw0rd!' });
  return res.body.token;
}

describe('Marketplace', () => {
  beforeAll(async () => {
    app = await appFactory();
    await createUser('Owner','owner@example.com','tenant'); // owner can be tenant role here
    await createUser('Buyer','buyer@example.com','tenant');
    tokenOwner = await login('owner@example.com');
    tokenTenant = await login('buyer@example.com');
  });

  afterAll(async () => {
    // Global teardown handles DB cleanup
  });

  test('Create item OK (<=10€)', async () => {
    const res = await request(app)
      .post('/api/marketplace/items')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ title: 'Chaise', description: 'Chaise solide en bois', category: 'meuble', priceUser: 8 });
    expect(res.statusCode).toBe(201);
    expect(res.body.item.totalPrice).toBe(13); // 8 + 5 fee
  });

  test('Reject item >10€', async () => {
    const res = await request(app)
      .post('/api/marketplace/items')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ title: 'Table', description: 'Grande table', category: 'meuble', priceUser: 15 });
    expect(res.statusCode).toBe(400);
  });

  test('Reserve then complete flow', async () => {
    const createRes = await request(app)
      .post('/api/marketplace/items')
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ title: 'Lampe', description: 'Lampe de bureau', category: 'divers', priceUser: 5 });
    const itemId = createRes.body.item._id;

    const reserveRes = await request(app)
      .post(`/api/marketplace/items/${itemId}/reserve`)
      .set('Authorization', `Bearer ${tokenTenant}`);
    expect(reserveRes.statusCode).toBe(200);
    expect(reserveRes.body.item.status).toBe('reserved');

    const completeRes = await request(app)
      .post(`/api/marketplace/items/${itemId}/complete`)
      .set('Authorization', `Bearer ${tokenTenant}`);
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.body.item.status).toBe('given');
  });
});
