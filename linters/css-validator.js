/**
 * CSS Validator Linter
 * Validates CSS classes and variables against the tracking registry
 */

class CSSValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.cssRegistry = null;
    this.usedClasses = new Set();
    this.definedClasses = new Set();
    this.usedVariables = new Set();
    this.definedVariables = new Set();
  }

  async loadRegistry() {
    try {
      const response = await fetch('../codebase-tracking/css-styles.json');
      this.cssRegistry = await response.json();
      this.extractDefinedItems();
    } catch (error) {
      console.error('Failed to load CSS registry:', error);
      return false;
    }
    return true;
  }

  extractDefinedItems() {
    if (!this.cssRegistry) return;

    // Extract CSS variables
    Object.values(this.cssRegistry.cssVariables || {}).forEach(category => {
      Object.values(category).forEach(item => {
        if (item.variable) {
          this.definedVariables.add(item.variable);
        }
      });
    });

    // Extract CSS classes from all categories
    const classCategories = [
      'layoutClasses', 'componentClasses', 'utilityClasses'
    ];

    classCategories.forEach(category => {
      const classes = this.cssRegistry[category] || {};
      this.extractClassesFromCategory(classes);
    });
  }

  extractClassesFromCategory(classes) {
    Object.values(classes).forEach(group => {
      if (typeof group === 'object') {
        Object.values(group).forEach(item => {
          if (item.selector) {
            const className = this.extractClassNameFromSelector(item.selector);
            if (className) {
              this.definedClasses.add(className);
            }
          }
        });
      }
    });
  }

  extractClassNameFromSelector(selector) {
    const match = selector.match(/\.([a-zA-Z][\w-]*)/);
    return match ? match[1] : null;
  }

  async validateCSSFiles() {
    const cssFiles = ['../css/styles.css', '../css/themes.css'];
    
    for (const file of cssFiles) {
      await this.validateCSSFile(file);
    }
  }

  async validateCSSFile(filePath) {
    try {
      const response = await fetch(filePath);
      const content = await response.text();
      this.analyzeCSSContent(content, filePath);
    } catch (error) {
      this.errors.push(`Failed to load CSS file: ${filePath} - ${error.message}`);
    }
  }

  analyzeCSSContent(content, filePath) {
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      
      // Check for CSS variable usage
      this.validateCSSVariables(line, lineNumber, filePath);
      
      // Check for class definitions
      this.validateClassDefinitions(line, lineNumber, filePath);
      
      // Check for potential issues
      this.checkForCommonIssues(line, lineNumber, filePath);
    });
  }

  validateCSSVariables(line, lineNumber, filePath) {
    const varUsageRegex = /var\((--[\w-]+)\)/g;
    const varDefinitionRegex = /(--[\w-]+)\s*:/;
    
    let match;
    
    // Check variable usage
    while ((match = varUsageRegex.exec(line)) !== null) {
      const varName = match[1];
      this.usedVariables.add(varName);
      
      if (!this.definedVariables.has(varName)) {
        this.errors.push(
          `Undefined CSS variable '${varName}' used at line ${lineNumber} in ${filePath}`
        );
      }
    }
    
    // Check variable definition
    const defMatch = line.match(varDefinitionRegex);
    if (defMatch) {
      const varName = defMatch[1];
      this.definedVariables.add(varName);
    }
  }

  validateClassDefinitions(line, lineNumber, filePath) {
    const classRegex = /\.([a-zA-Z][\w-]*)/g;
    
    let match;
    while ((match = classRegex.exec(line)) !== null) {
      const className = match[1];
      this.definedClasses.add(className);
    }
  }

  checkForCommonIssues(line, lineNumber, filePath) {
    // Check for hardcoded colors that should use variables
    const colorRegex = /#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\(|hsla\(/;
    if (colorRegex.test(line) && !line.includes('--')) {
      this.warnings.push(
        `Hardcoded color found at line ${lineNumber} in ${filePath} - consider using CSS variables`
      );
    }
    
    // Check for !important usage
    if (line.includes('!important')) {
      this.warnings.push(
        `!important usage found at line ${lineNumber} in ${filePath} - consider refactoring`
      );
    }
    
    // Check for magic numbers in spacing
    const magicNumberRegex = /:\s*[0-9]+px(?![;}])/;
    if (magicNumberRegex.test(line) && !line.includes('var(')) {
      this.warnings.push(
        `Magic number found at line ${lineNumber} in ${filePath} - consider using spacing variables`
      );
    }
  }

  async validateHTMLClassUsage() {
    try {
      const response = await fetch('../index.html');
      const content = await response.text();
      this.analyzeHTMLContent(content);
    } catch (error) {
      this.errors.push(`Failed to load HTML file: ${error.message}`);
    }
  }

  analyzeHTMLContent(content) {
    const classRegex = /class\s*=\s*["']([^"']+)["']/g;
    
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const classes = match[1].split(/\s+/);
      classes.forEach(className => {
        if (className.trim()) {
          this.usedClasses.add(className.trim());
          
          if (!this.definedClasses.has(className.trim())) {
            this.warnings.push(
              `CSS class '${className.trim()}' used in HTML but not defined in CSS`
            );
          }
        }
      });
    }
  }

  validateResponsiveDesign(content) {
    const breakpoints = ['768px', '1024px', '1200px'];
    const mediaQueryRegex = /@media[^{]+\{/g;
    
    const mediaQueries = content.match(mediaQueryRegex) || [];
    
    if (mediaQueries.length === 0) {
      this.warnings.push('No responsive media queries found - consider adding responsive design');
    }
    
    breakpoints.forEach(breakpoint => {
      const hasBreakpoint = mediaQueries.some(query => query.includes(breakpoint));
      if (!hasBreakpoint) {
        this.warnings.push(`Consider adding media query for ${breakpoint} breakpoint`);
      }
    });
  }

  checkAccessibility() {
    // Check for focus states
    if (!this.definedClasses.has('focus') && !Array.from(this.definedClasses).some(cls => cls.includes('focus'))) {
      this.warnings.push('Consider adding focus states for better accessibility');
    }
    
    // Check for high contrast considerations
    const contrastClasses = Array.from(this.definedClasses).filter(cls => 
      cls.includes('contrast') || cls.includes('accessible')
    );
    
    if (contrastClasses.length === 0) {
      this.warnings.push('Consider adding high contrast modes for accessibility');
    }
  }

  findUnusedClasses() {
    const unusedClasses = Array.from(this.definedClasses).filter(cls => 
      !this.usedClasses.has(cls)
    );
    
    unusedClasses.forEach(className => {
      this.warnings.push(`CSS class '${className}' is defined but never used`);
    });
  }

  getReport() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      success: this.errors.length === 0,
      summary: `Found ${this.errors.length} errors and ${this.warnings.length} warnings`,
      statistics: {
        definedClasses: this.definedClasses.size,
        usedClasses: this.usedClasses.size,
        definedVariables: this.definedVariables.size,
        usedVariables: this.usedVariables.size
      }
    };
  }

  clearResults() {
    this.errors = [];
    this.warnings = [];
    this.usedClasses.clear();
    this.usedVariables.clear();
  }
}

// Usage function
async function runCSSValidation() {
  const validator = new CSSValidator();
  
  console.log('Loading CSS registry...');
  if (!(await validator.loadRegistry())) {
    console.error('Failed to load CSS registry');
    return;
  }
  
  console.log('Validating CSS files...');
  await validator.validateCSSFiles();
  
  console.log('Analyzing HTML class usage...');
  await validator.validateHTMLClassUsage();
  
  console.log('Checking for unused classes...');
  validator.findUnusedClasses();
  
  console.log('Checking accessibility considerations...');
  validator.checkAccessibility();
  
  const report = validator.getReport();
  console.log('\n=== CSS Validation Report ===');
  console.log(report.summary);
  console.log(`Classes: ${report.statistics.definedClasses} defined, ${report.statistics.usedClasses} used`);
  console.log(`Variables: ${report.statistics.definedVariables} defined, ${report.statistics.usedVariables} used`);
  
  if (report.errors.length > 0) {
    console.log('\nErrors:');
    report.errors.forEach(error => console.log(`  ❌ ${error}`));
  }
  
  if (report.warnings.length > 0) {
    console.log('\nWarnings:');
    report.warnings.forEach(warning => console.log(`  ⚠️ ${warning}`));
  }
  
  if (report.success && report.warnings.length === 0) {
    console.log('\n✅ All CSS validations passed!');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSSValidator;
}