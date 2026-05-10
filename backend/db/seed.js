import pool from './supabase.js';

const DEMO_SESSION_ID = '00000000-0000-0000-0000-000000000001';

const questions = [
  { name: 'Alice', text: 'My pointer keeps becoming null after I pass it to a function, why?' },
  { name: 'Bob', text: 'Why does my pointer lose its value inside the helper function?' },
  { name: 'Carlos', text: 'Pointers are null after assignment inside my function, confused' },
  { name: 'Diana', text: 'Getting a segfault on line 42 when I call delete' },
  { name: 'Eve', text: 'Segmentation fault when freeing memory, what am I doing wrong?' },
  { name: 'Frank', text: 'Program crashes with segfault when I delete my linked list node' },
  { name: 'Grace', text: 'What does the destructor need to do for the linked list?' },
  { name: 'Hana', text: 'Do I need a destructor if I use new in my class?' },
];

async function seed() {
  // Clear existing questions and clusters for demo session
  await pool.query(`DELETE FROM questions WHERE session_id = $1`, [DEMO_SESSION_ID]);
  await pool.query(`DELETE FROM clusters WHERE session_id = $1`, [DEMO_SESSION_ID]);

  for (const q of questions) {
    await pool.query(
      `INSERT INTO questions (session_id, student_name, question_text) VALUES ($1, $2, $3)`,
      [DEMO_SESSION_ID, q.name, q.text]
    );
  }

  console.log(`Seeded ${questions.length} questions for demo session`);
  process.exit(0);
}

seed().catch(console.error);