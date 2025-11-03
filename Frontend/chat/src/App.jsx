import React from 'react'
import Navbar from './components/Navbar'
import Demo from './components/Demo'
import Features from './components/Features'
import Hero from './components/Hero'
import Footer from './components/footer'

const App = () => {
  return (
    <main className="min-h-screen bg-background">
      <Navbar  />
      <Hero />
      <Features />
      <Demo />
      <Footer  />
    </main>
  )
}

export default App