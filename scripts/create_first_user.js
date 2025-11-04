#!/usr/bin/env node

/**
 * Script to create the first admin user
 * This bypasses authentication to allow bootstrapping the system
 * Usage: node scripts/create_first_user.js <username> <password> [email] [firstName] [lastName] [contactNumber]
 */

const bcrypt = require('bcryptjs');
const snowflake = require('snowflake-sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load config
const configPath = path.join(__dirname, '..', 'config', 'snowflake.json');
let dbConfig = {};

if (fs.existsSync(configPath)) {
  dbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} else {
  // Use environment variables
  dbConfig = {
    account: process.env.SNOWFLAKE_ACCOUNT || process.env.SNOWFLAKE_HOST?.replace('.snowflakecomputing.com', ''),
    username: process.env.SNOWFLAKE_USERNAME || process.env.SNOWFLAKE_USER,
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || 'API_PROXY_WH',
    database: process.env.SNOWFLAKE_DATABASE || 'API_PROXY',
    schema: process.env.SNOWFLAKE_SCHEMA || 'APP',
    role: process.env.SNOWFLAKE_ROLE || 'ACCOUNTADMIN'
  };
}

const { v4: uuidv4 } = require('uuid');

async function createFirstUser(username, password, email, firstName, lastName, contactNumber) {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
      account: dbConfig.account?.replace('.snowflakecomputing.com', ''),
      username: dbConfig.username,
      password: dbConfig.password,
      warehouse: dbConfig.warehouse,
      database: dbConfig.database,
      schema: dbConfig.schema,
      role: dbConfig.role
    });

    connection.connect((err, conn) => {
      if (err) {
        console.error('Failed to connect to Snowflake:', err);
        reject(err);
        return;
      }

      console.log('Connected to Snowflake');

      // Hash password
      bcrypt.hash(password, 12, (hashErr, passwordHash) => {
        if (hashErr) {
          console.error('Failed to hash password:', hashErr);
          connection.destroy();
          reject(hashErr);
          return;
        }

        const userId = uuidv4();
        const sql = `
          INSERT INTO ${dbConfig.database}.${dbConfig.schema}.USERS
            (USER_ID, USERNAME, PASSWORD_HASH, FIRST_NAME, LAST_NAME, EMAIL, CONTACT_NUMBER, ROLE, IS_ACTIVE, CREATED_BY)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', TRUE, 'bootstrap-script')
        `;

        conn.execute({
          sqlText: sql,
          binds: [
            userId,
            username.toUpperCase(),
            passwordHash,
            firstName || null,
            lastName || null,
            email || null,
            contactNumber || null
          ],
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('Failed to create user:', err);
              connection.destroy();
              reject(err);
              return;
            }

            console.log('\n✅ User created successfully!');
            console.log(`   Username: ${username.toUpperCase()}`);
            console.log(`   Role: admin`);
            if (email) console.log(`   Email: ${email}`);
            console.log('\nYou can now login with these credentials.\n');
            
            connection.destroy();
            resolve();
          }
        });
      });
    });
  });
}

// Main
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/create_first_user.js <username> <password> [email] [firstName] [lastName] [contactNumber]');
  console.error('\nExample:');
  console.error('  node scripts/create_first_user.js admin MySecurePass123 admin@example.com John Doe +1-555-123-4567');
  process.exit(1);
}

const [username, password, email, firstName, lastName, contactNumber] = args;

if (password.length < 6) {
  console.error('Error: Password must be at least 6 characters long');
  process.exit(1);
}

createFirstUser(username, password, email, firstName, lastName, contactNumber)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });

