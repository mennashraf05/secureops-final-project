# Part 6.5 Frontend Reports

Part 6.5 connects the existing Admin Reports page to the completed Report Service backend through Nginx.

## What Was Integrated

- Added `frontend/src/api/reports.ts` for Report Service calls.
- Added `frontend/src/types/report.ts` for report job TypeScript types.
- Updated `frontend/src/pages/admin/Reports.tsx` to load real report jobs instead of mock data.
- Connected the inventory report button to `POST /reports/inventory`.
- Added status filtering through `GET /reports/jobs?status=...`.

## Admin Reports Page Behavior

The Admin Reports page now:

- Loads jobs from `GET /reports/jobs`.
- Shows loading, error, and empty states.
- Shows KPI cards for total, pending, completed, and failed jobs.
- Supports filters for all, pending, processing, completed, and failed jobs.
- Displays job ID, type, status, requester, creation time, completion time, result path, and failed job errors.
- Refreshes manually with the Refresh button.

## Generate Inventory Report Flow

When an admin clicks **Generate Inventory Report**:

1. The frontend calls `POST /reports/inventory`.
2. The Report Service creates a job in PostgreSQL.
3. The Report Service publishes the job to RabbitMQ.
4. The frontend shows `Inventory report job created successfully.`
5. The frontend refreshes the jobs list immediately and once more after 3 seconds.
6. The worker consumes the RabbitMQ message, processes the job, and marks it completed or failed.

## RabbitMQ And Worker From The Frontend Perspective

The frontend does not talk to RabbitMQ or the worker directly. It only calls the Report Service through Nginx. Job status changes appear in the UI after the worker updates the PostgreSQL jobs table and the frontend reloads `GET /reports/jobs`.

## Browser Test Flow

1. Login as admin with `admin@secureops.com` and `Admin@12345`.
2. Open `/admin/reports`.
3. Confirm report jobs load from the backend.
4. Click **Generate Inventory Report**.
5. Confirm a new job appears.
6. Wait a few seconds or click Refresh.
7. Confirm status becomes completed.
8. Confirm `result_path` appears.
9. Try status filters.
10. Confirm a normal user cannot access `/admin/reports`.

## Not Implemented In Part 6.5

Actual report file download is not implemented yet because the current frontend integration only uses the Report Service job endpoints.
