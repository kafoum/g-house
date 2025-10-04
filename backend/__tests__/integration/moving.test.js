const request = require('supertest');
const appFactory = require('../../testApp');
let app; let token;

async function registerAndLogin(email) {
  await request(app).post('/api/register').send({ name: 'Mover', email, password: 'Passw0rd!' });
  const login = await request(app).post('/api/login').send({ email, password: 'Passw0rd!' });
  return login.body.token;
}

describe('Moving Requests', () => {
  beforeAll(async () => {
    app = await appFactory();
    token = await registerAndLogin('user-move@example.com');
  });

  test('Create move request', async () => {
    const res = await request(app)
      .post('/api/moving/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ fromAddress: '1 Rue A', toAddress: '2 Rue B', desiredDate: new Date(Date.now()+86400000).toISOString(), volumeM3: 10 });
    expect(res.statusCode).toBe(201);
    expect(res.body.move.status).toBe('requested');
    const id = res.body.move._id;

    const schedule = await request(app)
      .post(`/api/moving/requests/${id}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduledDate: new Date(Date.now()+2*86400000).toISOString() });
    expect(schedule.statusCode).toBe(200);
    expect(schedule.body.move.status).toBe('scheduled');

    const start = await request(app)
      .post(`/api/moving/requests/${id}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(start.statusCode).toBe(200);
    expect(start.body.move.status).toBe('in_progress');

    const complete = await request(app)
      .post(`/api/moving/requests/${id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(complete.statusCode).toBe(200);
    expect(complete.body.move.status).toBe('completed');
  });
});
