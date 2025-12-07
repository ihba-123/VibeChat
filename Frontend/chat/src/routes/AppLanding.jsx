import React from 'react';
import Navbar from '../pages/Navbar';
import Hero from '../pages/Hero';
import Features from '../pages/Features';
import Demo from '../pages/Demo';
import Footer from '../pages/Footer';

const AppLanding = () => {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-gray-950 to-slate-950 scroll-smooth">
      <Navbar />

      <div id="product">
        <Hero />
      </div>

      <div id="features">
        <Features />
      </div>

      <div id="cta">
        <Demo />
      </div>

      <Footer />
    </main>
  );
};

export default AppLanding;
