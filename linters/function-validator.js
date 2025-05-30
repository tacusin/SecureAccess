/**
 * Function Validator Linter
 * Validates function definitions against the tracking registry
 */

class FunctionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.functionsRegistry = null;
  }

  async loadRegistry() {
    try {
      const response = await fetch('../codebase-tracking/functions-registry.json');
      this.functionsRegistry = await response.json();
    } catch (error) {
      console.error('Failed to load functions registry:', error);
      return false;
    }
    return true;
  }

  async validateFile(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      return this.validateContent(content, filePath);
    } catch (error) {
      this.errors.push(`Failed to load file: ${filePath} - ${error.message}`);
      return false;
    }
  }

  validateContent(content, filePath) {
    const lines = content.split('\n');
    this.validateFunctionDefinitions(lines, filePath);
    this.validateFunctionCalls(lines, filePath);
    this.validateEventHandlers(lines, filePath);
    
    return this.errors.length === 0;
  }

  validateFunctionDefinitions(lines, filePath) {
    const functionRegex = /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*\{/;
    const methodRegex = /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*\{/;
    
    lines.forEach((line, index) => {
      const match = line.match(functionRegex) || line.match(methodRegex);
      if (match) {
        const functionName = match[2];
        const lineNumber = index + 1;
        
        if (!this.isFunctionInRegistry(functionName, filePath)) {
          this.warnings.push(
            `Function '${functionName}' at line ${lineNumber} in ${filePath} not found in registry`
          );
        }
      }
    });
  }

  validateFunctionCalls(lines, filePath) {
    const callRegex = /(\w+)\s*\(/g;
    
    lines.forEach((line, index) => {
      let match;
      while ((match = callRegex.exec(line)) !== null) {
        const functionName = match[1];
        const lineNumber = index + 1;
        
        // Skip common JavaScript keywords and DOM methods
        if (this.isBuiltInFunction(functionName)) {
          continue;
        }
        
        if (!this.isFunctionInRegistry(functionName, filePath)) {
          this.warnings.push(
            `Function call '${functionName}' at line ${lineNumber} in ${filePath} not found in registry`
          );
        }
      }
    });
  }

  validateEventHandlers(lines, filePath) {
    const eventListenerRegex = /addEventListener\s*\(\s*['"`](\w+)['"`]\s*,\s*(\w+)/;
    
    lines.forEach((line, index) => {
      const match = line.match(eventListenerRegex);
      if (match) {
        const eventType = match[1];
        const handlerName = match[2];
        const lineNumber = index + 1;
        
        if (!this.isEventHandlerValid(eventType, handlerName)) {
          this.errors.push(
            `Event handler '${handlerName}' for '${eventType}' at line ${lineNumber} in ${filePath} not properly defined`
          );
        }
      }
    });
  }

  isFunctionInRegistry(functionName, filePath) {
    if (!this.functionsRegistry) return true; // Skip validation if registry not loaded
    
    const functions = this.functionsRegistry.functions || [];
    return functions.some(func => {
      if (func.name === functionName) return true;
      if (func.methods) {
        return func.methods.some(method => method.name === functionName);
      }
      return false;
    });
  }

  isBuiltInFunction(functionName) {
    const builtIns = [
      'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
      'document', 'window', 'fetch', 'parseInt', 'parseFloat', 'isNaN',
      'JSON', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean',
      'Math', 'Promise', 'Error', 'RegExp', 'Map', 'Set', 'WeakMap', 'WeakSet'
    ];
    return builtIns.includes(functionName);
  }

  isEventHandlerValid(eventType, handlerName) {
    // Basic validation - could be enhanced with event handlers registry
    const validEvents = [
      'click', 'input', 'change', 'submit', 'keydown', 'keyup', 'load',
      'resize', 'scroll', 'focus', 'blur', 'mouseenter', 'mouseleave'
    ];
    return validEvents.includes(eventType);
  }

  getReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      success: this.errors.length === 0,
      summary: `Found ${this.errors.length} errors and ${this.warnings.length} warnings`
    };
  }

  clearResults() {
    this.errors = [];
    this.warnings = [];
  }
}

// Usage example
async function runFunctionValidation() {
  const validator = new FunctionValidator();
  
  if (!(await validator.loadRegistry())) {
    console.error('Failed to load function registry');
    return;
  }
  
  const filesToCheck = [
    '../js/app.js',
    '../js/storage.js',
    '../js/dashboard.js',
    '../js/camera.js',
    '../js/emergency.js'
  ];
  
  for (const file of filesToCheck) {
    console.log(`Validating ${file}...`);
    await validator.validateFile(file);
  }
  
  const report = validator.getReport();
  console.log('\n=== Function Validation Report ===');
  console.log(report.summary);
  
  if (report.errors.length > 0) {
    console.log('\nErrors:');
    report.errors.forEach(error => console.log(`  ❌ ${error}`));
  }
  
  if (report.warnings.length > 0) {
    console.log('\nWarnings:');
    report.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
  }
  
  if (report.success && report.warnings.length === 0) {
    console.log('\n✅ All validations passed!');
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FunctionValidator;
}