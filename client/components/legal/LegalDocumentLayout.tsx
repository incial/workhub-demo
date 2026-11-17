import React from 'react';
import { isDemoBoundaryActive } from '../../demo/network';

type LegalSection = {
  title: string;
  body?: string;
  bullets?: string[];
  note?: string;
};

interface LegalDocumentLayoutProps {
  documentLabel: string;
  title: string;
  effectiveDate: string;
  intro: string;
  contactEmail: string;
  sections: LegalSection[];
}

export const LegalDocumentLayout: React.FC<LegalDocumentLayoutProps> = ({
  documentLabel,
  title,
  effectiveDate,
  intro,
  contactEmail,
  sections
}) => {
  const displayedContactEmail = isDemoBoundaryActive() ? 'support@workhub-demo.example' : contactEmail;
  const scrollToSection = (index: number) => {
    if (typeof document === 'undefined') return;
    const element = document.getElementById(`legal-section-${index}`);
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_48%,#f8fafc_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.18)]">
          <div className="border-b border-slate-200/80 bg-[linear-gradient(135deg,#0f172a_0%,#1e3a8a_58%,#2563eb_100%)] px-6 py-8 text-white sm:px-8 lg:px-10">
            <div className="mb-4 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-blue-100">
              {documentLabel}
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <div>
                <h1 className="max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">{title}</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-blue-100/90 sm:text-[15px]">{intro}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-blue-100/80">Effective Date</p>
                <p className="mt-2 text-lg font-bold text-white">{effectiveDate}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="border-b border-slate-200 bg-slate-50/90 px-6 py-6 lg:border-b-0 lg:border-r lg:px-5">
              <p className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Contents</p>
              <div className="space-y-2">
                {sections.map((section, index) => (
                  <button
                    key={section.title}
                    type="button"
                    onClick={() => scrollToSection(index + 1)}
                    className="flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-black text-blue-700">
                      {index + 1}
                    </span>
                    <span className="font-semibold leading-5">{section.title}</span>
                  </button>
                ))}
              </div>
            </aside>

            <main className="px-6 py-6 sm:px-8 sm:py-8 lg:px-10">
              <div className="space-y-5">
                {sections.map((section, index) => (
                  <section
                    key={section.title}
                    id={`legal-section-${index + 1}`}
                    className="rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-5 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.16)] sm:p-6"
                  >
                    <div className="mb-4 flex items-start gap-4">
                      <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white shadow-sm">
                        {index + 1}
                      </div>
                      <div>
                        <h2 className="text-xl font-black tracking-[-0.03em] text-slate-900">{section.title}</h2>
                        {section.body ? <p className="mt-2 text-[15px] leading-7 text-slate-600">{section.body}</p> : null}
                      </div>
                    </div>

                    {section.bullets && section.bullets.length > 0 ? (
                      <div className="grid gap-3">
                        {section.bullets.map((bullet) => (
                          <div
                            key={bullet}
                            className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                          >
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                            <p className="text-[15px] leading-7 text-slate-700">{bullet}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {section.note ? (
                      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-[15px] leading-7 text-blue-900">
                        {section.note}
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
            </main>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-5 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.14)] sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Support Contact</p>
              <p className="mt-1 text-sm text-slate-600">For policy questions, legal requests, or compliance concerns, contact INCIAL support.</p>
            </div>
            <a
              href={`mailto:${displayedContactEmail}`}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
            >
              {displayedContactEmail}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
