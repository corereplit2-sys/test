const fs = require('fs');
const path = require('path');

// Read the migration file
const migrationPath = path.join(__dirname, 'migrations', '0004_add_onboarding_requests.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('Running migration: 0004_add_onboarding_requests.sql');
console.log('SQL:');
console.log(migrationSQL);
console.log('\nYou need to run this SQL manually in your database.');
console.log('\nTo run in PostgreSQL:');
console.log('psql -f migrations/0004_add_onboarding_requests.sql');
console.log('\nOr copy the SQL above and run it in your database admin tool.');
