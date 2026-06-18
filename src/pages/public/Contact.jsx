import Layout from '../../components/Layout'
import { Helmet } from 'react-helmet-async'
import { Mail, MapPin, Send, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })

  function handleSubmit(e) {
    e.preventDefault()
    toast.success('Message sent! We will reply within 24 hours.')
    setForm({ name: '', email: '', subject: '', message: '' })
  }

  return (
    <Layout>
      <Helmet>
        <title>Contact Us - AP TS Exam Hub</title>
        <meta name="description" content="Contact AP TS Exam Hub for any queries about AP and Telangana state exams." />
      </Helmet>

      <section className="bg-gradient-to-br from-primary-800 to-primary-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold mb-2">Contact Us</h1>
          <p className="text-blue-100">Have a question? We are here to help!</p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-8">

          {/* Contact Info */}
          <div className="space-y-5">
            <h2 className="text-xl font-bold">Get In Touch</h2>
            <div className="card p-5 flex items-start gap-4">
              <MapPin className="h-5 w-5 text-primary-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold">Location</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">India</p>
              </div>
            </div>
            <div className="card p-5 flex items-start gap-4">
              <Mail className="h-5 w-5 text-primary-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold">Email</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">info.apexamhub@gmail.com</p>
              </div>
            </div>
            <div className="card p-5 flex items-start gap-4">
              <MessageCircle className="h-5 w-5 text-primary-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold">Telegram</p>
                <a href="https://t.me/aptsexamhub" target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:underline">@aptsexamhub</a>
              </div>
            </div>

            <div className="card p-5 bg-blue-50 dark:bg-blue-900/20">
              <p className="font-semibold mb-2">Response Time</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">We typically reply within <strong>24 hours</strong>. For urgent queries join our Telegram channel.</p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-5">Send a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Your Name</label>
                <input className="input" placeholder="Ravi Kumar" required
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="input" placeholder="ravi@gmail.com" required
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input className="input" placeholder="Question about APPSC exam"
                  value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea className="input resize-none" rows={4} placeholder="Type your message here..."
                  required value={form.message} onChange={e => setForm({...form, message: e.target.value})} />
              </div>
              <button type="submit" className="btn-primary w-full justify-center">
                <Send className="h-4 w-4" /> Send Message
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  )
}
