const request = require('supertest');
const appFactory = require('../../testApp');
const mongoose = require('mongoose');
const Housing = require('../../models/Housing');

let app; let tenantToken; let housingId;

async function registerAndLogin(email, role) {
  await request(app).post('/api/register').send({ name: 'User', email, password: 'Passw0rd!', role });
  const login = await request(app).post('/api/login').send({ email, password: 'Passw0rd!' });
  return login.body.token;
}

describe('Booking pricing breakdown', () => {
  beforeAll(async () => {
    app = await appFactory();
    const landlordToken = await registerAndLogin('owner-book@example.com','landlord');
    tenantToken = await registerAndLogin('tenant-book@example.com','tenant');
    // Retrieve landlord id
    const landlordUser = await mongoose.connection.db.collection('users').findOne({ email: 'owner-book@example.com'});
    const housing = await Housing.create({
      title: 'Logement Pricing',
      description: 'Desc pricing test',
      price: 1000, // loyer mensuel
      location: { address: '1 Rue A', city: 'Paris', zipCode: '75000' },
      type: 'studio',
      landlord: landlordUser._id,
      deposit: 500
    });
    housingId = housing._id;
  });

  test('Reservation includes base + deposit + 40% commission', async () => {
    const start = new Date();
    const end = new Date(Date.now() + 7*86400000); // 7 jours (pour calcul ancien), mais nouveau calcul ne dépend plus des jours pour breakdown
    process.env.RESERVATION_COMMISSION_RATE = '0.4';
    const res = await request(app)
      .post('/api/bookings/create-checkout-session')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ housingId: housingId.toString(), startDate: start.toISOString(), endDate: end.toISOString() });
    expect(res.statusCode).toBe(200);
    const url = res.body.url || '';
    const match = /booking_id=([a-f0-9]{24})/.exec(url);
    expect(match).not.toBeNull();
    const bookingId = match[1];
    const booking = await mongoose.connection.db.collection('bookings').findOne({ _id: new mongoose.Types.ObjectId(bookingId) });
    expect(booking.baseRent).toBe(1000);
    expect(booking.deposit).toBe(500);
    // Commission = 40% de (1000+500)=600
    expect(booking.commission).toBe(600);
    expect(booking.totalAmount).toBe(2100); // 1000 + 500 + 600
  });
});
