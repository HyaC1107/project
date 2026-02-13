// backend/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// 연결 테스트용 로그
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ DB 연결 실패.. 비번이나 DB명을 확인해 주세요!', err.stack);
  }
  console.log('✅ PostgreSQL 연결 성공! 이제 상추 데이터를 쌓아보죠! 🥬');
  release();
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};