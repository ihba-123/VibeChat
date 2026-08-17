import { motion } from "framer-motion"
import { Github, Linkedin, Mail ,MessageCircleCode} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "../auth/AuthProvider"

export default function Footer() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  return (
    <>
      <section id="cta" className="scroll-mt-24 py-16 md:py-20 lg:py-32 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-accent/5 border border-primary/20 rounded-2xl sm:rounded-3xl p-6 sm:p-12 md:p-16 text-center"
        >
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4"
          >
            Ready to connect?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-base sm:text-lg text-foreground/60 mb-8 max-w-2xl mx-auto font-normal"
          >
            Join thousands of users enjoying vibechat today. Start your first conversation now.
          </motion.p>
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            onClick={() => navigate(isAuthenticated ? "/app" : "/register")}
            className="px-6 sm:px-10 py-3 sm:py-4 bg-primary text-primary-foreground rounded-full font-bold text-base sm:text-lg hover:shadow-lg transition-shadow"
          >
            {isAuthenticated ? "Open VibeChat" : "Start Now"}
          </motion.button>
        </motion.div>
      </section>

      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="bg-card border-t border-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-12">
            {/* Brand section */}
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <MessageCircleCode />
                </div>
                <span className="text-lg sm:text-xl font-bold text-foreground">vibechat</span>
              </div>
              <p className="text-foreground/60 text-xs sm:text-sm font-normal">
                Modern messaging platform for real connections
              </p>
            </div>

            {/* Product links */}
            <div>
              <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Product</h4>
              <ul className="space-y-2">
                {["Features", "Security", "Pricing", "Roadmap"].map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-foreground/60 hover:text-primary text-xs sm:text-sm transition-colors font-normal"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Company</h4>
              <ul className="space-y-2">
                {["About", "Blog", "Careers", "Contact"].map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-foreground/60 hover:text-primary text-xs sm:text-sm transition-colors font-normal"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social links */}
            <div>
              <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Connect</h4>
              <div className="flex gap-2 sm:gap-4">
                <motion.a
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  href="#"
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-muted rounded-lg flex items-center justify-center hover:bg-primary/10 transition-colors"
                  aria-label="GitHub"
                >
                  <Github className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  href="#"
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-muted rounded-lg flex items-center justify-center hover:bg-primary/10 transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  href="#"
                  className="w-8 h-8 sm:w-10 sm:h-10 bg-muted rounded-lg flex items-center justify-center hover:bg-primary/10 transition-colors"
                  aria-label="Email"
                >
                  <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
                </motion.a>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6 sm:pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs sm:text-sm text-foreground/60 font-normal">
            <p className="text-center sm:text-left">© 2025 vibechat. All rights reserved.</p>
            <div className="flex flex-wrap justify-center sm:justify-end gap-4 sm:gap-6">
              <a href="#" className="hover:text-primary transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-primary transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-primary transition-colors">
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </motion.footer>
    </>
  )
}
