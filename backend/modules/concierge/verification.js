const ProfileDoc = require('../../models/ProfileDoc');
const User = require('../../models/User');

async function recomputeUserVerification(userId){
  const docs = await ProfileDoc.find({ user: userId });
  const set = new Set(docs.map(d=> d.docType));
  // Récupérer rôle utilisateur pour exigences différentes
  const user = await User.findById(userId).select('role');
  const role = user?.role || 'tenant';

  const hasID = set.has('identity_card');
  const hasAddress = set.has('proof_of_address');
  const hasIncomeOrGuarantee = set.has('visale_guarantee') || set.has('proof_of_income');
  const hasRib = set.has('rib');

  let status;
  if (role === 'landlord') {
    // Propriétaire: ID + adresse + RIB => verified ; ID seul => pending ; sinon unverified
    status = (hasID && hasAddress && hasRib) ? 'verified' : (hasID ? 'pending' : 'unverified');
  } else {
    // Locataire: ID + (income ou guarantee) => verified ; ID seul => pending
    status = (hasID && hasIncomeOrGuarantee) ? 'verified' : (hasID ? 'pending' : 'unverified');
  }

  await User.updateOne({ _id: userId }, { $set: { 'verification.status': status, 'verification.updatedAt': new Date() } });
  return status;
}

module.exports = { recomputeUserVerification };
