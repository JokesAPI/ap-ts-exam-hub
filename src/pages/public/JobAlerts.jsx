import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Briefcase, Search, ExternalLink, Bell, MessageCircle } from 'lucide-react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabase'

const categories = ['All', 'APPSC', 'TSPSC', 'AP Police', 'TS Police', 'DSC', 'RRB', 'SSC', 'Banking', 'Defense', 'Other']

const demoJobs = [
  { id: 1, title: 'APPSC Group-1 Recruitment 2026', organization: 'APPSC', vacancies: 503, last_date: '2026-08-15', salary: '₹40,000 - ₹1,20,000', category: 'APPSC', link: 'https://psc.ap.gov.in', location: 'Andhra Pradesh' },
  { id: 2, title: 'APPSC Group-2 Recruitment 2026', organization: 'APPSC', vacancies: 453, last_date: '2026-07-30', salary: '₹35,000 - ₹1,00,000', category: 'APPSC', link: 'https://psc.ap.gov.in', location: 'Andhra Pradesh' },
  { id: 3, title: 'TSPSC Group-1 Services 2026', organization: 'TSPSC', vacancies: 500, last_date: '2026-07-15', salary: '₹40,000 - ₹1,20,000', category: 'TSPSC', link: 'https://www.tspsc.gov.in', location: 'Telangana' },
  { id: 4, title: 'TSPSC Group-2 Recruitment 2026', organization: 'TSPSC', vacancies: 400, last_date: '2026-07-20', salary: '₹35,000 - ₹1,00,000', category: 'TSPSC', link: 'https://www.tspsc.gov.in', location: 'Telangana' },
  { id: 5, title: 'AP Police SI Recruitment 2026', organization: 'AP Police', vacancies: 411, last_date: '2026-06-25', salary: '₹30,000 - ₹90,000', category: 'AP Police', link: 'https://slprb.ap.gov.in', location: 'Andhra Pradesh' },
  { id: 6, title: 'RRB NTPC Graduate Posts 2026', organization: 'RRB', vacancies: 11558, last_date: '2026-07-05', salary: '₹19,900 - ₹35,400', category: 'RRB', link: 'https://rrbsecunderabad.gov.in', location: 'All India' },
  { id: 7, title: 'SSC CGL 2026', organization: 'SSC', vacancies: 17727, last_date: '2026-07-15', salary: '₹25,000 - ₹1,12,000', category: 'SSC', link: 'https://ssc.gov.in', location: 'All India' },
  { id: 8, title: 'AP DSC Teacher Recruitment 2026', organization: 'DSC', vacancies: 10000, last_date: '2026-08-30', salary: '₹28,000 - ₹80,000', category: 'DSC', link: 'https://apteachers.in', location: 'Andhra Pradesh' },
]

export default function JobAlerts() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const filtered = demoJobs.filter(j =>
    (category === 'All' || j.category === category) &&
    j.title.toLowerCase().includes(search.toLowerCase())
  )

  function daysLeft(dateStr) {
    const diff = new Date(dateStr) - new Date()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <Layout>
      <Helmet>
        <title>Government Job Alerts AP TS 2026 — AP TS Exam Hub</title>
        <meta name="description" content="Latest government job alerts for AP and Telangana. APPSC, TSPSC, AP Police, RRB, SSC notifications 2026." />
      </Helmet>

      <section className="bg-gradient-to-br from-primary-800 to-green-700 text-white py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <Briefcase className="h-12 w-12 mx-auto mb-3 text-green-200" />
          <h1 className="text-3xl font-extrabold mb-2">Job Alerts 🔔</h1>
          <p className="text-green-100">Latest government job notifications for AP & Telangana</p>
          <p className="text-green-200 font-telugu text-sm mt-1">తాజా ప్రభుత్వ ఉద్యోగ నోటిఫికేషన్లు</p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input sm:w-44" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Active Jobs', value: demoJobs.length },
            { label: 'Total Vacancies', value: demoJobs.reduce((a, j) => a + j.vacancies, 0).toLocaleString() },
            { label: 'Updated', value: 'Today' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-xl font-bold text-primary-600">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4 mb-10">
          {filtered.map(job => {
            const days = daysLeft(job.last_date)
            return (
              <div key={job.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{job.category}</span>
                      <span className={`badge ${days <= 7 ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : days <= 15 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
                        {days > 0 ? `${days} days left` : 'Closed'}
                      </span>
                    </div>
                    <h3 className="font-bold text-base mb-1">{job.title}</h3>
                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <span>🏢 {job.organization}</span>
                      <span>📍 {job.location}</span>
                      <span>👥 {job.vacancies.toLocaleString()} vacancies</span>
                      <span>💰 {job.salary}</span>
                    </div>
                    <p className="text-xs text-red-500 mt-1.5">Last Date: {new Date(job.last_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <a href={job.link} target="_blank" rel="noopener noreferrer"
                    className="btn-primary text-sm py-2 flex-shrink-0">
                    Apply Now <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* WhatsApp Channel - NOT Telegram */}
        <div className="card p-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 text-center">
          <Bell className="h-8 w-8 mx-auto mb-3 text-green-600" />
          <h3 className="font-bold text-lg mb-1">Get Instant Job Alerts</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Join our WhatsApp Channel for instant notifications</p>
          <a href="https://whatsapp.com/channel/aptsexamhub" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl transition-colors">
            <MessageCircle className="h-5 w-5" /> Join WhatsApp Channel
          </a>
        </div>
      </div>
    </Layout>
  )
}
