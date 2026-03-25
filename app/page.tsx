import { DPUploader } from '@/components/dp-uploader';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NIMEPA DP Generator',
  description: 'Generate your profile photo for the NIMEPA beach cleanup flyer',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-blue-50 dark:from-background dark:to-slate-900 flex flex-col items-center justify-center py-12">
      <div className="w-full max-w-3xl mx-auto px-4 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center bg-primary/10 rounded-full px-4 py-2 mb-4">
            <span className="text-sm font-semibold text-primary">NIMEPA Beach Cleanup</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Create Your <span className="text-primary">Display Picture</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your photo and we&apos;ll automatically blend it seamlessly onto the official NIMEPA beach cleanup flyer. Fast, simple, and one-click.
          </p>
        </div>

        {/* Uploader Component */}
        <DPUploader />

        {/* Footer Info */}
        <div className="bg-secondary/50 rounded-lg p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Pro tip:</span> For best results, use a clear headshot or portrait photo with good lighting.
          </p>
        </div>
      </div>
    </main>
  );
}
