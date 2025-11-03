import { motion } from "framer-motion"
import { ArrowRight, FileUp, Image } from "lucide-react"

export default function Hero() {
  return (
    <section  className="pt-32 pb-16 md:py-40 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-block mb-4 px-4 py-2 bg-accent/10 rounded-full border border-accent/20"
          >
            <span className="text-sm font-medium text-primary">✨ Welcome to vibechat</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-poppins font-bold text-foreground leading-tight mb-6"
          >
            Connect with <span className="text-primary">real vibes</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-base sm:text-lg text-foreground/70 mb-8 leading-relaxed max-w-lg font-light"
          >
            Experience messaging like never before. Share files, folders, and moments instantly with end-to-end
            encryption.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 sm:px-8 py-3 bg-primary text-primary-foreground rounded-full font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-shadow text-sm sm:text-base"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 sm:px-8 py-3 border-2 border-primary text-primary rounded-full font-semibold hover:bg-primary/5 transition-colors text-sm sm:text-base"
            >
              Watch Demo
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-4 sm:gap-6"
          >
            <div className="flex items-center gap-2">
              <FileUp className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground/70">Share Files</span>
            </div>
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground/70">Share Photo</span>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="relative h-64 sm:h-80 md:h-96 lg:h-full mt-8 md:mt-0"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY }}
            className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center overflow-hidden"
          >
            <img
              src="/modern-chat-app-interface-with-file-sharing.jpg"
              alt="vibechat interface showing real-time messaging and file sharing features"
              className="w-full h-full object-cover rounded-3xl"
            />
          </motion.div>
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, delay: 0.5 }}
            className="absolute top-6 sm:top-12 right-6 sm:right-12 w-20 sm:w-32 h-20 sm:h-32 bg-primary/10 rounded-3xl border border-primary/20"
          />
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, delay: 1 }}
            className="absolute bottom-6 sm:bottom-12 left-4 sm:left-6 w-16 sm:w-24 h-16 sm:h-24 bg-accent/10 rounded-2xl border border-accent/20"
          />
        </motion.div>
      </div>
    </section>
  )
}
