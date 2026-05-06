import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CalendarDays, Rocket } from 'lucide-react';

const Roadmap: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f0f0f2] px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#a1a1aa] hover:text-[#f0f0f2] mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="bg-[#16161a] border border-[#2d2d35] rounded-3xl p-10 shadow-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-3xl bg-[#10b981]/10 flex items-center justify-center text-[#10b981]">
              <Rocket className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Product Roadmap</h1>
              <p className="text-sm text-[#a1a1aa] mt-2">Planned improvements and upcoming features for OsseoAI.</p>
            </div>
          </div>

          <section className="space-y-8">
            <article className="rounded-3xl border border-[#2d2d35] p-6 bg-[#0f0f13]">
              <div className="flex items-center gap-3 mb-4">
                <CalendarDays className="w-5 h-5 text-[#10b981]" />
                <h2 className="text-2xl font-semibold">Q2 - Stability & polish</h2>
              </div>
              <ul className="list-disc list-inside text-[#a1a1aa] leading-relaxed">
                <li>Improve user onboarding and documentation flow.</li>
                <li>Refine admin management and role-based access.</li>
                <li>Enhance patient reporting and analytics views.</li>
              </ul>
            </article>

            <article className="rounded-3xl border border-[#2d2d35] p-6 bg-[#0f0f13]">
              <div className="flex items-center gap-3 mb-4">
                <CalendarDays className="w-5 h-5 text-[#3b82f6]" />
                <h2 className="text-2xl font-semibold">Q3 - Feature expansion</h2>
              </div>
              <ul className="list-disc list-inside text-[#a1a1aa] leading-relaxed">
                <li>Doctor dashboard improvements for X-ray uploads and scan history.</li>
                <li>Patient profile enhancements and secure notes.</li>
                <li>Support for additional imaging formats and analysis modes.</li>
              </ul>
            </article>

            <article className="rounded-3xl border border-[#2d2d35] p-6 bg-[#0f0f13]">
              <div className="flex items-center gap-3 mb-4">
                <CalendarDays className="w-5 h-5 text-[#f97316]" />
                <h2 className="text-2xl font-semibold">Q4 - Scale & release</h2>
              </div>
              <ul className="list-disc list-inside text-[#a1a1aa] leading-relaxed">
                <li>Deploy production-ready backend and database migrations.</li>
                <li>Role-based admin analytics and audit trails.</li>
                <li>Mobile-friendly interface and performance tuning.</li>
              </ul>
            </article>
          </section>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/documentation">
              <Button variant="secondary" className="bg-[#1e1e24] border-[#2d2d35] text-[#f0f0f2] hover:bg-[#272a32]">Open Documentation</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90">Sign In</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Roadmap;
