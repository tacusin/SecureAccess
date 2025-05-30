# Codebase Tracking System - Master Directory

## Overview
This directory contains comprehensive tracking files for the Security Access Management System codebase. The tracking system is organized into multiple JSON files for easy maintenance and quick lookups.

## File Structure

### Core Tracking Files
- `functions-registry.json` - Complete function/method inventory with metadata
- `event-handlers.json` - All event listeners and handlers
- `css-styles.json` - CSS classes, selectors, and styling components
- `components-architecture.json` - System architecture and component relationships
- `data-flow.json` - Data flow patterns and storage operations
- `dependencies.json` - Internal and external dependencies

## How to Use This System

### 1. Finding Functions
```json
// Search functions-registry.json for:
// - Function name, location, parameters, return types
// - Dependencies and what calls this function
// - Related functions and components
```

### 2. Understanding Event Flow
```json
// Check event-handlers.json for:
// - What events trigger which functions
// - Event delegation patterns
// - User interaction flows
```

### 3. Styling Information
```json
// Use css-styles.json for:
// - CSS class definitions and usage
// - Theme variables and color schemes
// - Responsive design patterns
```

### 4. System Architecture
```json
// Reference components-architecture.json for:
// - How components interact
// - Initialization order and dependencies
// - Module relationships
```

## Maintenance Guidelines

### When Adding New Code:
1. **Functions**: Add entries to `functions-registry.json` with complete metadata
2. **Events**: Update `event-handlers.json` with new listeners or handlers
3. **Styles**: Record new CSS classes in `css-styles.json`
4. **Components**: Update architecture files when adding new modules

### When Modifying Existing Code:
1. **Update Dependencies**: If function signatures change, update all related entries
2. **Track Relationships**: Update cross-references when changing how components interact
3. **Maintain Accuracy**: Ensure descriptions match current implementation

### Search Patterns:
- **By Function Name**: Use `functions-registry.json` → search by "name" field
- **By File**: Filter any JSON file by "file" or "location" fields
- **By Functionality**: Search "description" and "purpose" fields
- **By Dependencies**: Look up "uses" and "usedBy" arrays

## Quick Reference Commands

### Find all functions in a specific file:
```bash
# Replace 'app.js' with target file
grep -A 10 -B 2 '"file": "js/app.js"' codebase-tracking/functions-registry.json
```

### Find all event handlers for specific elements:
```bash
# Replace 'menu-btn' with target element ID
grep -A 5 -B 2 'menu-btn' codebase-tracking/event-handlers.json
```

### Find CSS classes used by specific components:
```bash
# Replace 'dashboard' with component name
grep -A 10 'dashboard' codebase-tracking/css-styles.json
```

## Important Notes

### Update Frequency:
- **Immediate**: Update when adding/removing functions or major changes
- **Daily**: Review and update descriptions for accuracy
- **Weekly**: Verify cross-references and dependencies are current

### Validation:
- Ensure all function references are bidirectional (if A calls B, B should list A in usedBy)
- Verify file paths are accurate and current
- Check that CSS class names match actual implementation

### Backup Strategy:
- Keep backups of tracking files before major refactoring
- Version control these tracking files alongside source code
- Review tracking accuracy after significant code changes

## Integration with Development Workflow

### Before Starting Work:
1. Check relevant tracking files to understand current architecture
2. Review dependencies to understand impact of planned changes
3. Note what will need updating in tracking files

### During Development:
1. Update tracking files as you add/modify code
2. Use tracking files to verify you're not breaking existing dependencies
3. Reference style guides and patterns from CSS tracking

### After Completing Work:
1. Verify all tracking files are updated with your changes
2. Run through quick reference commands to ensure accuracy
3. Update any cross-references that may have changed

This system provides a single source of truth for understanding and maintaining the Security Access Management System codebase.