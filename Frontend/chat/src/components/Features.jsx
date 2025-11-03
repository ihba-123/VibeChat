import { motion } from "framer-motion"
import { MessageSquare, Lock, Zap, Users, FileUp, Folder } from "lucide-react"

const features = [
  {
    icon: MessageSquare,
    title: "Instant Messaging",
    description: "Send and receive messages instantly with zero lag",
  },
  {
    icon: Lock,
    title: "End-to-End Encrypted",
    description: "Your conversations stay private and secure always",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Built for speed with optimized performance",
  },
  {
    icon: Users,
    title: "Group Chats",
    description: "Connect with friends and communities seamlessly",
  },
  {
    icon: FileUp,
    title: "File Sharing",
    description: "Share documents, images, and media instantly",
  },
  {
    icon: Folder,
    title: "Folder Sync",
    description: "Sync entire folders with your team effortlessly",
  },
]

export default function Features() {
  return (
    <section id="features" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-poppins font-bold text-foreground mb-4">
            Why vibechat?
          </h2>
          <p className="text-base sm:text-lg text-foreground/60 max-w-2xl mx-auto font-light px-4">
            Everything you need for meaningful conversations and seamless collaboration
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: i * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -5 }}
              className="p-6 bg-card rounded-2xl border border-border hover:border-primary/30 transition-all hover:shadow-lg"
            >
              <motion.div
                className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <feature.icon className="w-6 h-6 text-primary" />
              </motion.div>
              <h3 className="text-lg font-poppins font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-foreground/60 text-sm leading-relaxed font-light">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
