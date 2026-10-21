import React from 'react';
import { Phone, HeartHandshake, ShieldAlert, X, ExternalLink } from 'lucide-react';

interface CrisisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CrisisModal: React.FC<CrisisModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-100 p-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-900 font-serif">Immediate Crisis & Emergency Support</h2>
              <p className="text-xs text-rose-800 mt-0.5">
                Compassionate, human emergency care available 24 hours a day, 7 days a week.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close crisis support modal"
            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-white/80 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm text-stone-700 leading-relaxed">
            <p className="font-medium text-stone-900 mb-1">You are not alone right now.</p>
            Haven is an AI therapeutic guide and cannot replace human emergency responders during acute self-harm, medical crises, or active domestic danger. Please reach out to one of the free, confidential lifelines below immediately.
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Free 24/7 Crisis Helplines
            </h3>

            {/* US & Canada */}
            <div className="p-3.5 bg-white border border-stone-200 rounded-xl flex items-center justify-between hover:border-stone-300 transition-colors">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-stone-900">United States & Canada</div>
                <div className="text-xs text-stone-500">Suicide & Crisis Lifeline · Free, confidential call or text</div>
              </div>
              <a
                href="tel:988"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Call / Text 988
              </a>
            </div>

            {/* UK */}
            <div className="p-3.5 bg-white border border-stone-200 rounded-xl flex items-center justify-between hover:border-stone-300 transition-colors">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-stone-900">United Kingdom</div>
                <div className="text-xs text-stone-500">NHS Mental Health (111) or Samaritans (116 123)</div>
              </div>
              <a
                href="tel:111"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-stone-800 rounded-lg hover:bg-stone-900 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Call 111
              </a>
            </div>

            {/* Australia */}
            <div className="p-3.5 bg-white border border-stone-200 rounded-xl flex items-center justify-between hover:border-stone-300 transition-colors">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-stone-900">Australia</div>
                <div className="text-xs text-stone-500">Lifeline 24/7 Crisis Support</div>
              </div>
              <a
                href="tel:131114"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-stone-800 rounded-lg hover:bg-stone-900 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Call 13 11 14
              </a>
            </div>

            {/* South Africa */}
            <div className="p-3.5 bg-white border border-stone-200 rounded-xl flex items-center justify-between hover:border-stone-300 transition-colors">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-stone-900">South Africa</div>
                <div className="text-xs text-stone-500">SADAG Suicide Crisis Helpline</div>
              </div>
              <a
                href="tel:0800567567"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-stone-800 rounded-lg hover:bg-stone-900 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                0800 567 567
              </a>
            </div>

            {/* International text & directory */}
            <div className="p-3.5 bg-white border border-stone-200 rounded-xl flex items-center justify-between hover:border-stone-300 transition-colors">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-stone-900">Global Crisis Text Line</div>
                <div className="text-xs text-stone-500">Text HOME to 741741 for 24/7 text support</div>
              </div>
              <a
                href="https://findahelpline.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors"
              >
                <span>Find Helplines</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Somatic grounding reset */}
          <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl text-teal-950 text-xs space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5 text-teal-900">
              <HeartHandshake className="w-4 h-4 text-teal-700" />
              30-Second Grounding Right Now
            </div>
            <p className="text-teal-800 leading-relaxed">
              Plant both feet firmly on the floor. Take an inhalation for 4 seconds, hold gently for 4, and exhale with a long, slow sigh for 6 seconds. Feel the solid ground supporting you beneath your shoes.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors"
          >
            I Am Safe / Return to Haven
          </button>
        </div>
      </div>
    </div>
  );
};
