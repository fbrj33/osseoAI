import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Stethoscope, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Search, 
  BrainCircuit,
  Activity,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f0f0f2] overflow-x-hidden selection:bg-[#3b82f6] selection:text-white">
      {/* Navigation for Landing Page */}
      <nav className="fixed top-0 w-full z-50 border-b border-[#2d2d35]/30 bg-[#0a0a0c]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-[#3b82f6] p-1.5 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Osseo<span className="text-[#3b82f6]">AI</span></span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/documentation" className="text-sm font-medium text-[#a1a1aa] hover:text-[#f0f0f2] transition-colors">Documentation</Link>
          <Link to="/auth">
            <Button variant="outline" className="border-[#2d2d35] bg-transparent text-[#f0f0f2] hover:bg-[#1e1e24] hover:text-white">
              Sign In
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.1)_0%,_transparent_70%)] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e1e24] border border-[#2d2d35] text-[#3b82f6] text-xs font-bold uppercase tracking-widest mb-6">
              <Zap className="w-3 h-3" />
              v2.0 Now Available
            </div>
            <h1 className="text-6xl md:text-7xl font-bold leading-[1.1] mb-8 bg-gradient-to-br from-white via-white to-[#a1a1aa] bg-clip-text text-transparent">
              Detect Fractures with <span className="text-[#3b82f6]">Unrivaled Precision.</span>
            </h1>
            <p className="text-xl text-[#a1a1aa] leading-relaxed mb-10 max-w-xl">
              
               OsseoAI is an intelligent medical system that analyzes bone X-rays in seconds, delivering fast and reliable 
              fracture detection to support doctors with a precise AI-powered second opinion..
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/auth">
                <Button className="h-14 px-8 bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-[#3b82f6]/20 group">
                  Start Analysis Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/roadmap">
                <Button variant="ghost" className="h-14 px-8 text-[#a1a1aa] hover:text-[#f0f0f2] hover:bg-[#1e1e24] font-medium text-lg">
                  View Roadmap
                </Button>
              </Link>
            </div>
            <div className="mt-12 flex items-center gap-6">
             
            
            </div>
          </motion.div>

          {/* Visual Element */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative z-10 bg-[#16161a] border border-[#2d2d35] rounded-3xl p-4 shadow-2xl overflow-hidden aspect-square flex items-center justify-center group">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.05)_1px,transparent_1px)] bg-[size:30px_30px]" />
              <div className="relative w-full h-full rounded-2xl overflow-hidden border border-[#2d2d35] bg-[#0a0a0c]">
                {/* Mock Scan UI */}
                <div className="absolute inset-0 p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-widest text-[#a1a1aa] font-bold">Analysis Running</div>
                      <div className="h-1 w-24 bg-[#1e1e24] rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: "70%" }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          className="h-full bg-[#3b82f6]" 
                        />
                      </div>
                    </div>
                    <div className="bg-[#10b981]/20 text-[#10b981] px-2 py-1 rounded text-[10px] font-bold border border-[#10b981]/30">89FPS</div>
                  </div>
                  
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-[0.5px] border-[#3b82f6]/30 rounded-full animate-pulse" />
                  <Search className="absolute top-1/3 right-1/3 text-[#3b82f6] h-12 w-12 opacity-20" />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1e1e24]/50 backdrop-blur-sm border border-[#2d2d35] p-3 rounded-xl">
                      <div className="text-[10px] text-[#a1a1aa] mb-1">Confidence Score</div>
                      <div className="text-xl font-bold text-[#f0f0f2]">84.2%</div>
                    </div>
                    <div className="bg-[#1e1e24]/50 backdrop-blur-sm border border-[#2d2d35] p-3 rounded-xl">
                      <div className="text-[10px] text-[#a1a1aa] mb-1">Detection Zone</div>
                      <div className="text-xl font-bold text-[#3b82f6]">Wrist (L)</div>
                    </div>
                  </div>
                </div>
                {/* Decorative scanning line */}
                <motion.div 
                  className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#3b82f6] to-transparent z-20 shadow-[0_0_15px_#3b82f6]"
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </div>
            {/* Background elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#3b82f6]/10 rounded-full blur-[80px]" />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-[#3b82f6]/5 rounded-full blur-[100px]" />
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 border-t border-[#2d2d35]/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Engineered for Clinical Precision</h2>
            <p className="text-lg text-[#a1a1aa]">We provide tools that empower doctors, not replace them.</p>
          </div>
          
         
        </div>
      </section>

      {/* Social Proof */}
      

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#2d2d35]/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[#3b82f6]" />
            <span className="text-lg font-bold tracking-tight">Osseo<span className="text-[#3b82f6]">AI</span></span>
          </div>
          <div className="flex gap-6">
            <Link to="#" className="text-xs text-[#a1a1aa] hover:text-[#f0f0f2]">Privacy</Link>
            <Link to="#" className="text-xs text-[#a1a1aa] hover:text-[#f0f0f2]">Terms</Link>
            <Link to="#" className="text-xs text-[#a1a1aa] hover:text-[#f0f0f2]">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
