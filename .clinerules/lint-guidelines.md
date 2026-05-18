## Brief overview  
This file outlines guidelines for maintaining code quality and consistency in the multi-lingo-ai project, focusing on React component development and linting practices.  

## Coding Conventions  
- **JSX Syntax**: Always escape quotes in JSX attributes using `"` to avoid lint errors.  
- **Component Structure**: Use `useState` and `useEffect` for state management, and ensure components are pure functions.  
- **Naming**: Use descriptive names for variables and functions (e.g., `review1`, `review2`, `review3`).  

## Linting Practices  
- **React No Unescaped Entities**: Escape all quotes in JSX strings to comply with `react/no-unescaped-entities`.  
- **ESLint Configuration**: Ensure `.eslintrc` is configured to enforce strict rules for quotes and component exports.  
- **Error Handling**: Address all lint warnings and errors before committing code.  

## Development Workflow  
- **Linting**: Always run `npm run lint` after making changes to catch issues early.  
- **Testing**: Verify fixes by re-running the project and checking for runtime errors.  
- **Code Reviews**: Use `eslint` to review code changes before merging.  

## Error Handling  
- **Common Issues**:  
  - **Unescaped Quotes**: Use `"` for quotes in JSX.  
  - **Component Exports**: Ensure files only export components to avoid `react-refresh/only-export-components` warnings.  

## Project Context  
- **File Structure**: Maintain consistent directory organization (e.g., `src/components/`, `src/pages/`).  
- **Dependencies**: Use `lucide-react` for icons and `react-i18next` for localization.  

## Other Guidelines  
- **Code Readability**: Keep components concise and avoid unnecessary complexity.  
- **Auto-Formatting**: Be aware of editor auto-formatting (e.g., single vs. double quotes).  
- **Progress Tracking**: Update the `task_progress` list after each tool use to reflect current status.