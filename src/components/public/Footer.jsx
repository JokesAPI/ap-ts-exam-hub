import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-primary-900 dark:bg-gray-950 text-blue-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg text-white mb-2">
              <BookOpen className="h-5 w-5 text-blue-300" />
              AP | TS Exam Hub
            </div>
            <p className="text-sm text-blue-200">Your one-stop portal for AP and Telangana State Exams.</p>
            <p className="text-sm text-blue-300 font-telugu mt-1">ఆంధ్రప్రదేశ్ మరియు తెలంగాణ పరీక్షలకు మీ సమగ్ర వేదిక.</p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Quick Links</h4>
            <ul className="space-y-1.5 text-sm">
              {[['/', 'Home'], ['/exams', 'Exams'], ['/previous-papers', 'Previous Papers'], ['/current-affairs', 'Current Affairs'], ['/notifications', 'Notifications']].map(([to, label]) => (
                <li key={to}><Link to={to} className="hover:text-white transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-3">Exams Covered</h4>
            <ul className="text-sm space-y-1.5 text-blue-200">
              <li>APPSC Group 1, 2, 3</li>
              <li>TSPSC Group 1, 2, 4</li>
              <li>AP / TS Police and DSC</li>
              <li>RRB, SSC (AP/TS focus)</li>
              <li>AP Grama Sachivalayam</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-blue-300">
          2024 AP TS Exam Hub. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
