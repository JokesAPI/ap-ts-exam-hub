import { Link } from 'react-router-dom'
import { BookOpen, Sparkles, MessageCircle, Mail } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-primary-900 dark:bg-gray-950 text-blue-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          <div>
            <div className="flex items-center gap-2 font-bold text-lg text-white mb-2">
              <BookOpen className="h-5 w-5 text-blue-300" />
              AP | TS Exam Hub
            </div>
            <p className="text-sm text-blue-200 mb-1">Your one-stop portal for AP and Telangana State Exams.</p>
            <p className="text-sm text-blue-300 font-telugu mb-3">ఆంధ్రప్రదేశ్ మరియు తెలంగాణ పరీక్షలకు మీ సమగ్ర వేదిక.</p>
            <div className="flex flex-col gap-2">
              <a href="https://whatsapp.com/channel/aptsexamhub" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors w-fit">
                <MessageCircle className="h-3.5 w-3.5" /> Join WhatsApp Channel
              </a>
              <a href="mailto:info.apexamhub@gmail.com"
                className="inline-flex items-center gap-2 text-blue-300 hover:text-white text-xs transition-colors">
                <Mail className="h-3.5 w-3.5" /> info.apexamhub@gmail.com
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Exams</h4>
            <ul className="space-y-1.5 text-sm">
              {[
                ['/exams', 'APPSC Group 1 & 2'],
                ['/exams', 'TSPSC Group 1 & 2'],
                ['/exams', 'AP/TS Police SI'],
                ['/exams', 'AP/TS EAPCET'],
                ['/job-alerts', 'All Job Alerts'],
              ].map(([to, label]) => (
                <li key={label}><Link to={to} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Resources</h4>
            <ul className="space-y-1.5 text-sm">
              {[
                ['/notifications', 'Notifications'],
                ['/current-affairs', 'Current Affairs'],
                ['/previous-papers', 'Previous Papers'],
                ['/mock-tests', 'Mock Tests'],
                ['/daily-quiz', 'Daily Quiz'],
              ].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">More</h4>
            <ul className="space-y-1.5 text-sm mb-4">
              {[
                ['/about', 'About Us'],
                ['/contact', 'Contact Us'],
                ['/privacy-policy', 'Privacy Policy'],
                ['/login', 'Student Login'],
              ].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
            <Link to="/genius-ai" className="inline-flex items-center gap-1.5 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 px-3 py-2 rounded-lg text-sm font-bold transition-colors">
              <Sparkles className="h-3.5 w-3.5" /> Try Genius AI Free
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-blue-300">
          <p>© {new Date().getFullYear()} AP TS Exam Hub. All rights reserved. | India</p>
          <p>📧 info.apexamhub@gmail.com</p>
        </div>
      </div>
    </footer>
  )
}
