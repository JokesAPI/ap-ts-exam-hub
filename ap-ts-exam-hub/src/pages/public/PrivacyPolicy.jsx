import Layout from '../../components/Layout'
import { Helmet } from 'react-helmet-async'

export default function PrivacyPolicy() {
  return (
    <Layout>
      <Helmet>
        <title>Privacy Policy - AP TS Exam Hub</title>
        <meta name="description" content="Privacy Policy for AP TS Exam Hub." />
      </Helmet>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">Last updated: June 17, 2026</p>
        <div className="space-y-6 text-gray-700 dark:text-gray-300">
          {[
            { title: '1. Introduction', content: 'Welcome to AP TS Exam Hub. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you visit https://ap-ts-exam-hub.vercel.app.' },
            { title: '2. Information We Collect', content: 'We collect browser type, pages visited, time and date of visit, time spent on pages, and general location (country/city level only). We do NOT collect your name, email, phone number, or personal details unless you contact us directly.' },
            { title: '3. How We Use Your Information', content: 'We use collected information to improve website content and user experience, understand which exam topics are most useful to students, show relevant advertisements through Google AdSense, and analyse website traffic using Google Analytics.' },
            { title: '4. Google AdSense & Cookies', content: 'We use Google AdSense to display advertisements. Google may use cookies to show you relevant ads based on your browsing history. You can opt out of personalised ads at google.com/settings/ads.' },
            { title: '5. Third Party Links', content: 'Our website contains links to official government websites (APPSC, TSPSC, etc.) and other educational resources. We are not responsible for the privacy practices of these external sites.' },
            { title: '6. Data Security', content: 'We take appropriate security measures to protect your information. Our website uses HTTPS encryption. However, no method of transmission over the internet is 100% secure.' },
            { title: '7. Children\'s Privacy', content: 'Our website is intended for students preparing for competitive exams. We do not knowingly collect personal information from children under 13.' },
            { title: '8. Changes to This Policy', content: 'We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page with an updated date.' },
            { title: '9. Contact Us', content: 'If you have any questions about this Privacy Policy, please contact us through our Contact page. Location: Nellore, Andhra Pradesh, India.' },
          ].map(s => (
            <div key={s.title} className="card p-6">
              <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-gray-100">{s.title}</h2>
              <p className="leading-relaxed">{s.content}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
