import { Link } from 'react-router-dom'
import { BookOpen, Sparkles, MessageCircle } from 'lucide-react'

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
            <p className="text-sm text-blue-200">Your one-stop portal for AP and Telangana State Exams.</p>
            <p className="text-sm text-blue-300 font-telugu mt-1">ఆంధ్రప్రదేశ్ మరియు తెలంగాణ పరీక్షలకు మీ సమగ్ర వేదిక.</p>
            {/* WhatsApp Channel */}
            <a href="https://whatsapp.com/channel/aptsexamhub" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              <MessageCircle className="h-3.5 w-3.5" /> Join WhatsApp Channel
            </a>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Quick Links</h4>
            <ul className="space-y-1.5 text-sm">
              {[
                ['/', 'Home'],
                ['/exams', 'Exams'],
                ['/previous-papers', 'Previous Papers'],
                ['/current-affairs', 'Current Affairs'],
                ['/notifications', 'Notifications'],
                ['/job-alerts', 'Job Alerts'],
              ].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Features</h4>
            <ul className="space-y-1.5 text-sm">
              {[
                ['/genius-ai', '🧠 Genius AI — Free!'],
                ['/daily-quiz', '📝 Daily Quiz'],
                ['/mock-tests', '📋 Mock Tests'],
                ['/subscribe', '👑 Go Pro'],
                ['/about', 'About Us'],
                ['/contact', 'Contact'],
              ].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-3">Connect</h4>
            <ul className="space-y-1.5 text-sm mb-4">
              <li>
                <a href="https://whatsapp.com/channel/aptsexamhub" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-white transition-colors">
                  <MessageCircle className="h-4 w-4 text-green-400" /> WhatsApp Channel
                </a>
              </li>
              <li><Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
            <Link to="/genius-ai" className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
              <Sparkles className="h-3.5 w-3.5" /> Try Genius AI Free
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-blue-300">
          © {new Date().getFullYear()} AP TS Exam Hub. All rights reserved. | Nellore, Andhra Pradesh, India
        </div>
      </div>
    </footer>
  )
}
