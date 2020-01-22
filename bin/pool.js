const { Pool } = require('pg');
var pool = new Pool({
  user: 'postgres',
  database: 'ht',
  password: 'superuser',
  port: 5432
});
module.exports = pool;
