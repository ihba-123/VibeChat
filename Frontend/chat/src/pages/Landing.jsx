import Demo from '../components/Demo'
import Features from '../components/Features'
import Footer from '../components/Footer'
import Hero from '../components/Hero'
import Navbar from '../components/Navbar'

/** Public marketing page. */
export default function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Features />
      <Demo />
      <Footer />
    </main>
  )
}
