import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Sparkles } from 'lucide-react';

const Documentation: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f0f0f2] px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#a1a1aa] hover:text-[#f0f0f2] mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="bg-[#16161a] border border-[#2d2d35] rounded-3xl p-10 shadow-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-12 w-12 rounded-3xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6]">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">OsseoAI Documentation</h1>
              <p className="text-sm text-[#a1a1aa] mt-2">Everything you need to know about using the system and managing users.</p>
            </div>
          </div>

          <section className="space-y-8">
            <article className="rounded-3xl border border-[#2d2d35] p-6 bg-[#0f0f13]">
              <h2 className="text-2xl font-semibold mb-3">Getting Started</h2>
              <p className="text-[#a1a1aa] leading-relaxed">Sign in with your account, then navigate to the Dashboard to upload X-rays, manage patients, and review analysis results. Administrators can manage doctors in the Admin Panel.</p>
            </article>

            <article className="rounded-3xl border border-[#2d2d35] p-6 bg-[#0f0f13]">
              <h2 className="text-2xl font-semibold mb-3">Authentication</h2>
              <p className="text-[#a1a1aa] leading-relaxed">Use the login form on the authentication page to access your account. If two-factor authentication is enabled, you will be prompted to enter a TOTP code from your authenticator app.</p>
            </article>

            <article className="rounded-3xl border border-[#2d2d35] p-6 bg-[#0f0f13]">
              <h2 className="text-2xl font-semibold mb-3">Admin Workflow</h2>
              <p className="text-[#a1a1aa] leading-relaxed">Admin users can approve or delete doctor accounts from the Admin page. Approved doctors can access the dashboard and patient records.</p>
            </article>

            <article className="rounded-3xl border border-[#2d2d35] p-6 bg-[#0f0f13]">
              <h2 className="text-2xl font-semibold mb-3">Patient Data</h2>
              <p className="text-[#a1a1aa] leading-relaxed">Patients remain accessible even if their original doctor account is deleted. Deleted doctor references are preserved to maintain patient history.</p>
            </article>
          </section>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/roadmap">
              <Button variant="secondary" className="bg-[#1e1e24] border-[#2d2d35] text-[#f0f0f2] hover:bg-[#272a32]">View Roadmap</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90">Go to Auth</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
