# AI Rules for ManyPost Development

This document outlines the core technologies and specific library usage guidelines for the ManyPost application. Adhering to these rules ensures consistency, maintainability, and leverages the strengths of our chosen tech stack.

## Tech Stack Overview

*   **Frontend Framework:** React with TypeScript for building dynamic user interfaces.
*   **Build Tool:** Vite for a fast development experience and optimized builds.
*   **UI Components:** Primarily shadcn/ui for pre-built, accessible, and customizable UI components.
*   **Styling:** Tailwind CSS for all styling, providing utility-first classes for responsive and consistent designs.
*   **Icons:** Lucide React for a comprehensive set of SVG icons.
*   **Routing:** React Router DOM for declarative client-side routing.
*   **Backend & Database:** Supabase, providing PostgreSQL database, authentication, and serverless Edge Functions.
*   **API Interaction:** Supabase client library for database and auth, native `fetch` API for other external services.
*   **Cloud Storage:** Cloudflare R2 for efficient and scalable video file storage (managed by Supabase Edge Functions).
*   **External APIs:** YouTube Data API v3 for video publishing and channel management.

## Library Usage Rules

To maintain a consistent and efficient codebase, please follow these rules for library usage:

1.  **UI Components:**
    *   **Prioritize shadcn/ui:** Always look for a suitable component within the shadcn/ui library first.
    *   **Custom Components:** If a required component is not available in shadcn/ui or needs significant, unique customization, create a new component in `src/components/` using Tailwind CSS and Lucide React. Do not modify existing shadcn/ui components directly.
2.  **Styling:**
    *   **Tailwind CSS Only:** All styling must be done using Tailwind CSS utility classes. Avoid inline styles or custom CSS files unless absolutely necessary for very specific, isolated cases (e.g., third-party library overrides).
3.  **Icons:**
    *   **Lucide React:** Use icons from the `lucide-react` package for all visual iconography.
4.  **Routing:**
    *   **React Router DOM:** Use `react-router-dom` for all navigation and route management. All main application routes should be defined in `src/App.tsx`.
5.  **State Management:**
    *   **React Context:** For global application state (like authentication status), use React Context (e.g., `AuthContext`).
    *   **React Hooks:** For local component state, use `useState` and `useEffect`.
6.  **API Calls:**
    *   **Supabase Client:** For all interactions with the Supabase database (e.g., `supabase.from('table').select()`) and authentication (`supabase.auth`), use the `@supabase/supabase-js` client.
    *   **Native Fetch API:** For calling external APIs (like the YouTube Data API or your own Supabase Edge Functions from the frontend), use the native `fetch` API.
7.  **Date and Time:**
    *   **Native Date Objects:** Use standard JavaScript `Date` objects for handling dates and times. For displaying dates and times to the user, use `Date.toLocaleString()` or similar native methods.
8.  **Forms:**
    *   **Native HTML & React State:** Utilize native HTML form elements (`<input>`, `<select>`, `<textarea>`) managed by React's `useState` for form data.