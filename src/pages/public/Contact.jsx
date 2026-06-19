import Layout from '../../components/Layout'
import { Helmet } from 'react-helmet-async'
import { Mail, MapPin, Send, MessageCircle, Clock, CheckCircle } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('Please fill all required fields')
      return
    }
    setSending(true)

    try {
      // Save to Supabase
      const { error } = await supabase.from('contact_messages').insert([{
        name: form.name,
        email: form.email,
        subject: form.subject || 'General Enquiry',
        message: form.message
      }])

      if (error) throw error

      // Also open WhatsApp
      const text = `*New Message — AP TS Exam Hub*\n\n*Name:* ${form.name}\n*Email:* ${form.email}\n*Subject:* ${form.subject || 'General'}\n*Message:* ${form.message}`
      window.open(`https://wa.me/919999999999?text=${encodeURIComponent(text)}`, '_blank')

      setSent(true)
      setForm({ name: '', email: '', subject: '', message: '' })
      toast.success('Message sent successfully!')
    } catch (err) {
      toast.error('Failed to send. Please try WhatsApp directly.')
    }
    setSending(false)
  }

  return (
    <Layout>
      <Helmet>
        <title>Contact Us - AP TS Exam Hub</title>
        <meta name="description" content="Contact AP TS Exam Hub. Email: info.apexamhub@gmail.com. Based in Nellore, Andhra Pradesh." />
      </Helmet>

      <section className="bg-gradient-to-br from-primary-800 to-primary-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-extrabold mb-2">Contact Us</h1>
          <p className="text-blue-100">We reply within 24 hours — info.apexamhub@gmail.com</p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-8">

          {/* Contact Info */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Get In Touch</h2>

            <div className="card p-5 flex items-start gap-4">
              <MapPin className="h-5 w-5 text-primary-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold">Location</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Nellore, Andhra Pradesh, India</p>
              </div>
            </div>

            <div className="card p-5 flex items-start gap-4">
              <Mail className="h-5 w-5 text-primary-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold">Email</p>
                <a href="mailto:info.apexamhub@gmail.com" className="text-sm text-primary-600 hover:underline">
                  info.apexamhub@gmail.com
                </a>
              </div>
            </div>

            <div className="card p-5 flex items-start gap-4 border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <MessageCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">WhatsApp Channel</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Get instant exam alerts on WhatsApp</p>
                <a href="https://whatsapp.com/channel/aptsexamhub" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                  <MessageCircle className="h-4 w-4" /> Join WhatsApp Channel
                </a>
              </div>
            </div>

            <div className="card p-5 flex items-start gap-4">
              <Clock className="h-5 w-5 text-primary-600 mt-1 flex-shrink-0" />
              <div>
                <p className="font-semibold">Response Time</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">We reply within <strong>24 hours</strong>. For urgent queries join our WhatsApp channel.</p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-5">Send a Message</h2>

            {sent ? (
              <div className="text-center py-10">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="font-bold text-lg mb-2 text-green-600">Message Sent! ✅</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">Thank you for contacting us. We will reply to <strong>{form.email || 'your email'}</strong> within 24 hours.</p>
                <button onClick={() => setSent(false)} className="btn-secondary text-sm">Send Another Message</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Your Name *</label>
                  <input className="input" placeholder="Ravi Kumar" required
                    value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input type="email" className="input" placeholder="ravi@gmail.com" required
                    value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subject</label>
                  <input className="input" placeholder="Question about APPSC exam"
                    value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Message *</label>
                  <textarea className="input resize-none" rows={4} placeholder="Type your message here..." required
                    value={form.message} onChange={e => setForm({...form, message: e.target.value})} />
                </div>
                <button type="submit" disabled={sending}
                  className="btn-primary w-full justify-center disabled:opacity-60">
                  <Send className="h-4 w-4" />
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
                <p className="text-xs text-center text-gray-400">
                  Your message will be saved and we will reply to your email
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
