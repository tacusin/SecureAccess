/**
 * Data Integrity Validator Linter
 * Validates data structures and flow patterns against the tracking registry
 */

class DataIntegrityValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.dataFlowRegistry = null;
    this.personnelSchema = null;
    this.activitySchema = null;
  }

  async loadRegistry() {
    try {
      const response = await fetch('../codebase-tracking/data-flow.json');
      this.dataFlowRegistry = await response.json();
      this.extractSchemas();
    } catch (error) {
      console.error('Failed to load data flow registry:', error);
      return false;
    }
    return true;
  }

  extractSchemas() {
    if (!this.dataFlowRegistry) return;
    
    const storage = this.dataFlowRegistry.storageOperations?.localStorage?.keys || {};
    
    this.personnelSchema = storage.personnel_data?.structure || {};
    this.activitySchema = storage.activity_log?.structure || {};
  }

  async validateStorageOperations() {
    try {
      const response = await fetch('../js/storage.js');
      const content = await response.text();
      this.analyzeStorageCode(content);
    } catch (error) {
      this.errors.push(`Failed to load storage.js: ${error.message}`);
    }
  }

  analyzeStorageCode(content) {
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Check localStorage operations
      this.validateLocalStorageUsage(line, lineNumber);
      
      // Check data validation patterns
      this.validateDataValidation(line, lineNumber);
      
      // Check required field handling
      this.validateRequiredFields(line, lineNumber);
      
      // Check for potential data corruption issues
      this.checkDataCorruptionPatterns(line, lineNumber);
    });
  }

  validateLocalStorageUsage(line, lineNumber) {
    const setItemRegex = /localStorage\.setItem\s*\(\s*['"`]([^'"`]+)['"`]/;
    const getItemRegex = /localStorage\.getItem\s*\(\s*['"`]([^'"`]+)['"`]/;
    
    const setMatch = line.match(setItemRegex);
    if (setMatch) {
      const key = setMatch[1];
      if (!this.isValidStorageKey(key)) {
        this.warnings.push(
          `Unknown localStorage key '${key}' at line ${lineNumber} - not documented in data flow`
        );
      }
    }
    
    const getMatch = line.match(getItemRegex);
    if (getMatch) {
      const key = getMatch[1];
      if (!this.isValidStorageKey(key)) {
        this.warnings.push(
          `Unknown localStorage key '${key}' at line ${lineNumber} - not documented in data flow`
        );
      }
    }
  }

  isValidStorageKey(key) {
    if (!this.dataFlowRegistry) return true;
    
    const validKeys = Object.keys(
      this.dataFlowRegistry.storageOperations?.localStorage?.keys || {}
    );
    return validKeys.includes(key);
  }

  validateDataValidation(line, lineNumber) {
    // Check for JSON.parse without try-catch
    if (line.includes('JSON.parse') && !this.hasErrorHandling(line)) {
      this.errors.push(
        `JSON.parse without error handling at line ${lineNumber} - could cause data corruption`
      );
    }
    
    // Check for direct property access without validation
    const directAccessRegex = /\w+\.\w+\s*=\s*[^;]+;/;
    if (directAccessRegex.test(line) && line.includes('personnel') && !line.includes('validate')) {
      this.warnings.push(
        `Direct property assignment at line ${lineNumber} - consider validation`
      );
    }
  }

  hasErrorHandling(line) {
    return line.includes('try') || line.includes('catch') || line.includes('||');
  }

  validateRequiredFields(line, lineNumber) {
    if (!this.personnelSchema) return;
    
    if (line.includes('addPersonnel') || line.includes('personnel') && line.includes('=')) {
      const requiredFields = ['name', 'role']; // From data flow registry
      
      requiredFields.forEach(field => {
        if (line.includes(field) && !line.includes(`${field}:`)) {
          this.warnings.push(
            `Required field '${field}' handling at line ${lineNumber} - verify validation`
          );
        }
      });
    }
  }

  checkDataCorruptionPatterns(line, lineNumber) {
    // Check for potential race conditions
    if (line.includes('setTimeout') && line.includes('localStorage')) {
      this.warnings.push(
        `Potential race condition with localStorage in setTimeout at line ${lineNumber}`
      );
    }
    
    // Check for missing null checks
    if (line.includes('.length') && !line.includes('&&') && !line.includes('||')) {
      this.warnings.push(
        `Potential null reference at line ${lineNumber} - add null check`
      );
    }
    
    // Check for unsafe array operations
    if (line.includes('splice') || line.includes('pop') || line.includes('shift')) {
      this.warnings.push(
        `Unsafe array mutation at line ${lineNumber} - ensure data integrity`
      );
    }
  }

  async validateDataFlowPatterns() {
    const jsFiles = [
      '../js/app.js',
      '../js/storage.js',
      '../js/dashboard.js',
      '../js/shifts.js'
    ];
    
    for (const file of jsFiles) {
      await this.validateDataFlowInFile(file);
    }
  }

  async validateDataFlowInFile(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      this.analyzeDataFlow(content, filePath);
    } catch (error) {
      this.errors.push(`Failed to load ${filePath}: ${error.message}`);
    }
  }

  analyzeDataFlow(content, filePath) {
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Check for proper event flow
      this.validateEventFlow(line, lineNumber, filePath);
      
      // Check for data consistency
      this.validateDataConsistency(line, lineNumber, filePath);
      
      // Check for proper error propagation
      this.validateErrorPropagation(line, lineNumber, filePath);
    });
  }

  validateEventFlow(line, lineNumber, filePath) {
    // Check for missing event handlers
    if (line.includes('addEventListener') && !line.includes('removeEventListener')) {
      const eventMatch = line.match(/addEventListener\s*\(\s*['"`](\w+)['"`]/);
      if (eventMatch) {
        this.warnings.push(
          `Event listener '${eventMatch[1]}' at line ${lineNumber} in ${filePath} - ensure cleanup`
        );
      }
    }
    
    // Check for proper async handling
    if (line.includes('await') && !line.includes('try')) {
      this.warnings.push(
        `Unhandled async operation at line ${lineNumber} in ${filePath} - add error handling`
      );
    }
  }

  validateDataConsistency(line, lineNumber, filePath) {
    // Check for ID generation consistency
    if (line.includes('generateId') || line.includes('Date.now()')) {
      this.warnings.push(
        `ID generation at line ${lineNumber} in ${filePath} - ensure uniqueness`
      );
    }
    
    // Check for timestamp consistency
    if (line.includes('timestamp') && line.includes('=')) {
      if (!line.includes('new Date()') && !line.includes('Date.now()')) {
        this.warnings.push(
          `Timestamp assignment at line ${lineNumber} in ${filePath} - verify format consistency`
        );
      }
    }
  }

  validateErrorPropagation(line, lineNumber, filePath) {
    // Check for swallowed errors
    if (line.includes('catch') && line.includes('console.error')) {
      if (!line.includes('throw') && !line.includes('return')) {
        this.warnings.push(
          `Error potentially swallowed at line ${lineNumber} in ${filePath} - consider propagation`
        );
      }
    }
  }

  async validateSchemaCompliance() {
    // Simulate checking stored data format
    const mockStorageCheck = {
      personnel_data: this.validatePersonnelSchema(),
      activity_log: this.validateActivitySchema(),
      app_settings: this.validateSettingsSchema()
    };
    
    Object.entries(mockStorageCheck).forEach(([key, issues]) => {
      issues.forEach(issue => {
        this.errors.push(`Schema validation for ${key}: ${issue}`);
      });
    });
  }

  validatePersonnelSchema() {
    const issues = [];
    const requiredFields = ['id', 'name', 'role', 'status'];
    
    // This would normally check actual stored data
    // For now, validate the expected schema structure
    if (!this.personnelSchema) {
      issues.push('Personnel schema not defined in data flow registry');
      return issues;
    }
    
    requiredFields.forEach(field => {
      if (!this.personnelSchema[field]) {
        issues.push(`Required field '${field}' not defined in personnel schema`);
      }
    });
    
    return issues;
  }

  validateActivitySchema() {
    const issues = [];
    const requiredFields = ['id', 'timestamp', 'action', 'personId'];
    
    if (!this.activitySchema) {
      issues.push('Activity schema not defined in data flow registry');
      return issues;
    }
    
    requiredFields.forEach(field => {
      if (!this.activitySchema[field]) {
        issues.push(`Required field '${field}' not defined in activity schema`);
      }
    });
    
    return issues;
  }

  validateSettingsSchema() {
    const issues = [];
    // Basic validation for settings structure
    return issues;
  }

  getReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      success: this.errors.length === 0,
      summary: `Found ${this.errors.length} data integrity errors and ${this.warnings.length} warnings`,
      categories: {
        storage: this.errors.filter(e => e.includes('localStorage')).length,
        validation: this.errors.filter(e => e.includes('validation')).length,
        schema: this.errors.filter(e => e.includes('schema')).length,
        flow: this.errors.filter(e => e.includes('flow')).length
      }
    };
  }

  clearResults() {
    this.errors = [];
    this.warnings = [];
  }
}

// Usage function
async function runDataIntegrityValidation() {
  const validator = new DataIntegrityValidator();
  
  console.log('Loading data flow registry...');
  if (!(await validator.loadRegistry())) {
    console.error('Failed to load data flow registry');
    return;
  }
  
  console.log('Validating storage operations...');
  await validator.validateStorageOperations();
  
  console.log('Validating data flow patterns...');
  await validator.validateDataFlowPatterns();
  
  console.log('Validating schema compliance...');
  await validator.validateSchemaCompliance();
  
  const report = validator.getReport();
  console.log('\n=== Data Integrity Validation Report ===');
  console.log(report.summary);
  
  if (Object.values(report.categories).some(count => count > 0)) {
    console.log('\nIssues by category:');
    Object.entries(report.categories).forEach(([category, count]) => {
      if (count > 0) {
        console.log(`  ${category}: ${count} issues`);
      }
    });
  }
  
  if (report.errors.length > 0) {
    console.log('\nErrors:');
    report.errors.forEach(error => console.log(`  ❌ ${error}`));
  }
  
  if (report.warnings.length > 0) {
    console.log('\nWarnings:');
    report.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
  }
  
  if (report.success && report.warnings.length === 0) {
    console.log('\n✅ All data integrity validations passed!');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataIntegrityValidator;
}