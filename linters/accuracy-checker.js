/**
 * Accuracy Checker Linter
 * Recursively validates codebase accuracy against tracking information
 */

class AccuracyChecker {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.findings = [];
    this.registries = {};
    this.codebaseStats = {
      functions: { documented: 0, undocumented: 0, total: 0 },
      cssClasses: { documented: 0, undocumented: 0, total: 0 },
      events: { documented: 0, undocumented: 0, total: 0 },
      components: { documented: 0, undocumented: 0, total: 0 }
    };
  }

  async loadAllRegistries() {
    console.log('📚 Loading all tracking registries...');
    
    try {
      const registryFiles = [
        'functions-registry.json',
        'event-handlers.json', 
        'css-styles.json',
        'components-architecture.json',
        'data-flow.json',
        'dependencies.json'
      ];

      for (const file of registryFiles) {
        console.log(`  📖 Loading ${file}...`);
        const response = await fetch(`../codebase-tracking/${file}`);
        const data = await response.json();
        const registryName = file.replace('.json', '').replace('-', '');
        this.registries[registryName] = data;
        console.log(`  ✅ Loaded ${file} successfully`);
      }
      
      console.log('✅ All registries loaded\n');
      return true;
    } catch (error) {
      console.error('❌ Failed to load registries:', error);
      return false;
    }
  }

  async performAccuracyCheck() {
    console.log('🔍 Starting comprehensive accuracy validation...\n');
    
    await this.validateFunctionAccuracy();
    await this.validateCSSAccuracy();
    await this.validateEventHandlerAccuracy();
    await this.validateComponentArchitecture();
    await this.validateDataFlowAccuracy();
    await this.validateDependencyAccuracy();
    
    this.generateFindings();
    return this.getAccuracyReport();
  }

  async validateFunctionAccuracy() {
    console.log('🔧 Validating function accuracy...');
    
    const jsFiles = [
      '../js/app.js',
      '../js/storage.js',
      '../js/dashboard.js',
      '../js/camera.js',
      '../js/emergency.js',
      '../js/ocr.js',
      '../js/qr-generator.js',
      '../js/reports.js',
      '../js/shifts.js'
    ];

    const registryFunctions = this.extractRegistryFunctions();
    const codebaseFunctions = new Map();

    for (const file of jsFiles) {
      console.log(`  📄 Analyzing ${file}...`);
      const functions = await this.extractFunctionsFromFile(file);
      codebaseFunctions.set(file, functions);
      
      console.log(`    Found ${functions.length} functions`);
      functions.forEach(func => {
        if (registryFunctions.has(func.name)) {
          console.log(`    ✅ ${func.name} - documented`);
          this.codebaseStats.functions.documented++;
        } else {
          console.log(`    ❓ ${func.name} - undocumented`);
          this.codebaseStats.functions.undocumented++;
          this.warnings.push(`Function ${func.name} in ${file} not documented in registry`);
        }
      });
      
      this.codebaseStats.functions.total += functions.length;
    }

    // Check for documented functions that don't exist in codebase
    registryFunctions.forEach((details, funcName) => {
      const foundInCode = Array.from(codebaseFunctions.values())
        .flat()
        .some(func => func.name === funcName);
      
      if (!foundInCode) {
        console.log(`    ⚠️ Registry function ${funcName} not found in codebase`);
        this.warnings.push(`Registry documents function ${funcName} that doesn't exist in codebase`);
      }
    });

    console.log(`  📊 Function accuracy: ${this.codebaseStats.functions.documented}/${this.codebaseStats.functions.total} documented\n`);
  }

  extractRegistryFunctions() {
    const functions = new Map();
    const registry = this.registries.functionsregistry;
    
    if (registry && registry.functions) {
      registry.functions.forEach(component => {
        if (component.methods) {
          component.methods.forEach(method => {
            functions.set(method.name, {
              component: component.name,
              line: method.line,
              description: method.description
            });
          });
        }
      });
    }
    
    return functions;
  }

  async extractFunctionsFromFile(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      const lines = content.split('\n');
      const functions = [];
      
      const functionRegex = /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*\{/;
      
      lines.forEach((line, index) => {
        const match = line.match(functionRegex);
        if (match) {
          functions.push({
            name: match[2],
            line: index + 1,
            async: !!match[1],
            file: filePath
          });
        }
      });
      
      return functions;
    } catch (error) {
      console.log(`    ❌ Error reading ${filePath}: ${error.message}`);
      return [];
    }
  }

  async validateCSSAccuracy() {
    console.log('🎨 Validating CSS accuracy...');
    
    const cssFiles = ['../css/styles.css', '../css/themes.css'];
    const htmlFile = '../index.html';
    
    const registryClasses = this.extractRegistryClasses();
    const codebaseClasses = new Set();
    const usedClasses = new Set();

    // Extract classes from CSS files
    for (const file of cssFiles) {
      console.log(`  📄 Analyzing ${file}...`);
      const classes = await this.extractCSSClasses(file);
      classes.forEach(cls => {
        codebaseClasses.add(cls);
        if (registryClasses.has(cls)) {
          console.log(`    ✅ .${cls} - documented`);
          this.codebaseStats.cssClasses.documented++;
        } else {
          console.log(`    ❓ .${cls} - undocumented`);
          this.codebaseStats.cssClasses.undocumented++;
        }
      });
      
      this.codebaseStats.cssClasses.total += classes.length;
    }

    // Extract used classes from HTML
    console.log(`  📄 Analyzing HTML class usage...`);
    const htmlClasses = await this.extractHTMLClasses(htmlFile);
    htmlClasses.forEach(cls => usedClasses.add(cls));

    // Check for unused classes
    codebaseClasses.forEach(cls => {
      if (!usedClasses.has(cls)) {
        console.log(`    🔄 .${cls} - defined but not used`);
        this.findings.push(`CSS class .${cls} is defined but never used`);
      }
    });

    // Check for undefined classes being used
    usedClasses.forEach(cls => {
      if (!codebaseClasses.has(cls)) {
        console.log(`    ❌ .${cls} - used but not defined`);
        this.errors.push(`CSS class .${cls} is used but not defined`);
      }
    });

    console.log(`  📊 CSS accuracy: ${this.codebaseStats.cssClasses.documented}/${this.codebaseStats.cssClasses.total} documented\n`);
  }

  extractRegistryClasses() {
    const classes = new Set();
    const registry = this.registries.cssstyles;
    
    if (registry) {
      const categories = ['layoutClasses', 'componentClasses', 'utilityClasses'];
      categories.forEach(category => {
        const categoryClasses = registry[category] || {};
        Object.values(categoryClasses).forEach(group => {
          if (typeof group === 'object') {
            Object.values(group).forEach(item => {
              if (item.selector) {
                const match = item.selector.match(/\.([a-zA-Z][\w-]*)/);
                if (match) classes.add(match[1]);
              }
            });
          }
        });
      });
    }
    
    return classes;
  }

  async extractCSSClasses(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      const classes = new Set();
      
      const classRegex = /\.([a-zA-Z][\w-]*)/g;
      let match;
      
      while ((match = classRegex.exec(content)) !== null) {
        classes.add(match[1]);
      }
      
      return Array.from(classes);
    } catch (error) {
      console.log(`    ❌ Error reading ${filePath}: ${error.message}`);
      return [];
    }
  }

  async extractHTMLClasses(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      const classes = new Set();
      
      const classRegex = /class\s*=\s*["']([^"']+)["']/g;
      let match;
      
      while ((match = classRegex.exec(content)) !== null) {
        const classList = match[1].split(/\s+/);
        classList.forEach(cls => {
          if (cls.trim()) classes.add(cls.trim());
        });
      }
      
      return Array.from(classes);
    } catch (error) {
      console.log(`    ❌ Error reading ${filePath}: ${error.message}`);
      return [];
    }
  }

  async validateEventHandlerAccuracy() {
    console.log('⚡ Validating event handler accuracy...');
    
    const registryEvents = this.extractRegistryEvents();
    const codebaseEvents = await this.extractCodebaseEvents();
    
    console.log(`  📊 Registry has ${registryEvents.size} documented event handlers`);
    console.log(`  📊 Codebase has ${codebaseEvents.size} event listeners`);
    
    // Check documented events exist in code
    registryEvents.forEach((details, eventKey) => {
      if (codebaseEvents.has(eventKey)) {
        console.log(`    ✅ ${eventKey} - documented and implemented`);
        this.codebaseStats.events.documented++;
      } else {
        console.log(`    ❓ ${eventKey} - documented but not found in code`);
        this.warnings.push(`Event handler ${eventKey} documented but not found in codebase`);
      }
    });
    
    // Check undocumented events in code
    codebaseEvents.forEach((details, eventKey) => {
      if (!registryEvents.has(eventKey)) {
        console.log(`    ❓ ${eventKey} - implemented but not documented`);
        this.codebaseStats.events.undocumented++;
        this.warnings.push(`Event handler ${eventKey} in code but not documented`);
      }
      this.codebaseStats.events.total++;
    });

    console.log(`  📊 Event accuracy: ${this.codebaseStats.events.documented}/${this.codebaseStats.events.total} documented\n`);
  }

  extractRegistryEvents() {
    const events = new Map();
    const registry = this.registries.eventhandlers;
    
    if (registry && registry.eventHandlers) {
      registry.eventHandlers.forEach(handler => {
        const key = `${handler.element || handler.elementId}-${handler.event}`;
        events.set(key, handler);
      });
    }
    
    return events;
  }

  async extractCodebaseEvents() {
    const events = new Map();
    const jsFiles = ['../js/app.js', '../js/dashboard.js', '../js/camera.js'];
    
    for (const file of jsFiles) {
      try {
        const response = await fetch(file);
        const content = await response.text();
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          const eventMatch = line.match(/addEventListener\s*\(\s*['"`](\w+)['"`]/);
          const elementMatch = line.match(/getElementById\s*\(\s*['"`]([^'"`]+)['"`]\)|document\.querySelector/);
          
          if (eventMatch) {
            const eventType = eventMatch[1];
            const element = elementMatch ? elementMatch[1] : 'unknown';
            const key = `${element}-${eventType}`;
            
            events.set(key, {
              file,
              line: index + 1,
              event: eventType,
              element
            });
          }
        });
      } catch (error) {
        console.log(`    ❌ Error reading ${file}: ${error.message}`);
      }
    }
    
    return events;
  }

  async validateComponentArchitecture() {
    console.log('🏗️ Validating component architecture...');
    
    const registry = this.registries.componentsarchitecture;
    if (!registry) {
      console.log('  ❌ No architecture registry found');
      return;
    }

    const coreComponents = registry.systemArchitecture?.coreComponents || [];
    console.log(`  📊 Registry documents ${coreComponents.length} core components`);
    
    for (const component of coreComponents) {
      console.log(`  🔍 Checking ${component.name}...`);
      
      const exists = await this.checkComponentExists(component.file);
      if (exists) {
        console.log(`    ✅ Component file exists: ${component.file}`);
        
        const dependencies = await this.validateComponentDependencies(component);
        if (dependencies.valid) {
          console.log(`    ✅ Dependencies satisfied`);
        } else {
          console.log(`    ❌ Missing dependencies: ${dependencies.missing.join(', ')}`);
          this.errors.push(`Component ${component.name} missing dependencies: ${dependencies.missing.join(', ')}`);
        }
        
        this.codebaseStats.components.documented++;
      } else {
        console.log(`    ❌ Component file missing: ${component.file}`);
        this.errors.push(`Component ${component.name} file not found: ${component.file}`);
        this.codebaseStats.components.undocumented++;
      }
      
      this.codebaseStats.components.total++;
    }

    console.log(`  📊 Component accuracy: ${this.codebaseStats.components.documented}/${this.codebaseStats.components.total} exist\n`);
  }

  async checkComponentExists(filePath) {
    try {
      const response = await fetch(filePath);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async validateComponentDependencies(component) {
    const dependencies = component.dependencies || [];
    const missing = [];
    
    for (const dep of dependencies) {
      const exists = await this.checkDependencyExists(dep);
      if (!exists) {
        missing.push(dep);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }

  async checkDependencyExists(dependency) {
    // Check if it's a browser API
    if (dependency.includes('API') || dependency === 'localStorage' || dependency === 'fetch') {
      return true;
    }
    
    // Check if it's an external library
    if (dependency.includes('.js') || dependency === 'Chart.js' || dependency === 'QRCode.js') {
      return true;
    }
    
    // Check if it's an internal component
    const componentFile = `../js/${dependency.toLowerCase()}.js`;
    return await this.checkComponentExists(componentFile);
  }

  async validateDataFlowAccuracy() {
    console.log('💾 Validating data flow accuracy...');
    
    const registry = this.registries.dataflow;
    if (!registry) {
      console.log('  ❌ No data flow registry found');
      return;
    }

    const storageKeys = Object.keys(registry.storageOperations?.localStorage?.keys || {});
    console.log(`  📊 Registry documents ${storageKeys.length} storage keys`);
    
    const codebaseKeys = await this.extractStorageKeys();
    console.log(`  📊 Codebase uses ${codebaseKeys.size} storage keys`);
    
    // Check documented keys are used
    storageKeys.forEach(key => {
      if (codebaseKeys.has(key)) {
        console.log(`    ✅ Storage key '${key}' - documented and used`);
      } else {
        console.log(`    ❓ Storage key '${key}' - documented but not used`);
        this.warnings.push(`Storage key '${key}' documented but not found in codebase`);
      }
    });
    
    // Check undocumented keys in use
    codebaseKeys.forEach(key => {
      if (!storageKeys.includes(key)) {
        console.log(`    ❓ Storage key '${key}' - used but not documented`);
        this.warnings.push(`Storage key '${key}' used but not documented`);
      }
    });

    console.log('  📊 Data flow patterns validated\n');
  }

  async extractStorageKeys() {
    const keys = new Set();
    const storageFile = '../js/storage.js';
    
    try {
      const response = await fetch(storageFile);
      const content = await response.text();
      
      const keyRegex = /localStorage\.[gs]etItem\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let match;
      
      while ((match = keyRegex.exec(content)) !== null) {
        keys.add(match[1]);
      }
    } catch (error) {
      console.log(`    ❌ Error reading storage file: ${error.message}`);
    }
    
    return keys;
  }

  async validateDependencyAccuracy() {
    console.log('🔗 Validating dependency accuracy...');
    
    const registry = this.registries.dependencies;
    if (!registry) {
      console.log('  ❌ No dependencies registry found');
      return;
    }

    const externalDeps = Object.keys(registry.externalLibraries || {});
    console.log(`  📊 Registry documents ${externalDeps.length} external dependencies`);
    
    for (const dep of externalDeps) {
      const details = registry.externalLibraries[dep];
      console.log(`  🔍 Checking ${dep}...`);
      
      if (details.source) {
        const accessible = await this.checkExternalDependency(details.source);
        if (accessible) {
          console.log(`    ✅ ${dep} - accessible`);
        } else {
          console.log(`    ❌ ${dep} - not accessible`);
          this.warnings.push(`External dependency ${dep} not accessible at ${details.source}`);
        }
      }
    }

    console.log('  📊 Dependencies validated\n');
  }

  async checkExternalDependency(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  generateFindings() {
    const accuracyPercentages = {
      functions: this.calculateAccuracy(this.codebaseStats.functions),
      cssClasses: this.calculateAccuracy(this.codebaseStats.cssClasses),
      events: this.calculateAccuracy(this.codebaseStats.events),
      components: this.calculateAccuracy(this.codebaseStats.components)
    };

    this.findings.push(`Function documentation accuracy: ${accuracyPercentages.functions}%`);
    this.findings.push(`CSS class documentation accuracy: ${accuracyPercentages.cssClasses}%`);
    this.findings.push(`Event handler documentation accuracy: ${accuracyPercentages.events}%`);
    this.findings.push(`Component architecture accuracy: ${accuracyPercentages.components}%`);
    
    const overallAccuracy = Object.values(accuracyPercentages).reduce((sum, acc) => sum + acc, 0) / 4;
    this.findings.push(`Overall tracking accuracy: ${overallAccuracy.toFixed(1)}%`);
  }

  calculateAccuracy(stats) {
    if (stats.total === 0) return 100;
    return Math.round((stats.documented / stats.total) * 100);
  }

  getAccuracyReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      findings: this.findings,
      statistics: this.codebaseStats,
      success: this.errors.length === 0,
      summary: `Accuracy check: ${this.errors.length} errors, ${this.warnings.length} warnings, ${this.findings.length} findings`
    };
  }

  clearResults() {
    this.errors = [];
    this.warnings = [];
    this.findings = [];
    this.codebaseStats = {
      functions: { documented: 0, undocumented: 0, total: 0 },
      cssClasses: { documented: 0, undocumented: 0, total: 0 },
      events: { documented: 0, undocumented: 0, total: 0 },
      components: { documented: 0, undocumented: 0, total: 0 }
    };
  }
}

// Usage function
async function runAccuracyCheck() {
  console.log('🎯 Starting Codebase Accuracy Check...\n');
  
  const checker = new AccuracyChecker();
  
  if (!(await checker.loadAllRegistries())) {
    console.error('❌ Failed to load tracking registries');
    return;
  }
  
  const report = await checker.performAccuracyCheck();
  
  console.log('=' .repeat(80));
  console.log('🎯 ACCURACY CHECK REPORT');
  console.log('=' .repeat(80));
  console.log(report.summary);
  
  if (report.findings.length > 0) {
    console.log('\n📊 Key Findings:');
    report.findings.forEach(finding => console.log(`  • ${finding}`));
  }
  
  if (report.errors.length > 0) {
    console.log('\n❌ Errors:');
    report.errors.forEach(error => console.log(`  • ${error}`));
  }
  
  if (report.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    report.warnings.forEach(warning => console.log(`  • ${warning}`));
  }
  
  console.log('\n' + '=' .repeat(80));
  
  return report;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AccuracyChecker, runAccuracyCheck };
}