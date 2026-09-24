const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../public/js/validation.js');

test('requires a parent/guardian contact whenever any team member is under 18, even for online participation', () => {
  const data = V.createEmptyData();
  data.team.size = '2';
  data.leader.ageGroup = 'adult';
  data.participation.type = 'online';
  data.members = [{ name: 'Test Youth', email: 'youth@example.com', ageGroup: 'minor' }];

  assert.equal(V.anyMinor(data), true);
  assert.equal(V.needsShepherd(data), true);

  const errors = V.validateStep('location', data);
  assert.equal(errors['participation.shepherd.email'], 'Enter the shepherd\'s email address.');
  assert.equal(errors['participation.shepherd.phone'], 'Enter the shepherd\'s phone number.');
});
