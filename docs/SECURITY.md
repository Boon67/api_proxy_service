# Security Guide

## Overview

The Snowflake API Proxy Service implements multiple layers of security to protect both the management interface and API endpoints. This document outlines the security measures, best practices, and recommendations for secure deployment.

## Security Architecture

### 1. Authentication Layers

#### Admin Authentication (JWT)
- **Purpose**: Secure access to management interface
- **Algorithm**: HMAC SHA-256
- **Expiration**: Configurable (default: 24 hours)
- **Storage**: HTTP-only cookies (recommended) or Authorization header

#### API Authentication (PAT)
- **Purpose**: Secure access to specific API endpoints
- **Format**: Cryptographically secure random tokens
- **Length**: 64 characters (32 bytes hex-encoded)
- **Storage**: In-memory with optional database persistence

### 2. Authorization Model

#### Role-Based Access Control (RBAC)
- **Admin Role**: Full access to all management functions
- **API Role**: Limited to specific endpoint access via PAT tokens
- **Future**: Custom roles and permissions

#### Token Scoping
- **JWT Tokens**: Global admin access
- **PAT Tokens**: Scoped to specific endpoints
- **Rate Limiting**: Per-token and per-IP limits

## Security Features

### 1. Input Validation and Sanitization

#### Request Validation
```javascript
// Example validation rules
const endpointValidation = {
  name: { required: true, type: 'string', maxLength: 100 },
  type: { required: true, enum: ['query', 'stored_procedure', 'function', 'table'] },
  target: { required: true, type: 'string', maxLength: 10000 },
  method: { required: true, enum: ['GET', 'POST', 'PUT', 'DELETE'] },
  rateLimit: { type: 'number', min: 1, max: 10000 }
};
```

#### SQL Injection Prevention
- **Parameterized Queries**: All Snowflake queries use parameterized statements
- **Input Sanitization**: Special characters are escaped
- **Query Validation**: SQL syntax validation before execution

#### XSS Prevention
- **Content Security Policy**: Strict CSP headers
- **Input Sanitization**: HTML entities encoding
- **Output Encoding**: All user input is properly encoded

### 2. Network Security

#### HTTPS/TLS
- **Encryption**: All data in transit encrypted with TLS 1.2+
- **Certificate Management**: Automated certificate renewal
- **HSTS**: HTTP Strict Transport Security headers

#### CORS Configuration
```javascript
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

#### Rate Limiting
```javascript
// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: 'Too many requests from this IP'
});

// Per-token rate limiting
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per token
  keyGenerator: (req) => req.params.token
});
```

### 3. Security Headers

#### Helmet.js Configuration
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### Custom Security Headers
```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

### 4. Data Protection

#### Sensitive Data Handling
- **Password Hashing**: bcrypt with salt rounds
- **Token Storage**: Secure random generation
- **Credential Encryption**: Environment variables for sensitive data
- **Log Sanitization**: Sensitive data removed from logs

#### Data Encryption
```javascript
// JWT Secret Generation
const jwtSecret = crypto.randomBytes(64).toString('hex');

// PAT Token Generation
const patToken = crypto.randomBytes(32).toString('hex');

// Password Hashing
const hashedPassword = await bcrypt.hash(password, 12);
```

## Snowflake Security

### 1. Connection Security

#### Credential Management
- **Service Accounts**: Dedicated service accounts with minimal permissions
- **Credential Rotation**: Regular rotation of Snowflake credentials
- **Environment Variables**: Secure storage of credentials
- **Connection Pooling**: Secure connection management

#### Network Security
- **IP Whitelisting**: Restrict Snowflake access to known IPs
- **VPN/Private Networks**: Use private networks when possible
- **TLS Encryption**: All connections encrypted with TLS

### 2. Query Security

#### SQL Injection Prevention
```javascript
// Parameterized queries
const result = await snowflakeService.executeQuery(
  connection,
  'SELECT * FROM users WHERE id = ?',
  [userId]
);

// Stored procedure calls
const result = await snowflakeService.executeStoredProcedure(
  connection,
  'GET_USER_DATA',
  [userId, startDate, endDate]
);
```

#### Query Validation
- **Syntax Checking**: Validate SQL syntax before execution
- **Permission Checking**: Verify user has access to requested data
- **Resource Limits**: Limit query execution time and resource usage

### 3. Data Access Control

#### Row-Level Security
```sql
-- Example RLS policy
CREATE POLICY user_data_policy ON users
  FOR ALL TO api_user
  USING (user_id = CURRENT_USER());
```

#### Column-Level Security
```sql
-- Mask sensitive columns
CREATE MASKING POLICY email_mask ON (email string)
  RETURNS string ->
  CASE WHEN CURRENT_ROLE() = 'ADMIN' THEN email
       ELSE REGEXP_REPLACE(email, '(.)(.*)@', '\\1***@')
  END;
```

## Container Security

### 1. Image Security

#### Base Image Security
- **Minimal Base Images**: Use Alpine Linux for smaller attack surface
- **Regular Updates**: Keep base images updated
- **Vulnerability Scanning**: Scan images for known vulnerabilities
- **Non-Root User**: Run containers as non-root user

#### Dockerfile Security
```dockerfile
# Use specific version tags
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Switch to non-root user
USER nodejs

# Remove unnecessary packages
RUN apk del --no-cache build-dependencies
```

### 2. Runtime Security

#### Container Isolation
- **Network Isolation**: Containers communicate through internal networks
- **Resource Limits**: CPU and memory limits
- **Read-Only Filesystems**: Where possible, use read-only filesystems
- **Security Contexts**: Proper security contexts and capabilities

#### Secrets Management
```yaml
# Docker Compose secrets
services:
  backend:
    environment:
      - SNOWFLAKE_PASSWORD_FILE=/run/secrets/snowflake_password
    secrets:
      - snowflake_password

secrets:
  snowflake_password:
    file: ./secrets/snowflake_password.txt
```

## Monitoring and Logging

### 1. Security Monitoring

#### Authentication Monitoring
- **Failed Login Attempts**: Monitor and alert on failed logins
- **Token Usage**: Track token usage patterns
- **Suspicious Activity**: Detect unusual access patterns

#### API Monitoring
- **Rate Limit Violations**: Monitor rate limit breaches
- **Error Rates**: Track API error rates
- **Response Times**: Monitor for performance issues

### 2. Logging Security

#### Security Event Logging
```javascript
// Authentication events
logger.info('User login successful', {
  username: user.username,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  timestamp: new Date().toISOString()
});

// API access events
logger.info('API access', {
  token: token.substring(0, 8) + '...',
  endpoint: req.params.token,
  method: req.method,
  ip: req.ip,
  timestamp: new Date().toISOString()
});
```

#### Log Protection
- **Sensitive Data**: Remove sensitive data from logs
- **Log Rotation**: Regular log rotation and archival
- **Access Control**: Restrict access to log files
- **Encryption**: Encrypt log files at rest

## Incident Response

### 1. Security Incident Types

#### Authentication Incidents
- **Brute Force Attacks**: Multiple failed login attempts
- **Token Compromise**: Suspected token theft
- **Unauthorized Access**: Access with compromised credentials

#### API Incidents
- **DDoS Attacks**: High volume of requests
- **SQL Injection Attempts**: Malicious query attempts
- **Data Exfiltration**: Unauthorized data access

### 2. Response Procedures

#### Immediate Response
1. **Identify**: Determine the scope and impact
2. **Contain**: Isolate affected systems
3. **Eradicate**: Remove threats and vulnerabilities
4. **Recover**: Restore normal operations
5. **Learn**: Document lessons learned

#### Communication
- **Internal**: Notify security team and management
- **External**: Notify affected users if necessary
- **Regulatory**: Comply with reporting requirements

## Compliance and Auditing

### 1. Compliance Standards

#### Data Protection
- **GDPR**: European data protection regulations
- **CCPA**: California consumer privacy act
- **SOC 2**: Security and availability controls
- **ISO 27001**: Information security management

#### Industry Standards
- **PCI DSS**: Payment card industry standards
- **HIPAA**: Healthcare data protection
- **SOX**: Financial reporting requirements

### 2. Audit Requirements

#### Audit Logging
```javascript
// Audit trail for all operations
const auditLog = {
  action: 'endpoint_created',
  userId: req.user.id,
  resourceId: endpoint.id,
  timestamp: new Date().toISOString(),
  ip: req.ip,
  userAgent: req.get('User-Agent'),
  details: {
    endpointName: endpoint.name,
    endpointType: endpoint.type
  }
};
```

#### Compliance Monitoring
- **Access Logs**: Track all data access
- **Change Logs**: Track all configuration changes
- **Security Events**: Track all security-related events
- **Data Retention**: Maintain logs for required periods

## Security Best Practices

### 1. Development Security

#### Secure Coding
- **Input Validation**: Validate all inputs
- **Output Encoding**: Encode all outputs
- **Error Handling**: Don't expose sensitive information
- **Dependency Management**: Keep dependencies updated

#### Code Review
- **Security Review**: Include security in code reviews
- **Static Analysis**: Use static analysis tools
- **Penetration Testing**: Regular security testing
- **Vulnerability Scanning**: Regular vulnerability scans

### 2. Operational Security

#### Access Management
- **Principle of Least Privilege**: Minimum necessary access
- **Regular Access Reviews**: Review access regularly
- **Multi-Factor Authentication**: Use MFA where possible
- **Account Lockout**: Lock accounts after failed attempts

#### System Hardening
- **Regular Updates**: Keep systems updated
- **Configuration Management**: Secure configuration
- **Monitoring**: Continuous security monitoring
- **Backup Security**: Secure backup procedures

### 3. Data Security

#### Data Classification
- **Public**: No restrictions
- **Internal**: Limited to organization
- **Confidential**: Restricted access
- **Secret**: Highly restricted access

#### Data Handling
- **Encryption at Rest**: Encrypt sensitive data at rest
- **Encryption in Transit**: Encrypt data in transit
- **Data Minimization**: Collect only necessary data
- **Data Retention**: Implement data retention policies

## Security Checklist

### Pre-Deployment
- [ ] All dependencies updated
- [ ] Security headers configured
- [ ] Input validation implemented
- [ ] Authentication configured
- [ ] Authorization implemented
- [ ] Rate limiting configured
- [ ] Logging configured
- [ ] Monitoring configured
- [ ] Backup procedures tested
- [ ] Incident response plan ready

### Post-Deployment
- [ ] Security monitoring active
- [ ] Log analysis configured
- [ ] Vulnerability scanning scheduled
- [ ] Penetration testing planned
- [ ] Access reviews scheduled
- [ ] Security training completed
- [ ] Incident response tested
- [ ] Compliance monitoring active
- [ ] Regular security updates
- [ ] Security documentation updated

## Security Contacts

### Internal Contacts
- **Security Team**: security@company.com
- **IT Operations**: ops@company.com
- **Compliance Team**: compliance@company.com

### External Contacts
- **Security Vendor**: vendor@security.com
- **Incident Response**: incident@response.com
- **Legal Team**: legal@company.com

## Resources

### Security Tools
- **OWASP ZAP**: Web application security scanner
- **Nessus**: Vulnerability scanner
- **Burp Suite**: Web application testing
- **Nmap**: Network scanner

### Security Standards
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Controls](https://www.cisecurity.org/controls/)
- [ISO 27001](https://www.iso.org/isoiec-27001-information-security.html)

### Security Training
- [OWASP Training](https://owasp.org/www-project-training/)
- [SANS Security Training](https://www.sans.org/)
- [Coursera Security Courses](https://www.coursera.org/browse/computer-science/cybersecurity)
- [edX Security Courses](https://www.edx.org/learn/cybersecurity)
