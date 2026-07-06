# Archive

## backend-go
The original Go (chi) REST API from the first NEDB build. Superseded in June 2026:
the frontend now talks to Supabase directly through Next.js route handlers, and
nothing in production imports this code. Kept for reference — the validator,
stats service and XLSX template generator may be useful if a standalone API
tier is ever needed again.
