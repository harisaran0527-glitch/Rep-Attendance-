const { hashPassword } = require('./src/lib/crypto');

const target = '65dd77ab7780ee1fb6fdab07ab42d31f8ad239e6f2d7e8748debc1dc792793308b338dd6e60d094ba41b835875b364f61f256896dd60f691a021fa59127af5a2';

const tests = [
  'rathidevi',
  'RATHIDEVI S',
  'RATHIDEVI',
  '25AI&DS131',
  '25ai&ds131',
  '25AI&amp;DS131',
  'password123',
  'student123',
  'student',
  '123456',
];

for (const t of tests) {
  const h = hashPassword(t);
  if (h === target) {
    console.log(`MATCH FOUND! Password is: "${t}"`);
    process.exit(0);
  }
}

console.log('No match found.');
