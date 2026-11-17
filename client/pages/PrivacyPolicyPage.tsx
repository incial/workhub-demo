import React from 'react';
import { LegalDocumentLayout } from '../components/legal/LegalDocumentLayout';

const sections = [
  {
    title: 'Information We Collect',
    bullets: [
      'Account data, including name and email.',
      'Usage data, including logs and platform activity.',
      'Device and browser metadata.'
    ]
  },
  {
    title: 'How We Use Data',
    bullets: [
      'Provide and maintain the platform.',
      'Authenticate users.',
      'Monitor performance and security.',
      'Improve features.'
    ]
  },
  {
    title: 'Data Ownership',
    bullets: [
      'All client data is owned by the client organization.',
      'INCIAL does not sell or monetize user data.'
    ]
  },
  {
    title: 'Data Sharing',
    body: 'We may share data only where operationally required or legally necessary.',
    bullets: [
      'Infrastructure providers for hosting and storage.',
      'Legal authorities if required by law.'
    ],
    note: 'No third-party advertising or tracking is used.'
  },
  {
    title: 'Data Security',
    bullets: [
      'Encryption in transit (HTTPS).',
      'Secure storage practices.',
      'Access control through role-based permissions.'
    ]
  },
  {
    title: 'Data Retention',
    bullets: [
      'Data is retained while the account is active.',
      'Data is deleted or exported upon client request.'
    ]
  },
  {
    title: 'User Responsibilities',
    bullets: [
      'Keep credentials secure.',
      'Report suspicious activity promptly.'
    ]
  },
  {
    title: 'Cookies / Browser Usage',
    bullets: [
      'Used for authentication and session management.',
      'No tracking for advertising.'
    ]
  },
  {
    title: 'Your Rights',
    body: 'Depending on jurisdiction, users may:',
    bullets: [
      'Request access to data.',
      'Request correction or deletion.'
    ]
  },
  {
    title: 'Contact',
    note: 'For privacy, retention, export, or correction requests, contact INCIAL using the support address below.'
  }
];

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <LegalDocumentLayout
      documentLabel="Privacy Policy"
      title="WorkHub by INCIAL"
      effectiveDate="April 28, 2026"
      intro="This Privacy Policy explains what information WorkHub processes, why it is used, how it is protected, and what responsibilities and rights apply to client organizations and end users."
      contactEmail="support@incial.com"
      sections={sections}
    />
  );
};
