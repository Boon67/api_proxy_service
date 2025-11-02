const { v4: uuidv4 } = require('uuid');

class Endpoint {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.name = data.name;
    this.description = data.description || '';
    this.type = data.type; // 'query', 'stored_procedure', 'function', 'table'
    this.target = data.target; // SQL query, procedure name, function name, or table name
    this.method = data.method || 'GET'; // HTTP method
    this.parameters = data.parameters || []; // Parameter definitions
    this.rateLimit = data.rateLimit || 100; // Requests per minute
    this.status = data.status || data.STATUS || 'draft'; // 'active', 'draft', 'suspended'
    // Backward compatibility: derive status from isActive if status not provided
    if (!data.status && !data.STATUS) {
      this.status = data.isActive === false ? 'suspended' : 'active';
    }
    this.isActive = data.isActive !== undefined ? data.isActive : (this.status === 'active');
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.createdBy = data.createdBy;
    this.metadata = data.metadata || {};
  }

  validate() {
    const errors = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!this.type) {
      errors.push('Type is required');
    } else if (!['query', 'stored_procedure', 'function', 'table'].includes(this.type)) {
      errors.push('Type must be one of: query, stored_procedure, function, table');
    }

    if (!this.target || this.target.trim().length === 0) {
      errors.push('Target is required');
    }

    if (!this.method) {
      errors.push('Method is required');
    } else if (!['GET', 'POST', 'PUT', 'DELETE'].includes(this.method)) {
      errors.push('Method must be one of: GET, POST, PUT, DELETE');
    }

    if (this.rateLimit && (typeof this.rateLimit !== 'number' || this.rateLimit < 1)) {
      errors.push('Rate limit must be a positive number');
    }

    if (this.parameters && !Array.isArray(this.parameters)) {
      errors.push('Parameters must be an array');
    }

    if (this.status && !['active', 'draft', 'suspended'].includes(this.status)) {
      errors.push('Status must be one of: active, draft, suspended');
    }

    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      target: this.target,
      method: this.method,
      parameters: this.parameters,
      rateLimit: this.rateLimit,
      status: this.status,
      isActive: this.isActive, // Keep for backward compatibility
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      metadata: this.metadata
    };
  }

  static fromJSON(data) {
    return new Endpoint(data);
  }

  update(data) {
    const allowedFields = [
      'name', 'description', 'type', 'target', 'method', 
      'parameters', 'rateLimit', 'status', 'isActive', 'metadata'
    ];

    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        this[field] = data[field];
      }
    });

    this.updatedAt = new Date().toISOString();
  }
}

module.exports = Endpoint;
