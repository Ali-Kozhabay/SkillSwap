# SkillSwap Frontend

Angular 21 single-page application for the SkillSwap marketplace.

## Responsibilities

- Public marketplace browsing and filtering
- Authentication screens
- Service creation and owner management
- Booking dashboard for provider and client workflows
- Live booking chat UI

## Local Run

```bash
npm install
npm start
```

The development server runs on `http://localhost:4200` and proxies `/api` requests to the Django backend through [`proxy.conf.json`](proxy.conf.json).

## Useful Commands

```bash
npm run build
npm test -- --watch=false
```

## Important Frontend Routes

- `/login`
- `/services`
- `/service/:id`
- `/dashboard`
- `/dashboard/services/new`
- `/chat/:bookingId`

## Notes

- Authentication uses HTTP-only JWT cookies, so API calls are sent with credentials.
- Route guards protect dashboard and chat pages.
- The UI is intentionally marketplace-focused to support a live project defense and demo flow.
