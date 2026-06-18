import Layout from '../../components/Layout'
import { Helmet } from 'react-helmet-async'
import { BookOpen, Target, Users, Award, Mail, MapPin, Phone } from 'lucide-react'

export default function AboutUs() {
  return (
    <Layout>
      <Helmet>
        <title>About Us - AP TS Exam Hub</title>
        <meta name="description" content="Learn about AP TS Exam Hub - the one-stop portal for Andhra Pradesh and Telangana state exam aspirants." />
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-800 to-primary-600 text-white py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <BookOpen className="h-14 w-14 mx-auto mb-4 text-blue-200" />
          <h1 className="text-4xl font-extrabold mb-3">About AP TS Exam Hub</h1>
          <p className="text-xl text-blue-100">Built for AP & Telangana exam aspirants</p>
          <p className="text-lg text-blue-200 font-telugu mt-1">పరీక్షార్థుల కోసం నిర్మించబడిన వేదిక</p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">

        {/* Mission */}
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-4">
            <Target className="h-7 w-7 text-primary-600" />
            <h2 className="text-2xl font-bold">Our Mission</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
            AP TS Exam Hub is dedicated to helping students from Andhra Pradesh and Telangana achieve their dream of government jobs. We provide free, accurate, and timely information about APPSC, TSPSC, AP Police, TS Police, DSC, RRB, and SSC exams — all in one place.
          </p>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg font-telugu mt-3">
            ఆంధ్రప్రదేశ్ మరియు తెలంగాణ విద్యార్థులకు ప్రభుత్వ ఉద్యోగాలు సాధించడంలో సహాయం చేయడమే మా లక్ష్యం.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { number: '10+', label: 'Exam Categories' },
            { number: '500+', label: 'Previous Papers' },
            { number: 'Daily', label: 'Current Affairs' },
            { number: 'Free', label: 'Forever' },
          ].map(s => (
            <div key={s.label} className="card p-5 text-center">
              <p className="text-3xl font-extrabold text-primary-600">{s.number}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* What We Offer */}
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-5">
            <Award className="h-7 w-7 text-primary-600" />
            <h2 className="text-2xl font-bold">What We Offer</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'Exam Notifications', desc: 'Latest APPSC, TSPSC, AP/TS Police notifications instantly' },
              { title: 'Current Affairs', desc: 'Daily GK updates focused on AP & Telangana state exams' },
              { title: 'Previous Papers', desc: 'Year-wise question papers for all major exams' },
              { title: 'Mock Tests', desc: 'Practice tests with instant results and analytics' },
              { title: 'Genius AI', desc: 'AI-powered personal exam coach available 24/7' },
              { title: 'Daily GK Quiz', desc: 'Free daily quiz to sharpen your knowledge' },
            ].map(f => (
              <div key={f.title} className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exams Covered */}
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-5">
            <Users className="h-7 w-7 text-primary-600" />
            <h2 className="text-2xl font-bold">Exams We Cover</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {['APPSC Group 1', 'APPSC Group 2', 'APPSC Group 3', 'TSPSC Group 1', 'TSPSC Group 2', 'TSPSC Group 4', 'AP Police SI', 'TS Police SI', 'AP DSC', 'TS DSC', 'AP TET', 'TS TET', 'RRB NTPC', 'SSC CGL', 'AP Grama Sachivalayam', 'ICET', 'EAPCET', 'POLYCET'].map(e => (
              <span key={e} className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 text-sm">{e}</span>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="card p-8">
          <h2 className="text-2xl font-bold mb-4">Based In</h2>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
            <MapPin className="h-5 w-5 text-primary-600" />
            <p>Nellore, Andhra Pradesh, India</p>
          </div>
          <p className="mt-3 text-gray-500 dark:text-gray-400">Built with ❤️ for students of AP & Telangana</p>
        </div>

      </div>
    </Layout>
  )
}
