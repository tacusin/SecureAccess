/**
 * Comprehensive Test Runner
 * Orchestrates all linters and provides unified reporting
 */

class CodebaseTestRunner {
  constructor() {
    this.validators = new Map();
    this.results = new Map();
    this.startTime = null;
    this.endTime = null;
  }

  async initialize() {
    console.log('🚀 Initializing Codebase Test Runner...\n');
    
    // Load all validators dynamically
    try {
      this.validators.set('function', new FunctionValidator());
      this.validators.set('css', new CSSValidator());
      this.validators.set('data', new DataIntegrityValidator());
      this.validators.set('architecture', new ArchitectureValidator());
      this.validators.set('accuracy', new AccuracyChecker());
      
      console.log('✅ All validators loaded successfully\n');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize validators:', error);
      return false;
    }
  }

  async runAllTests(options = {}) {
    this.startTime = Date.now();
    
    const {
      skipFunction = false,
      skipCSS = false,
      skipData = false,
      skipArchitecture = false,
      skipAccuracy = false,
      verbose = true
    } = options;

    console.log('🔍 Starting comprehensive codebase validation...\n');

    // Run function validation
    if (!skipFunction) {
      await this.runValidatorTest('function', 'Function Validation', async (validator) => {
        if (!(await validator.loadRegistry())) {
          throw new Error('Failed to load function registry');
        }
        
        const filesToCheck = [
          '../js/app.js',
          '../js/storage.js',
          '../js/dashboard.js',
          '../js/camera.js',
          '../js/emergency.js'
        ];
        
        for (const file of filesToCheck) {
          if (verbose) console.log(`  📄 Validating ${file}...`);
          await validator.validateFile(file);
        }
      });
    }

    // Run CSS validation
    if (!skipCSS) {
      await this.runValidatorTest('css', 'CSS Validation', async (validator) => {
        if (!(await validator.loadRegistry())) {
          throw new Error('Failed to load CSS registry');
        }
        
        if (verbose) console.log('  🎨 Validating CSS files...');
        await validator.validateCSSFiles();
        
        if (verbose) console.log('  📋 Analyzing HTML class usage...');
        await validator.validateHTMLClassUsage();
        
        validator.findUnusedClasses();
        validator.checkAccessibility();
      });
    }

    // Run data integrity validation
    if (!skipData) {
      await this.runValidatorTest('data', 'Data Integrity Validation', async (validator) => {
        if (!(await validator.loadRegistry())) {
          throw new Error('Failed to load data flow registry');
        }
        
        if (verbose) console.log('  💾 Validating storage operations...');
        await validator.validateStorageOperations();
        
        if (verbose) console.log('  🔄 Validating data flow patterns...');
        await validator.validateDataFlowPatterns();
        
        if (verbose) console.log('  📋 Validating schema compliance...');
        await validator.validateSchemaCompliance();
      });
    }

    // Run architecture validation
    if (!skipArchitecture) {
      await this.runValidatorTest('architecture', 'Architecture Validation', async (validator) => {
        if (!(await validator.loadRegistries())) {
          throw new Error('Failed to load architecture registries');
        }
        
        if (verbose) console.log('  🏗️ Validating initialization order...');
        await validator.validateInitializationOrder();
        
        if (verbose) console.log('  🔗 Validating dependency graph...');
        await validator.validateDependencyGraph();
        
        if (verbose) console.log('  📡 Validating component communication...');
        await validator.validateComponentCommunication();
        
        validator.validatePerformancePatterns();
      });
    }

    // Run accuracy validation
    if (!skipAccuracy) {
      await this.runValidatorTest('accuracy', 'Codebase Accuracy Check', async (validator) => {
        if (!(await validator.loadAllRegistries())) {
          throw new Error('Failed to load tracking registries');
        }
        
        if (verbose) console.log('  🎯 Performing comprehensive accuracy validation...');
        await validator.performAccuracyCheck();
      });
    }

    this.endTime = Date.now();
    return this.generateFinalReport();
  }

  async runValidatorTest(validatorKey, testName, testFunction) {
    console.log(`🔧 Running ${testName}...`);
    
    const validator = this.validators.get(validatorKey);
    const startTime = Date.now();
    
    try {
      await testFunction(validator);
      const report = validator.getReport();
      const duration = Date.now() - startTime;
      
      this.results.set(validatorKey, {
        name: testName,
        report,
        duration,
        success: true
      });
      
      console.log(`  ✅ ${testName} completed (${duration}ms)`);
      console.log(`  📊 ${report.errors.length} errors, ${report.warnings.length} warnings\n`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.set(validatorKey, {
        name: testName,
        report: {
          errors: [error.message],
          warnings: [],
          success: false,
          summary: `Test failed: ${error.message}`
        },
        duration,
        success: false
      });
      
      console.log(`  ❌ ${testName} failed (${duration}ms): ${error.message}\n`);
    }
  }

  generateFinalReport() {
    const totalDuration = this.endTime - this.startTime;
    const totalTests = this.results.size;
    const passedTests = Array.from(this.results.values()).filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    let totalErrors = 0;
    let totalWarnings = 0;
    
    console.log('=' .repeat(80));
    console.log('📋 COMPREHENSIVE VALIDATION REPORT');
    console.log('=' .repeat(80));
    console.log(`⏱️  Total execution time: ${totalDuration}ms`);
    console.log(`🧪 Tests run: ${totalTests} | ✅ Passed: ${passedTests} | ❌ Failed: ${failedTests}\n`);

    // Detailed results for each validator
    this.results.forEach((result, key) => {
      const { name, report, duration, success } = result;
      const status = success ? '✅' : '❌';
      
      console.log(`${status} ${name} (${duration}ms)`);
      console.log(`   ${report.summary}`);
      
      totalErrors += report.errors.length;
      totalWarnings += report.warnings.length;
      
      if (report.errors.length > 0) {
        console.log('   Errors:');
        report.errors.slice(0, 3).forEach(error => {
          console.log(`     • ${error}`);
        });
        if (report.errors.length > 3) {
          console.log(`     ... and ${report.errors.length - 3} more errors`);
        }
      }
      
      if (report.warnings.length > 0) {
        console.log('   Warnings:');
        report.warnings.slice(0, 2).forEach(warning => {
          console.log(`     • ${warning}`);
        });
        if (report.warnings.length > 2) {
          console.log(`     ... and ${report.warnings.length - 2} more warnings`);
        }
      }
      
      console.log('');
    });

    // Summary statistics
    console.log('=' .repeat(80));
    console.log('📊 OVERALL STATISTICS');
    console.log('=' .repeat(80));
    console.log(`Total Issues Found: ${totalErrors + totalWarnings}`);
    console.log(`  ❌ Errors: ${totalErrors}`);
    console.log(`  ⚠️  Warnings: ${totalWarnings}`);
    
    // Code quality score
    const maxPossibleIssues = 100; // Arbitrary baseline
    const qualityScore = Math.max(0, Math.round(((maxPossibleIssues - totalErrors - totalWarnings * 0.5) / maxPossibleIssues) * 100));
    console.log(`\n🏆 Code Quality Score: ${qualityScore}%`);
    
    if (qualityScore >= 90) {
      console.log('🌟 Excellent! Your codebase is in great shape.');
    } else if (qualityScore >= 75) {
      console.log('👍 Good! Minor improvements recommended.');
    } else if (qualityScore >= 60) {
      console.log('⚠️  Fair. Several issues should be addressed.');
    } else {
      console.log('🔧 Needs attention. Please review and fix critical issues.');
    }

    // Recommendations
    if (totalErrors > 0) {
      console.log('\n🔥 HIGH PRIORITY: Fix all errors before deployment');
    }
    
    if (totalWarnings > 10) {
      console.log('📝 MEDIUM PRIORITY: Consider addressing warnings for better code quality');
    }

    console.log('\n' + '=' .repeat(80));
    console.log('✨ Validation Complete!');
    console.log('=' .repeat(80));

    return {
      totalTests,
      passedTests,
      failedTests,
      totalErrors,
      totalWarnings,
      qualityScore,
      duration: totalDuration,
      success: failedTests === 0 && totalErrors === 0,
      results: Object.fromEntries(this.results)
    };
  }

  async runQuickTest() {
    console.log('⚡ Running Quick Validation (Essential checks only)...\n');
    
    return await this.runAllTests({
      skipCSS: true,
      skipArchitecture: true,
      skipAccuracy: true,
      verbose: false
    });
  }

  async runTacuCheck() {
    console.log('🔍 Running TACU Check (Total Accuracy Codebase Update)...\n');
    
    return await this.runAllTests({
      verbose: true
    });
  }

  generateJSONReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: this.endTime - this.startTime,
      summary: {
        totalTests: this.results.size,
        passedTests: Array.from(this.results.values()).filter(r => r.success).length,
        totalErrors: Array.from(this.results.values()).reduce((sum, r) => sum + r.report.errors.length, 0),
        totalWarnings: Array.from(this.results.values()).reduce((sum, r) => sum + r.report.warnings.length, 0)
      },
      details: Object.fromEntries(this.results)
    };

    return JSON.stringify(report, null, 2);
  }
}

// Usage functions
async function runQuickValidation() {
  const runner = new CodebaseTestRunner();
  
  if (!(await runner.initialize())) {
    console.error('Failed to initialize test runner');
    return;
  }
  
  return await runner.runQuickTest();
}

async function runTacuCheck() {
  const runner = new CodebaseTestRunner();
  
  if (!(await runner.initialize())) {
    console.error('Failed to initialize test runner');
    return;
  }
  
  return await runner.runTacuCheck();
}

async function runCustomValidation(options) {
  const runner = new CodebaseTestRunner();
  
  if (!(await runner.initialize())) {
    console.error('Failed to initialize test runner');
    return;
  }
  
  return await runner.runAllTests(options);
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CodebaseTestRunner,
    runQuickValidation,
    runTacuCheck,
    runCustomValidation
  };
}

// Auto-run if called directly
if (typeof window !== 'undefined') {
  window.CodebaseTestRunner = CodebaseTestRunner;
  window.runQuickValidation = runQuickValidation;
  window.runTacuCheck = runTacuCheck;
  window.runCustomValidation = runCustomValidation;
}