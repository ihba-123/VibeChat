import Header from "@/components/header"
import Hero from "@/components/hero"
import Features from "@/components/features"
import Demo from "@/components/demo"
import CTA from "@/components/cta"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Features />
      <Demo />
      <CTA />
    </main>
  )
}
