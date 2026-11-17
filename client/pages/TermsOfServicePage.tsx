import React from 'react';
import { LegalDocumentLayout } from '../components/legal/LegalDocumentLayout';

const sections = [
  {
    title: 'Acceptance',
    body: 'By accessing or using WorkHub, you agree to these Terms. If you do not agree, do not use the platform.'
  },
  {
    title: 'Accounts & Credentials',
    bullets: [
      'Each user must have a unique account.',
      'Account sharing is strictly prohibited.',
      'You are responsible for maintaining password confidentiality.',
      'You are responsible for all activity under your account.',
      'INCIAL may suspend accounts for misuse or suspicious activity.'
    ]
  },
  {
    title: 'Permitted Use',
    body: 'You agree not to misuse the platform or attempt access beyond your authorized scope.',
    bullets: [
      'Access unauthorized data.',
      'Share credentials.',
      'Upload malicious code.',
      'Use bots or scripts without approval.',
      'Disrupt system performance.'
    ]
  },
  {
    title: 'Data Usage',
    bullets: [
      'All data belongs to the client organization.',
      'INCIAL processes data only to provide platform services.',
      'Data may be processed by secure infrastructure providers for hosting and storage.'
    ]
  },
  {
    title: 'Security',
    bullets: [
      'Industry-standard security measures are applied.',
      'Users must follow security best practices.',
      'INCIAL is not liable for breaches caused by user negligence.'
    ]
  },
  {
    title: 'Platform Availability',
    body: 'Target uptime is 99%+, but uninterrupted availability cannot be guaranteed at all times.',
    bullets: [
      'Downtime may occur due to maintenance.',
      'Downtime may occur due to security incidents.',
      'Downtime may occur due to infrastructure failures.'
    ]
  },
  {
    title: 'Termination',
    body: 'INCIAL may suspend or terminate access if:',
    bullets: [
      'Terms are violated.',
      'Security risks are detected.',
      'Legal requirements apply.'
    ]
  },
  {
    title: 'Limitation of Liability',
    body: 'The platform is provided "as is". INCIAL is not liable for:',
    bullets: [
      'Indirect or consequential damages.',
      'Data loss due to user actions.'
    ]
  },
  {
    title: 'Changes to Terms',
    note: 'INCIAL may update these Terms. Continued use of WorkHub constitutes acceptance of the updated Terms.'
  },
  {
    title: 'Contact',
    note: 'For contractual, legal, or support-related queries, contact INCIAL using the support address below.'
  }
];

export const TermsOfServicePage: React.FC = () => {
  return (
    <LegalDocumentLayout
      documentLabel="Terms & Conditions"
      title="WorkHub by INCIAL"
      effectiveDate="April 28, 2026"
      intro="These Terms govern access to WorkHub and define the responsibilities, platform boundaries, and account controls that apply to all authorized users and client organizations."
      contactEmail="support@incial.com"
      sections={sections}
    />
  );
};
