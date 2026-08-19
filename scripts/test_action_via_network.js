// Test the loginAction Server Action via a real HTTP POST request
// Now tests with plain string arguments (not FormData)
const http = require('http');

const actionId = '600349b24fba9ba947d1cc97b59c8150531e29e430';

// Next.js Server Actions with plain args use JSON-like RSC encoding
// The client sends the args as a Flight request body
// For plain string args, we can use the standard multipart encoding
// but with the action args serialized differently.

// Actually, for non-FormData server actions, Next.js sends the args
// as a text/x-component body (React Flight protocol).
// Let's simulate what the browser sends.

const args = JSON.stringify(['classrep@gmail.com', 'saran@2007']);

// The flight protocol encodes args as: [arg1, arg2]
// sent as the request body with content-type text/plain
const body = args;

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/login',
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain;charset=UTF-8',
    'Next-Action': actionId,
    'Accept': 'text/x-component',
    'Content-Length': Buffer.byteLength(body),
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Login Response Status:', res.statusCode);
    console.log('Login Response Headers:', JSON.stringify(res.headers, null, 2));
    console.log('Login Response Body:', data);
    
    if (res.statusCode === 200 || res.statusCode === 303) {
      console.log('\n✅ LOGIN SUCCEEDED - No 500 error!');
    } else if (res.statusCode === 500) {
      console.log('\n❌ LOGIN FAILED - Still getting 500 error');
    } else {
      console.log('\n⚠️  Unexpected status code:', res.statusCode);
    }
  });
});

req.on('error', (err) => {
  console.error('Test run failed:', err);
});

req.write(body);
req.end();

console.log('Sending login POST request with plain string args...');
