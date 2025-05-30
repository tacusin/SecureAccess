/**
 * Architecture Validator Linter
 * Validates component architecture and dependencies against the tracking registry
 */

class ArchitectureValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.architectureRegistry = null;
    this.dependencyRegistry = null;
    this.componentInstances = new Map();
    this.circularDeps = [];
  }

  async loadRegistries() {
    try {
      const [archResponse, depResponse] = await Promise.all([
        fetch('../codebase-tracking/components-architecture.json'),
        fetch('../codebase-tracking/dependencies.json')
      ]);
      
      this.architectureRegistry = await archResponse.json();
      this.dependencyRegistry = await depResponse.json();
    } catch (error) {
      console.error('Failed to load architecture registries:', error);
      return false;
    }
    return true;
  }

  async validateInitializationOrder() {
    try {
      const response = await fetch('../js/app.js');
      const content = await response.text();
      this.analyzeInitializationFlow(content);
    } catch (error) {
      this.errors.push(`Failed to load app.js: ${error.message}`);
    }
  }

  analyzeInitializationFlow(content) {
    const lines = content.split('\n');
    const initOrder = this.architectureRegistry?.initializationFlow?.order || [];
    const foundInits = [];
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Check for component initialization
      const initMatch = line.match(/(\w+)\.init\s*\(/);
      if (initMatch) {
        const component = initMatch[1];
        foundInits.push({ component, line: lineNumber });
      }
      
      // Check for proper error handling in init
      if (line.includes('.init(') && !this.hasProperErrorHandling(lines, index)) {
        this.warnings.push(
          `Component initialization at line ${lineNumber} lacks proper error handling`
        );
      }
    });
    
    // Validate initialization order
    this.validateComponentOrder(foundInits, initOrder);
  }

  hasProperErrorHandling(lines, currentIndex) {
    // Look for try-catch or await with error handling within 5 lines
    for (let i = Math.max(0, currentIndex - 5); i < Math.min(lines.length, currentIndex + 5); i++) {
      if (lines[i].includes('try') || lines[i].includes('catch') || lines[i].includes('await')) {
        return true;
      }
    }
    return false;
  }

  validateComponentOrder(foundInits, expectedOrder) {
    expectedOrder.forEach((step, index) => {
      if (step.components) {
        // Parallel initialization - check all components are present
        step.components.forEach(component => {
          const componentName = component.split('.')[0];
          const found = foundInits.find(init => init.component === componentName);
          
          if (!found) {
            this.errors.push(
              `Expected component '${componentName}' initialization not found (step ${step.step})`
            );
          }
        });
      } else if (step.component) {
        const componentName = step.component.split('.')[0];
        const found = foundInits.find(init => init.component === componentName);
        
        if (!found) {
          this.errors.push(
            `Expected component '${componentName}' initialization not found (step ${step.step})`
          );
        }
      }
    });
  }

  async validateDependencyGraph() {
    const internalDeps = this.dependencyRegistry?.internalDependencies || {};
    
    // Build dependency graph
    const graph = new Map();
    Object.entries(internalDeps).forEach(([component, deps]) => {
      graph.set(component, deps.dependsOn || []);
    });
    
    // Check for circular dependencies
    this.detectCircularDependencies(graph);
    
    // Validate dependency declarations
    this.validateDependencyDeclarations(graph);
  }

  detectCircularDependencies(graph) {
    const visited = new Set();
    const recStack = new Set();
    
    for (const [component] of graph) {
      if (this.hasCycleDFS(component, graph, visited, recStack, [component])) {
        break;
      }
    }
  }

  hasCycleDFS(component, graph, visited, recStack, path) {
    if (recStack.has(component)) {
      const cycleStart = path.indexOf(component);
      const cycle = path.slice(cycleStart);
      this.circularDeps.push(cycle);
      this.errors.push(`Circular dependency detected: ${cycle.join(' → ')}`);
      return true;
    }
    
    if (visited.has(component)) {
      return false;
    }
    
    visited.add(component);
    recStack.add(component);
    
    const dependencies = graph.get(component) || [];
    for (const dep of dependencies) {
      if (this.hasCycleDFS(dep, graph, visited, recStack, [...path, dep])) {
        return true;
      }
    }
    
    recStack.delete(component);
    return false;
  }

  validateDependencyDeclarations(graph) {
    graph.forEach((dependencies, component) => {
      dependencies.forEach(dep => {
        if (!graph.has(dep) && !this.isExternalDependency(dep)) {
          this.errors.push(
            `Component '${component}' depends on '${dep}' which is not defined`
          );
        }
      });
    });
  }

  isExternalDependency(dep) {
    const externalDeps = Object.keys(this.dependencyRegistry?.externalLibraries || {});
    const browserAPIs = Object.keys(this.dependencyRegistry?.browserAPIs || {});
    
    return externalDeps.includes(dep) || browserAPIs.includes(dep) || 
           dep.includes('.js') || dep.includes('API');
  }

  async validateComponentCommunication() {
    const communicationPatterns = this.architectureRegistry?.communicationPatterns || {};
    
    await this.validateEventDrivenCommunication();
    await this.validateDirectCallPatterns();
    await this.validateGlobalStateUsage();
  }

  async validateEventDrivenCommunication() {
    const jsFiles = [
      '../js/app.js',
      '../js/storage.js', 
      '../js/dashboard.js',
      '../js/emergency.js'
    ];
    
    for (const file of jsFiles) {
      await this.checkEventPatterns(file);
    }
  }

  async checkEventPatterns(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        
        // Check for custom event dispatching
        if (line.includes('dispatchEvent') || line.includes('CustomEvent')) {
          this.validateEventHandling(line, lineNumber, filePath);
        }
        
        // Check for proper event cleanup
        if (line.includes('addEventListener') && !content.includes('removeEventListener')) {
          this.warnings.push(
            `Event listener in ${filePath} at line ${lineNumber} may lack cleanup`
          );
        }
      });
    } catch (error) {
      this.errors.push(`Failed to analyze ${filePath}: ${error.message}`);
    }
  }

  validateEventHandling(line, lineNumber, filePath) {
    // Check for proper event naming
    const eventMatch = line.match(/['"`]([^'"`]+)['"`]/);
    if (eventMatch) {
      const eventName = eventMatch[1];
      if (!eventName.includes('-') && !eventName.includes('_')) {
        this.warnings.push(
          `Event name '${eventName}' at line ${lineNumber} in ${filePath} should use kebab-case or snake_case`
        );
      }
    }
  }

  async validateDirectCallPatterns() {
    // Check for proper method chaining and error propagation
    const coreFiles = ['../js/app.js', '../js/storage.js'];
    
    for (const file of coreFiles) {
      await this.analyzeMethodCalls(file);
    }
  }

  async analyzeMethodCalls(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        
        // Check for chained method calls without error handling
        const chainRegex = /\w+\.\w+\(\).\w+\(/;
        if (chainRegex.test(line) && !line.includes('await') && !line.includes('try')) {
          this.warnings.push(
            `Method chaining at line ${lineNumber} in ${filePath} may need error handling`
          );
        }
        
        // Check for async methods called without await
        const asyncCallRegex = /(\w+)\.(\w+)\(/;
        const match = line.match(asyncCallRegex);
        if (match && this.isAsyncMethod(match[1], match[2]) && !line.includes('await')) {
          this.warnings.push(
            `Async method '${match[2]}' at line ${lineNumber} in ${filePath} called without await`
          );
        }
      });
    } catch (error) {
      this.errors.push(`Failed to analyze method calls in ${filePath}: ${error.message}`);
    }
  }

  isAsyncMethod(component, method) {
    const asyncMethods = {
      'StorageManager': ['init', 'saveToStorage', 'addPersonnel', 'checkIn', 'checkOut'],
      'CameraManager': ['init', 'capturePhoto', 'requestCameraAccess'],
      'ReportsManager': ['generateOccupancyReport', 'generatePersonnelActivityReport']
    };
    
    return asyncMethods[component]?.includes(method) || false;
  }

  async validateGlobalStateUsage() {
    const jsFiles = [
      '../js/app.js',
      '../js/dashboard.js',
      '../js/emergency.js',
      '../js/shifts.js'
    ];
    
    for (const file of jsFiles) {
      await this.checkGlobalAccess(file);
    }
  }

  async checkGlobalAccess(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      
      const globalAccessRegex = /window\.(\w+)/g;
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        let match;
        
        while ((match = globalAccessRegex.exec(line)) !== null) {
          const globalVar = match[1];
          
          if (!this.isValidGlobalAccess(globalVar)) {
            this.warnings.push(
              `Potentially invalid global access 'window.${globalVar}' at line ${lineNumber} in ${filePath}`
            );
          }
        }
      });
    } catch (error) {
      this.errors.push(`Failed to check global access in ${filePath}: ${error.message}`);
    }
  }

  isValidGlobalAccess(variable) {
    const validGlobals = [
      'StorageManager', 'app', 'DashboardManager', 'CameraManager',
      'EmergencyManager', 'OCRManager', 'QRGenerator', 'ReportsManager',
      'ShiftManager', 'TutorialManager', 'Chart'
    ];
    
    return validGlobals.includes(variable);
  }

  validatePerformancePatterns() {
    const perfConsiderations = this.architectureRegistry?.performanceConsiderations || {};
    
    // Validate lazy loading implementation
    this.validateLazyLoading(perfConsiderations.lazyLoading || []);
    
    // Validate memory management
    this.validateMemoryManagement(perfConsiderations.memoryManagement || []);
  }

  validateLazyLoading(lazyLoadingItems) {
    lazyLoadingItems.forEach(item => {
      this.warnings.push(`Verify lazy loading implementation for: ${item}`);
    });
  }

  validateMemoryManagement(memoryItems) {
    memoryItems.forEach(item => {
      this.warnings.push(`Verify memory management for: ${item}`);
    });
  }

  getReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      success: this.errors.length === 0,
      summary: `Found ${this.errors.length} architectural errors and ${this.warnings.length} warnings`,
      circularDependencies: this.circularDeps,
      categories: {
        initialization: this.errors.filter(e => e.includes('initialization')).length,
        dependencies: this.errors.filter(e => e.includes('depend')).length,
        communication: this.errors.filter(e => e.includes('communication')).length,
        performance: this.warnings.filter(w => w.includes('performance')).length
      }
    };
  }

  clearResults() {
    this.errors = [];
    this.warnings = [];
    this.circularDeps = [];
    this.componentInstances.clear();
  }
}

// Usage function
async function runArchitectureValidation() {
  const validator = new ArchitectureValidator();
  
  console.log('Loading architecture registries...');
  if (!(await validator.loadRegistries())) {
    console.error('Failed to load architecture registries');
    return;
  }
  
  console.log('Validating initialization order...');
  await validator.validateInitializationOrder();
  
  console.log('Validating dependency graph...');
  await validator.validateDependencyGraph();
  
  console.log('Validating component communication...');
  await validator.validateComponentCommunication();
  
  console.log('Validating performance patterns...');
  validator.validatePerformancePatterns();
  
  const report = validator.getReport();
  console.log('\n=== Architecture Validation Report ===');
  console.log(report.summary);
  
  if (report.circularDependencies.length > 0) {
    console.log('\nCircular Dependencies Found:');
    report.circularDependencies.forEach(cycle => {
      console.log(`  🔄 ${cycle.join(' → ')}`);
    });
  }
  
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
    console.log('\n✅ All architecture validations passed!');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArchitectureValidator;
}