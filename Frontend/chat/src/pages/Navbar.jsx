import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, MessageCircleDashed } from "lucide-react";
import { useState } from "react";
import Button from "@mui/material/Button";
import { Link, useNavigate } from "react-router-dom";

const navItems = [
  { label: "Features", href: "features" },
  { label: "Product", href: "product" },
  { label: "Call to Action", href: "cta" },
];

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleScroll = (id) => {
    setIsMenuOpen(false);
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", `#${id}`);
      }
    }, 200);
  };

  const handleMobileSignIn = () => {
    setIsMenuOpen(false);
    navigate("/login");
  };

  const handleMobileSignUp = () => {
    setIsMenuOpen(false);
    navigate("/register");
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 w-full backdrop-blur-md border-b z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-8 h-8 rounded-lg text-blue-300 flex items-center justify-center"
          >
            <MessageCircleDashed />
          </motion.div>
          <span className="text-xl text-blue-400 font-bold font-poppins transition-colors">
            VibeChat
          </span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item, i) => (
            <motion.button
              key={item.label}
              onClick={() => handleScroll(item.href)}
              className="text-blue-300 hover:text-primary transition-colors font-medium"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              {item.label}
            </motion.button>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-4">
          {/* Mobile menu button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-blue-400 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-5 h-5 text-blue-400" /> : <Menu className="w-5 h-5 text-blue-400" />}
          </motion.button>

          {/* Desktop Buttons */}
          <div className="hidden md:flex md:items-center md:gap-2">
            <Link to="/login">
              <Button variant="contained">Sign In</Button>
            </Link>
            <Link to="/register">
            <Button variant="outlined">Sign Up</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMenuOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden bg-background/30 backdrop-blur-xl z-50 relative"
            >
              <div className="px-4 sm:px-6 py-4 space-y-2">
                {navItems.map((item, i) => (
                  <motion.button
                    key={item.label}
                    onClick={() => handleScroll(item.href)}
                    className="w-full text-blue-300 text-left px-4 py-3 hover:text-primary hover:bg-muted rounded-lg transition-all font-medium"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                  >
                    {item.label}
                  </motion.button>
                ))}

                {/* Mobile Buttons */}
                <div className="mt-4 flex flex-col gap-3">
                  <Button
                    variant="outlined"
                    className="px-4 font-bold md:px-6 py-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity text-sm md:text-base"
                    onClick={handleMobileSignUp}
                  >
                    Sign Up
                  </Button>
                  <Button
                    variant="contained"
                    className="w-full px-4 py-3 text-foreground hover:text-primary hover:bg-muted rounded-lg transition-all font-medium text-left"
                    onClick={handleMobileSignIn}
                  >
                    Sign In
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
