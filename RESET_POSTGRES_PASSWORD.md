# Reset PostgreSQL Password - Step by Step

pgAdmin 4 should now be open in your browser. Follow these steps:

## Step 1: Connect to PostgreSQL Server

1. In pgAdmin, you'll see **Servers** in the left sidebar
2. Expand **Servers** (click the arrow)
3. You should see **PostgreSQL 18**
4. Click on **PostgreSQL 18** - it will ask for a password

## Step 2: Try These Passwords

Try connecting with these passwords (one at a time):
- `pkdon123`
- `postgres`
- `admin`
- (leave blank and click OK)

## Step 3: If None Work - Reset Password

If none of the passwords work, we need to reset it:

### Option A: Reset via pg_hba.conf (Temporary Trust)

1. Close pgAdmin
2. Open this file in Notepad as Administrator:
   ```
   C:\Program Files\PostgreSQL\18\data\pg_hba.conf
   ```

3. Find these lines near the bottom:
   ```
   host    all             all             127.0.0.1/32            scram-sha-256
   host    all             all             ::1/128                 scram-sha-256
   ```

4. Change `scram-sha-256` to `trust`:
   ```
   host    all             all             127.0.0.1/32            trust
   host    all             all             ::1/128                 trust
   ```

5. Save the file

6. Restart PostgreSQL service:
   - Open Services (Win + R, type `services.msc`)
   - Find **postgresql-x64-18**
   - Right-click → Restart

7. Now you can connect without a password

8. In pgAdmin, right-click **PostgreSQL 18** → **Properties**
9. Go to **Connection** tab
10. Set new password: `pkdon123`
11. Click **Save**

12. **IMPORTANT:** Change pg_hba.conf back to `scram-sha-256` and restart PostgreSQL again

### Option B: Reset via Command Line (If you remember any admin password)

If you can access Windows as Administrator:

1. Open PowerShell as Administrator
2. Run:
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "ALTER USER postgres PASSWORD 'pkdon123';"
   ```

## Step 4: Create Database

Once you can connect to PostgreSQL:

1. In pgAdmin, right-click on **Databases**
2. Select **Create** → **Database...**
3. In the **Database** field, type: `khaacho`
4. Click **Save**

## Step 5: Update .env File

Make sure your `.env` file has the correct password:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/khaacho?schema=public"
```

## Step 6: Continue Setup

Once the database is created and .env is updated, run:
```powershell
.\setup-complete.ps1
```

---

## Quick Alternative: Use Docker PostgreSQL Instead

If this is too complicated, we can use PostgreSQL in Docker:

```powershell
# Stop Windows PostgreSQL service
Stop-Service postgresql-x64-18

# Run PostgreSQL in Docker
docker run -d --name postgres -e POSTGRES_PASSWORD=pkdon123 -e POSTGRES_DB=khaacho -p 5432:5432 postgres:16

# Update .env (same as before)
# Then run setup
.\setup-complete.ps1
```

This gives you a fresh PostgreSQL with known credentials.
