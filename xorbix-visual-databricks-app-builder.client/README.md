# VDAB Frontend

React 19 + React Router v7 (Framework Mode) + TypeScript + Vite + shadcn/ui + Tailwind CSS

## Tech Stack

- **React 19** - Latest React with modern features
- **React Router v7** - Framework Mode with file-based routing
- **TypeScript** - Type-safe development
- **Vite** - Fast development server and build tool
- **shadcn/ui** - Accessible component library built on Radix UI
- **Tailwind CSS** - Utility-first CSS framework
- **ESLint** - Code linting and formatting

## Project Structure

```
src/
├── assets/          # Static assets (images, fonts, etc.)
├── components/      # Reusable React components
│   └── ui/         # shadcn/ui components
├── config/         # Configuration files (API URLs, constants)
├── lib/            # Utility functions and helpers
├── routes/         # React Router v7 route components
└── main.tsx        # Application entry point
```

## Development

### Running Locally

The frontend is started automatically by the Aspire AppHost. Alternatively, run standalone:

```bash
npm ci              # Install dependencies
npm run dev         # Start Vite dev server
```

The dev server runs on `http://localhost:5173` and automatically connects to the API.

### Environment Variables

The application uses the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | Set by Aspire |
| `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure App Insights Connection String | - |
| `VITE_DISABLE_APP_INSIGHTS` | Disable App Insights initialization (set to any value) | - |
| `VITE_DEBUG_MODE` | Enable debug mode features | `false` |
| `VITE_LOG_TO_CONSOLE` | Output logs to browser console | `false` |
| `VITE_LOG_LEVEL` | Minimum log level (`info`, `warn`, `error`) | `info` |
| `VITE_LOG_FILTER_MODE` | Filter strategy (`include`, `exclude`) | `exclude` |
| `VITE_LOG_FILTER_LIST` | Comma-separated list of logger prefixes | `""` |

- **Local Development**: Set by Aspire AppHost (e.g., `http://localhost:7023`)
- **Azure Deployment**: Set by CI/CD pipeline (e.g., `https://xorbix-vdab-dev.azurewebsites.net`)

Vite embeds environment variables at build time, so rebuilds are required when changing environments.

## Logging & Telemetry

The application uses a custom `useLogger` hook that integrates with both the browser console and Azure Application Insights.

### Usage

```tsx
import { useLogger } from "../logger/useLogger";

const MyComponent = () => {
  const logger = useLogger("MyComponent"); // "MyComponent" is the prefix

  const handleClick = () => {
    // Simple log
    logger.UI.log("Button clicked");

    // Structured log with metadata
    logger.UI.info("Action performed", { actionId: 123, user: "admin" });

    // Error logging
    try {
      throw new Error("Oops");
    } catch (err) {
      const errorObj: CommonError = logger.handleError(err, "handleClick");
      // Access the parsed error message
    }
  };
};
```

### Configuration

Logging behavior is controlled via environment variables (see above). These settings are loaded into the global `SettingsContext` at startup and consumed by the `useLogger` hook.

- **Filtering**: You can filter logs by their prefix.
    - `VITE_LOG_FILTER_MODE=include`: Only show logs from prefixes in the list.
    - `VITE_LOG_FILTER_MODE=exclude`: Show all logs EXCEPT those in the list.
    - `VITE_LOG_FILTER_LIST=AuthService,Navigation`: Example list.

- **Styling**: Console logs are color-coded by level (Info: Cyan, Warn: Yellow, Error: Red) with bold prefixes for readability.

### Architecture

The logger is split into two channels:

1.  **UI Channel (`logger.UI`)**:
    - Writes to the local in-memory trace store.
    - Writes to the browser console (if `VITE_LOG_TO_CONSOLE` is true).
    - Used for local debugging and displaying logs in the UI.

2.  **AI Channel (`logger.AI`)**:
    - Sends telemetry to Azure Application Insights.
    - **Also writes to the UI channel** (so you don't need to log to both).
    - Used for production monitoring and diagnostics.

### Error Handling (`logger.handleError`)

The `handleError` function provides a standardized way to process exceptions:

1.  **Parses** the error into a standard `CommonError` format (handling `ProblemDetails`, `FluentResults`, etc.).
2.  **Logs** the error to both UI and AI channels.
3.  **Uploads** the recent local trace history to Application Insights (providing context leading up to the error).
4.  **Returns** the parsed error object for UI display.

```tsx
try {
  await api.getData();
} catch (err) {
  // Logs error, uploads traces, and returns a displayable error object
  const errorObj = logger.handleError(err, "DataFetch");
  setError(errorObj.message);
}
```

## Building

### Development Build
```bash
npm run build       # Build for development
npm run preview     # Preview production build locally
```

### Production Build
The CI/CD pipeline handles production builds with environment-specific configuration:

```bash
VITE_API_BASE_URL="https://xorbix-vdab-dev.azurewebsites.net" npm run build
```

The build output (`build/client/`) is copied to the API's `wwwroot` folder for deployment.

## Code Style & Linting

### ESLint Configuration

The project uses ESLint with TypeScript support:

```bash
npm run lint        # Run ESLint
```

**Note:** The `build` directory is ignored in ESLint configuration for React Router's publishing target.

### Formatting

Use Prettier for consistent code formatting:

- Enable "Format on Save" in your editor
- Follow project-specific formatting rules

## Adding Components

### shadcn/ui Components

Add new shadcn/ui components using the CLI:

```bash
npx shadcn@latest add <component-name>
```

This will:
- Download the component to `src/components/ui/`
- Configure it with the project's Tailwind theme
- Make it available for use

Example:
```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add form
```

### Custom Components

Create reusable components in `src/components/`:

```tsx
// src/components/MyComponent.tsx
export function MyComponent({ prop }: { prop: string }) {
  return <div>{prop}</div>;
}
```

## React Router v7 (Framework Mode)

### File-Based Routing

Routes are defined in `src/routes/`:

```
routes/
├── _index.tsx      # Homepage (/)
├── about.tsx       # About page (/about)
└── users/
    ├── $id.tsx     # User detail (/users/:id)
    └── index.tsx   # Users list (/users)
```

### Creating Routes

```tsx
// src/routes/example.tsx
import type { Route } from "./+types/example";

export async function loader({ params }: Route.LoaderArgs) {
  // Fetch data
  return { data };
}

export default function Example({ loaderData }: Route.ComponentProps) {
  return <div>{loaderData.data}</div>;
}
```

## API Integration

API calls are made via `src/config/api.ts`:

```typescript
import { API_BASE_URL } from "@/config/api";

// Example API call
const response = await fetch(`${API_BASE_URL}/api/endpoint`);
const data = await response.json();
```

## Troubleshooting

### Port Already in Use
If port 5173 is already in use:
```bash
# Kill the process or change the port in vite.config.ts
```

### Type Errors
```bash
npm run type-check  # Check TypeScript types
```

### Build Errors
- Ensure all dependencies are installed: `npm ci`
- Clear cache: `rm -rf node_modules/.vite`
- Rebuild: `npm run build`

## Additional Resources

- [React Router v7 Docs](https://reactrouter.com/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/)

## Frontend Development Guidelines

See [Frontend Instructions](../.github/instructions/frontend.instructions.md) for detailed coding standards and best practices
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

## TODO

1. Need to handle --noEmit flag in the build command in package.json
