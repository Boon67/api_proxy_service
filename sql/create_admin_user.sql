-- =====================================================
-- Create Admin User
-- =====================================================
-- This script creates the default admin user for the API Proxy Service
-- Run this as ACCOUNTADMIN or SYSADMIN
--
-- Password: admin123
-- Username: admin
--
-- =====================================================

USE ROLE ACCOUNTADMIN;
USE DATABASE API_PROXY;
USE SCHEMA APP;

-- Insert default admin user (password: admin123)
-- Password hash: $2a$12$Sk0sw.rJyPUmt/TEmfjM/uS.SZvSGBSIALCefvzmrRPjnCzCOAzTC
INSERT INTO USERS (USER_ID, USERNAME, PASSWORD_HASH, EMAIL, ROLE, IS_ACTIVE, CREATED_BY)
SELECT 
    UUID_STRING(),
    'admin',
    '$2a$12$Sk0sw.rJyPUmt/TEmfjM/uS.SZvSGBSIALCefvzmrRPjnCzCOAzTC', -- admin123
    'admin@example.com',
    'admin',
    TRUE,
    'system'
WHERE NOT EXISTS (SELECT 1 FROM USERS WHERE USERNAME = 'admin');

-- Verify admin user was created
SELECT USER_ID, USERNAME, EMAIL, ROLE, IS_ACTIVE, CREATED_AT
FROM USERS
WHERE USERNAME = 'admin';

SELECT 'Admin user created successfully!' AS STATUS;
