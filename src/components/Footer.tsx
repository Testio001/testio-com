import testioLogo from "@/assets/testio-logo.png";

const Footer = () => {
  return (
    <footer className="py-16 border-t border-border/50">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src={testioLogo} alt="Testio" className="w-6 h-6" />
            <span className="text-foreground font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>testio</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Blog</a>
            <a href="#" className="hover:text-foreground transition-colors">Careers</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 Testio. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
