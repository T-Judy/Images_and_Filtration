# Pre-reqs
Install Node 20.19+ have a working PostgressSQL process. Make sure to update server/.env to include your Postgress access information.

# To run

Make a new terminal at base level of repository. Then run in order:

```bash
npm run setup                       # Installs server, client and root deps
npm run db:init                     # Creates the database and applies server/db/schema.sql
npm run seed                        # Seeding script to add 7 items
npm run dev                         # API on :3001, React on http://localhost:5173
```

## API reference

| Route | Purpose |
|---|---|
| `GET /api/effects` | Retrieves Effect card information |
| `POST /api/effects` (multipart) | Create a new Effect card |
| `DELETE /api/effects/:id` | Delete an Effect card |

## Credits
- Dark mode based on Material Design's dark theme color specifications
- Seed icons and data are from Limbus Company
