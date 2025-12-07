import { Mail, MapPin, Instagram, Facebook, Twitter ,MessageCircleDashed ,MoveRight} from "lucide-react"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative mt-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-black to-slate-950 opacity-100"></div>
      <div className="absolute inset-0 backdrop-blur-sm bg-slate-950/40"></div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-15 mb-8">
          {/* Brand Section */}
          <div className="flex flex-col items-center md:items-start gap-3 text-blue-300  ">
            <h3 className="text-xl font-bold flex gap-2 "><MessageCircleDashed size={24} />VibeChat</h3>
            <p className=" text-sm">Making messages meaningful</p>
          </div>

          {/* Quick Links */}
          <div className="flex justify-between  md:items-start md:col-span-2">
            
          <div className="flex flex-col items-start gap-2 md:ml-34">
            <h4 className="text-blue-400 font-semibold">Quick Links</h4>
            <div className="flex flex-col  gap-2 text-sm">
              <a href="#" className="text-blue-300 flex  items-center justify-center gap-1 hover:text-white transition-colors">
               <MoveRight size={16} />About Us
              </a>
              <a href="#" className="text-blue-300 flex  items-center justify-center gap-1 hover:text-white transition-colors">
                <MoveRight size={16}/>Services
              </a>
              <a href="#" className="text-blue-300 flex  items-center justify-center gap-2 hover:text-white transition-colors">
                <MoveRight size={16} />Contact
              </a>
            </div>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col items-start gap-3">
            <h4 className="text-blue-400 font-semibold">Contact</h4>
            <div className="flex flex-col gap-2 text-sm text-gray-300">
              <div className="flex text-blue-300 items-center gap-2">
                <Mail size={16} />
                <span>bhattaabhishek62@gmail.com</span>
              </div>
              <div className="flex text-blue-300 items-center gap-2">
                <MapPin size={16} />
                <span>Kathmandu, Nepal</span>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-30 mb-8"></div>

        {/* Social & Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Social Media Icons - Using real Lucide icons */}
          <div className="flex gap-6">
            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
              aria-label="Instagram"
            >
              <div className="absolute -inset-2 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
              <Instagram className="relative w-6 h-6 text-gray-300 group-hover:text-white transition-colors" />
            </a>

            {/* Facebook */}
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
              aria-label="Facebook"
            >
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
              <Facebook className="relative w-6 h-6 text-gray-300 group-hover:text-white transition-colors" />
            </a>

            {/* Twitter */}
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative"
              aria-label="Twitter"
            >
              <div className="absolute -inset-2 bg-gradient-to-r from-sky-400 to-blue-500 rounded-full opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
              <Twitter className="relative w-6 h-6 text-gray-300 group-hover:text-white transition-colors" />
            </a>
          </div>

          {/* Copyright */}
          <p className="text-gray-400 text-sm text-center sm:text-right">
            &copy; {currentYear} VibeChat. All rights reserved.
          </p>
        </div>
      </div>

      {/* Border accent */}
      <div className="relative h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-20"></div>
    </footer>
  )
}