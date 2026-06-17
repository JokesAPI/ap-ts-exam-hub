# AP TS Exam Hub - Setup Guide

## 1. Install Dependencies
```bash
npm install
```

## 2. Supabase Setup
1. Go to https://supabase.com → Your Project → SQL Editor
2. Copy and paste the entire `supabase-schema.sql` file and run it
3. Go to Storage → Create bucket named `pdfs` → Make it **Public**
4. Go to Project Settings → API → copy:
   - **Project URL**
   - **anon public key**

## 3. Environment Variables
Create `.env` file in root:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 4. Create Admin User
In Supabase → Authentication → Users → Add User:
- Email: your-email@gmail.com
- Password: your-secure-password

## 5. Run Locally
```bash
npm run dev
```
Open http://localhost:5173

## 6. Deploy to Vercel
### Option A: Via GitHub (Recommended)
1. Push code to GitHub
2. Go to https://vercel.com → New Project → Import repo
3. Add environment variables (same as .env)
4. Deploy!

### Option B: Vercel CLI
```bash
npm install -g vercel
vercel
```

## Admin Access
URL: https://your-site.vercel.app/admin/login

## Pages
| Page | URL |
|------|-----|
| Home | / |
| Notifications | /notifications |
| Exams | /exams |
| Current Affairs | /current-affairs |
| Previous Papers | /previous-papers |
| Admin Login | /admin/login |
| Admin Dashboard | /admin |
