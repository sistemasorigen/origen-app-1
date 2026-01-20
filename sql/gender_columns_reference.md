# SQL for Gender Compatibility Check

The database schema already has the required columns:

## Groups Table
The `target_gender` column already exists with values:
- `'Hombre'`
- `'Mujer'`
- `'Mixto/No especificar'`

**SQL to add if missing:**
```sql
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS target_gender TEXT DEFAULT 'Mixto/No especificar';
```

## Users/Profiles Table
The `gender` column already exists with values:
- `'Hombre'`
- `'Mujer'`

**SQL to add if missing:**
```sql
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS gender TEXT;
```

---

## No SQL Migration Needed
Both columns already exist in the database. The frontend logic has been updated to:
1. Check gender compatibility before allowing join
2. Display lock icon with "SOLO HOMBRES" or "SOLO MUJERES" text for incompatible groups
