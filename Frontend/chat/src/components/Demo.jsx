import { motion } from "framer-motion"

export default function Demo() {
  return (
    <section id="product" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-poppins font-bold text-foreground mb-4">Sleek & Intuitive</h2>
          <p className="text-lg text-foreground/60 font-light">
            Experience a beautiful interface designed for modern communication
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden border border-border bg-card shadow-xl"
        >
          <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/5 flex items-center justify-center">
            <img src="/vibechat-dashboard-showing-messages-files-and-fold.jpg" alt="vibechat dashboard" className="w-full h-full object-cover" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="mt-12 grid md:grid-cols-3 gap-6"
        >
          {["Fast", "Secure", "Social"].map((item, i) => (
            <motion.div
              key={item}
              whileHover={{ scale: 1.05 }}
              className="p-6 bg-muted/50 rounded-xl text-center cursor-pointer"
            >
              <p className="text-lg font-poppins font-bold text-foreground">{item}</p>
              <p className="text-sm text-foreground/60 mt-2 font-light">
                {item === "Fast" && "Real-time message delivery with file sync"}
                {item === "Secure" && "Military-grade encryption for all data"}
                {item === "Social" && "Build communities and share moments"}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
