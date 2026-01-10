# Deployment Guide

## Database Migrations

### How Migrations Work

Database migrations are defined in `backend/database.py` in the `Database.setup()` method. This method runs automatically when the database connection pool is first created (when the backend starts).

### When You Need to Restart the Backend

**You MUST fully restart the backend container when:**
- Adding new database tables
- Adding new columns to existing tables  
- Creating new indexes
- Any ALTER TABLE or CREATE TABLE statements

**You do NOT need to restart when:**
- Adding new Python methods that query existing tables
- Adding new API endpoints
- Changing business logic
- Frontend changes

### How to Fully Restart (Dokploy)

If you need to force migrations to run:

1. Go to the Dokploy dashboard
2. Navigate to your app: `paper-trader-app-xgw7l4`
3. Click **"Stop"** (red button) - wait for containers to stop
4. Click **"Deploy"** (rocket icon) - starts everything fresh

**Important:** The "Reload" button only reloads the compose file without restarting containers - this will NOT run migrations.

### Automatic Restarts

For code-only changes (no database schema changes), Dokploy should automatically:
- Pull latest code from GitHub (if Autodeploy is ON)
- Rebuild containers
- Restart services

However, if the Python process doesn't fully restart, the database pool won't reconnect and migrations won't run.

### Troubleshooting

**Symptom:** New database column/table methods fail with "column does not exist" or similar errors

**Solution:**
1. Check backend logs for migration errors
2. Verify the migration code is in `database.py` setup()
3. Fully stop and restart the backend (see above)
4. Check logs again to confirm migration ran

**Symptom:** New API endpoint returns 500 error  

**Check:**
1. Backend logs for Python errors (import errors, syntax errors)
2. Database connection is healthy
3. All dependencies are installed

### Migration Best Practices

1. **Test locally first:** Always run migrations on your local database before deploying
2. **Make migrations idempotent:** Use `IF NOT EXISTS` and `DO $$` blocks to prevent errors on re-run
3. **Never drop columns in production:** Add new columns, deprecate old ones gradually
4. **Backup before migrations:** Ensure database backups are recent before major schema changes

### Example Migration Pattern

```python
# In database.py setup() method
await conn.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='users' AND column_name='new_column'
        ) THEN
            ALTER TABLE users ADD COLUMN new_column TEXT;
        END IF;
    END $$;
""")
```

This pattern ensures:
- Migration can run multiple times safely
- Won't error if column already exists
- Clear error messages if something goes wrong

## Deployment Checklist

- [ ] Test changes locally
- [ ] Commit and push to GitHub
- [ ] If database schema changed: Stop and Deploy in Dokploy
- [ ] If code only: Wait for auto-deploy or click Deploy
- [ ] Check backend logs for errors
- [ ] Test the new feature on production
- [ ] Monitor for any errors in the first few minutes
