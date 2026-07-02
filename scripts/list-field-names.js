const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'skillbridge',
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT DISTINCT field_name FROM personal_assessment_questions");
  console.log('Field names in DB:');
  console.log(res.rows.map(r => r.field_name).sort());
  await client.end();
}

run().catch(console.error);
