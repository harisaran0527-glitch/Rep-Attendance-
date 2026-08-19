const Module = require('module');
const originalRequire = Module.prototype.require;

// Mock next/headers and next/cache to allow running Next.js Server Actions outside Next.js
Module.prototype.require = function (id) {
  if (id === 'next/headers') {
    return {
      cookies: async () => ({
        set: (name, value, options) => {
          console.log(`[Mock Cookie Set] ${name} = ${value}`);
        },
        get: (name) => {
          console.log(`[Mock Cookie Get] ${name}`);
          return { value: 'classrep@gmail.com' };
        },
        delete: (name) => {
          console.log(`[Mock Cookie Delete] ${name}`);
        }
      })
    };
  }
  if (id === 'next/cache') {
    return {
      revalidatePath: (path) => {
        console.log(`[Mock RevalidatePath] ${path}`);
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

// Now import the login actions
const { loginAction, studentLoginAction } = require('../src/app/actions');

async function test() {
  console.log('=== TESTING ADMIN LOGIN ACTION ===');
  try {
    const adminFormData = {
      get: (key) => {
        if (key === 'email') return 'classrep@gmail.com';
        if (key === 'password') return 'saran@2007';
        return null;
      }
    };

    const res = await loginAction(adminFormData);
    console.log('Admin login response:', res);
  } catch (err) {
    console.error('Admin login threw error:', err);
  }

  console.log('\n=== TESTING STUDENT LOGIN ACTION ===');
  try {
    const studentFormData = {
      get: (key) => {
        if (key === 'email') return 'rathidevi.ad25@avsenggcollege.ac.in';
        if (key === 'password') return '25AI&DS131';
        return null;
      }
    };

    const res = await studentLoginAction(studentFormData);
    console.log('Student login response:', res);
  } catch (err) {
    console.error('Student login threw error:', err);
  }
}

test();
