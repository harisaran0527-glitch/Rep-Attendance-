const fs = require('fs');
const path = require('path');

const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Riaan', 'Aryan', 'Atharv', 'Krishna', 'Ishaan', 'Shaurya', 'Dhruv', 'Kabir', 'Ayaan', 'Ananya', 'Aadhya', 'Kiara', 'Diya', 'Pihu', 'Saanvi', 'Prisha', 'Avni', 'Myra', 'Kavya', 'Fatima', 'Aisha', 'Zara', 'Mariam', 'Zainab', 'Mohammed', 'Ahmed', 'Omar', 'Ali', 'Hassan', 'Isabella', 'Sophia', 'Mia', 'Charlotte', 'Amelia', 'Liam', 'Noah', 'Oliver', 'Elijah', 'William', 'James', 'Benjamin', 'Lucas', 'Henry', 'Alexander', 'Mason', 'Michael', 'Ethan', 'Daniel', 'Jacob', 'Logan', 'Jackson', 'Levi'];

const lastNames = ['Patel', 'Sharma', 'Singh', 'Kumar', 'Das', 'Roy', 'Gupta', 'Verma', 'Khan', 'Ali', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

const getRand = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateStudents = (count) => {
  let csv = 'Register Number,Student Name,Email,Department,Year,Section\n';
  for (let i = 1; i <= count; i++) {
    const regNo = `2024CS${String(i).padStart(3, '0')}`;
    const name = `${getRand(firstNames)} ${getRand(lastNames)}`;
    const email = `${name.split(' ')[0].toLowerCase()}.${i}@example.edu`;
    const dept = 'CSE';
    const year = 'III';
    const sec = i % 2 === 0 ? 'B' : 'A';
    csv += `${regNo},${name},${email},${dept},${year},${sec}\n`;
  }
  return csv;
};

const output = generateStudents(58);
fs.writeFileSync(path.join(__dirname, 'public', 'sample-students.csv'), output);
console.log('Created sample-students.csv with 58 records.');
