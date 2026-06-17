import Navbar from './public/Navbar'
import Footer from './public/Footer'

export default function Layout({ children, title }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
