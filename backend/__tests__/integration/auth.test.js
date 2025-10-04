const request = require('supertest');
require('dotenv').config();
const mongoose = require('mongoose');
const appFactory = require('../../testApp');

let app; 

describe('Auth API', () => {
  beforeAll(async () => {
    app = await appFactory();
  });

  afterAll(async () => {
    // Connection & DB handled in global teardown (jest.setup.js)
  });

  test('Register user', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ name: 'Test', email: 'test@example.com', password: 'pass1234' });
    expect([200,201]).toContain(res.statusCode);
  });

  test('Login user', async () => {
    await request(app)
      .post('/api/register')
      .send({ name: 'User2', email: 'user2@example.com', password: 'pass1234' });

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'user2@example.com', password: 'pass1234' });
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});
